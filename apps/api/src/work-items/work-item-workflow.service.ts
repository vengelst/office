/**
 * Service für Work Item Workflow.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  Prisma,
  WorkItemReportType,
  WorkItemReviewAction,
  WorkItemStatus,
} from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { StoragePathService } from '../common/storage-path.service';
import { fileSlug, slugify } from '../common/slug.util';
import {
  CompleteReportDto,
  ReviewDto,
  ReworkReportDto,
  StartSessionDto,
  StopSessionDto,
} from './dto/workflow.dto';
import { WorkItemsService } from './work-items.service';

/** Pflicht-Fotoanzahl bei der Fertigmeldung (SPEZ Abschnitt 4.1: 2–3 Fotos). */
export const MIN_COMPLETION_PHOTOS = 2;

/** Status, aus denen ein Monteur ein Item nehmen/weiterbearbeiten darf. */
const CLAIMABLE_STATUSES: WorkItemStatus[] = [
  WorkItemStatus.OPEN,
  WorkItemStatus.IN_PROGRESS,
  WorkItemStatus.REWORK,
];

/**
 * Domänenlogik der Item-Bearbeitung (SPEZ-arbeitsitems.md Abschnitte 5–8):
 *
 *  - Nehmen (claim): Zuordnung aktiv, OPEN → IN_PROGRESS
 *  - Mehrere Monteure gleichwertig; **eine** Fertigmeldung genügt (Variante B)
 *  - Fertigmeldung: min. 2 Fotos Pflicht → REVIEW, alle Zuordnungen enden
 *  - Nacharbeit: → REWORK, Zuordnungen bleiben aktiv
 *  - Kunden-PL APPROVE / FORCE_COMPLETE: → APPROVED, Zuordnungen enden
 *  - Item-Zeit ausschließlich über Sessions (kein Weiterlaufen über Nacht)
 */
@Injectable()
export class WorkItemWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
    private readonly documents: DocumentsService,
    private readonly storagePath: StoragePathService,
  ) {}

  // ── Nehmen ───────────────────────────────────────────────────

  /**
   * Monteur nimmt ein Item. OPEN wird zu IN_PROGRESS; bei IN_PROGRESS/REWORK
   * kommt der Monteur als weiterer gleichwertiger Bearbeiter hinzu.
   *
   * @param itemId - UUID des Work Items
   * @param actor - Angemeldeter Akteur (Worker-Token oder verknüpfter Benutzer)
   * @returns Item-Detail nach dem Nehmen
   */
  async claim(itemId: string, actor: AuthUser) {
    const workerId = await this.resolveWorkerId(actor);
    const item = await this.loadItem(itemId);

    if (!CLAIMABLE_STATUSES.includes(item.status)) {
      throw new ConflictException(
        item.status === WorkItemStatus.REVIEW
          ? 'Item ist in Kontrolle und kann nicht genommen werden'
          : 'Item ist bereits geprüft',
      );
    }
    await this.assertProjectMember(item.projectId, workerId);

    const existing = await this.prisma.workItemAssignment.findFirst({
      where: { workItemId: itemId, workerId, active: true },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.workItemAssignment.create({
          data: { workItemId: itemId, workerId },
        });
      }
      if (item.status === WorkItemStatus.OPEN) {
        await tx.workItem.update({
          where: { id: itemId },
          data: { status: WorkItemStatus.IN_PROGRESS },
        });
      }
    });

    return this.workItems.findOne(itemId);
  }

  // ── Item-Zeit (Sessions) ─────────────────────────────────────

  /**
   * Setzt das "aktuelle Item" des Monteurs: beendet dessen offene Sessions
   * (auch an anderen Items) und startet eine neue Session.
   *
   * @param itemId - UUID des Work Items
   * @param dto - Optionaler Startzeitpunkt
   * @param actor - Angemeldeter Akteur
   * @returns Neue Session und Anzahl automatisch beendeter Sessions
   */
  async startSession(itemId: string, dto: StartSessionDto, actor: AuthUser) {
    const workerId = await this.resolveWorkerId(actor);
    const item = await this.loadItem(itemId);

    if (item.status === WorkItemStatus.APPROVED) {
      throw new ConflictException('Item ist geprüft – keine Zeiterfassung mehr möglich');
    }
    await this.assertActiveAssignment(itemId, workerId);

    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();

    const { closed, session } = await this.prisma.$transaction(async (tx) => {
      const closedCount = await this.closeOpenSessions(tx, { workerId }, startedAt);
      const created = await tx.workItemSession.create({
        data: { workItemId: itemId, workerId, startedAt },
      });
      return { closed: closedCount, session: created };
    });

    return {
      session: withDuration(session),
      closedPreviousSessions: closed,
    };
  }

  /**
   * Beendet die offene Session des Monteurs an diesem Item.
   *
   * @throws ConflictException wenn keine offene Session existiert
   */
  async stopSession(itemId: string, dto: StopSessionDto, actor: AuthUser) {
    const workerId = await this.resolveWorkerId(actor);
    await this.loadItem(itemId);

    const open = await this.prisma.workItemSession.findMany({
      where: { workItemId: itemId, workerId, endedAt: null },
      select: { id: true, startedAt: true },
    });
    if (open.length === 0) {
      throw new ConflictException('Keine offene Session an diesem Item');
    }

    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
    await this.prisma.workItemSession.updateMany({
      where: { workItemId: itemId, workerId, endedAt: null },
      data: { endedAt },
    });

    const sessions = await this.prisma.workItemSession.findMany({
      where: { id: { in: open.map((s) => s.id) } },
    });

    return {
      sessions: sessions.map(withDuration),
      totalMinutes: sessions.reduce(
        (sum, s) => sum + durationMinutes(s.startedAt, s.endedAt),
        0,
      ),
    };
  }

  /**
   * Schließt alle offenen Item-Sessions eines Monteurs.
   * Wird beim Ausstempeln aufgerufen – Item-Zeit läuft nicht über Nacht weiter,
   * die Item-Zuordnung bleibt aber bestehen (SPEZ Abschnitt 5.1).
   *
   * @param workerId - UUID des Monteurs
   * @param at - Endzeitpunkt (Default: jetzt)
   * @returns Anzahl geschlossener Sessions
   */
  async closeOpenSessionsForWorker(workerId: string, at?: Date): Promise<number> {
    return this.closeOpenSessions(this.prisma, { workerId }, at ?? new Date());
  }

  /**
   * Item-Zeit je Monteur (Summe der abgeschlossenen Intervalle).
   *
   * @param itemId - ID des Work-Items (string)
   * @returns Zeitaggregation
   */
  async itemTime(itemId: string) {
    await this.workItems.ensureItem(itemId);
    const sessions = await this.prisma.workItemSession.findMany({
      where: { workItemId: itemId },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const byWorker = new Map<
      string,
      { workerId: string; name: string; minutes: number; sessions: number; open: number }
    >();
    for (const session of sessions) {
      const entry = byWorker.get(session.workerId) ?? {
        workerId: session.workerId,
        name: `${session.worker.lastName}, ${session.worker.firstName}`,
        minutes: 0,
        sessions: 0,
        open: 0,
      };
      entry.sessions += 1;
      if (session.endedAt) {
        entry.minutes += durationMinutes(session.startedAt, session.endedAt);
      } else {
        entry.open += 1;
      }
      byWorker.set(session.workerId, entry);
    }

    const perWorker = [...byWorker.values()];
    return {
      totalMinutes: perWorker.reduce((sum, w) => sum + w.minutes, 0),
      perWorker,
      sessions: sessions.map(withDuration),
    };
  }

  // ── Rückmeldungen des Monteurs ───────────────────────────────

  /**
   * Fertigmeldung: mindestens 2 Fotos sind Pflicht. Eine Meldung genügt –
   * alle aktiven Zuordnungen und offenen Sessions des Items werden beendet,
   * das Item geht in Kontrolle (REVIEW).
   *
   * @param itemId - UUID des Work Items
   * @param files - Hochgeladene Fotos (Multipart)
   * @param dto - Kommentar und/oder IDs bereits vorhandener Foto-Dokumente
   * @param actor - Angemeldeter Akteur
   * @returns Rückmeldung, Foto-IDs und Item-Detail
   */
  async reportComplete(
    itemId: string,
    files: Express.Multer.File[] | undefined,
    dto: CompleteReportDto,
    actor: AuthUser,
  ) {
    const workerId = await this.resolveWorkerId(actor);
    const item = await this.loadItem(itemId);

    if (
      item.status !== WorkItemStatus.IN_PROGRESS &&
      item.status !== WorkItemStatus.REWORK
    ) {
      throw new ConflictException(
        item.status === WorkItemStatus.OPEN
          ? 'Item muss erst genommen werden'
          : `Fertigmeldung im Status ${item.status} nicht möglich`,
      );
    }
    await this.assertActiveAssignment(itemId, workerId);

    const uploads = files ?? [];
    const existingIds = await this.validateDocumentIds(dto.documentIds);
    const photoCount = uploads.length + existingIds.length;
    if (photoCount < MIN_COMPLETION_PHOTOS) {
      throw new BadRequestException(
        `Fertigmeldung erfordert mindestens ${MIN_COMPLETION_PHOTOS} Fotos (übermittelt: ${photoCount})`,
      );
    }

    // Fotos zuerst ablegen – der Statuswechsel erfolgt erst danach in einer Transaktion.
    const uploadedIds = await this.storePhotos(item, uploads, actor);
    const photoIds = [...uploadedIds, ...existingIds];
    const now = new Date();

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workItemReport.create({
        data: {
          workItemId: itemId,
          workerId,
          type: WorkItemReportType.COMPLETED,
          comment: dto.comment,
        },
      });
      await this.linkPhotos(tx, created.id, photoIds);
      await this.endActiveAssignments(tx, itemId, now);
      await this.closeOpenSessions(tx, { workItemId: itemId }, now);
      await tx.workItem.update({
        where: { id: itemId },
        data: { status: WorkItemStatus.REVIEW },
      });
      return created;
    });

    return {
      report: { ...report, photoDocumentIds: photoIds },
      workItem: await this.workItems.findOne(itemId),
    };
  }

  /**
   * Nacharbeit-Meldung: Item ist nicht fertig, bleibt beim/den Monteur(en).
   * Fotos und Kommentar sind optional.
   *
   * @returns Rückmeldung, Foto-IDs und Item-Detail
   */
  async reportRework(
    itemId: string,
    files: Express.Multer.File[] | undefined,
    dto: ReworkReportDto,
    actor: AuthUser,
  ) {
    const workerId = await this.resolveWorkerId(actor);
    const item = await this.loadItem(itemId);

    if (
      item.status !== WorkItemStatus.IN_PROGRESS &&
      item.status !== WorkItemStatus.REWORK
    ) {
      throw new ConflictException(
        item.status === WorkItemStatus.OPEN
          ? 'Item muss erst genommen werden'
          : `Nacharbeit-Meldung im Status ${item.status} nicht möglich`,
      );
    }
    await this.assertActiveAssignment(itemId, workerId);

    const existingIds = await this.validateDocumentIds(dto.documentIds);
    const uploadedIds = await this.storePhotos(item, files ?? [], actor);
    const photoIds = [...uploadedIds, ...existingIds];

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workItemReport.create({
        data: {
          workItemId: itemId,
          workerId,
          type: WorkItemReportType.REWORK,
          comment: dto.comment,
        },
      });
      await this.linkPhotos(tx, created.id, photoIds);
      // Zuordnungen und laufende Sessions bleiben bestehen – das Item bleibt beim Monteur.
      await tx.workItem.update({
        where: { id: itemId },
        data: { status: WorkItemStatus.REWORK },
      });
      return created;
    });

    return {
      report: { ...report, photoDocumentIds: photoIds },
      workItem: await this.workItems.findOne(itemId),
    };
  }

  // ── Prüfung durch den Kunden-PL ──────────────────────────────

  /**
   * Kunden-PL bestätigt die Fertigmeldung: Item wird APPROVED (abrechenbar),
   * alle Zuordnungen und offenen Sessions enden.
   *
   * @throws ConflictException wenn das Item nicht in Kontrolle (REVIEW) ist
   */
  async approve(itemId: string, dto: ReviewDto, actor: AuthUser) {
    const item = await this.loadItem(itemId);
    await this.workItems.assertCustomerPlAccess(item.projectId, actor);

    if (item.status !== WorkItemStatus.REVIEW) {
      throw new ConflictException(
        item.status === WorkItemStatus.APPROVED
          ? 'Item ist bereits geprüft'
          : 'Nur Items in Kontrolle können geprüft werden (sonst "force-complete")',
      );
    }

    return this.finishAsApproved(itemId, WorkItemReviewAction.APPROVE, dto, actor);
  }

  /**
   * Kunden-PL setzt das Item selbst fertig – der/die Monteur(e) verlieren die Zuordnung sofort. Aus jedem Status außer APPROVED möglich.
   *
   * @param itemId - ID des Work-Items (string)
   * @param dto - Request-Body / Eingabedaten (ReviewDto)
   * @param actor - Ausführender Akteur (Audit) (AuthUser)
   * @returns Aktualisiertes Item
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  async forceComplete(itemId: string, dto: ReviewDto, actor: AuthUser) {
    const item = await this.loadItem(itemId);
    await this.workItems.assertCustomerPlAccess(item.projectId, actor);

    if (item.status === WorkItemStatus.APPROVED) {
      throw new ConflictException('Item ist bereits geprüft');
    }

    return this.finishAsApproved(
      itemId,
      WorkItemReviewAction.FORCE_COMPLETE,
      dto,
      actor,
    );
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `finishAsApproved` (finish As Approved).
   *
   * @param itemId - ID des Work-Items (string)
   * @param action - Parameter `action` (WorkItemReviewAction)
   * @param dto - Request-Body / Eingabedaten (ReviewDto)
   * @param actor - Ausführender Akteur (Audit) (AuthUser)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private async finishAsApproved(
    itemId: string,
    action: WorkItemReviewAction,
    dto: ReviewDto,
    actor: AuthUser,
  ) {
    const now = new Date();
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workItemReview.create({
        data: {
          workItemId: itemId,
          reviewerUserId: actor.id,
          action,
          comment: dto.comment,
        },
      });
      await this.endActiveAssignments(tx, itemId, now);
      await this.closeOpenSessions(tx, { workItemId: itemId }, now);
      await tx.workItem.update({
        where: { id: itemId },
        data: { status: WorkItemStatus.APPROVED },
      });
      return created;
    });

    return { review, workItem: await this.workItems.findOne(itemId) };
  }

  // ── Helfer ───────────────────────────────────────────────────

  /**
   * Lädt das Item inkl. Projektbezug.
   *
   * @param itemId - ID des Work-Items (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private async loadItem(itemId: string) {
    const item = await this.prisma.workItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        itemKey: true,
        status: true,
        projectId: true,
        project: { select: { id: true, projectNumber: true, title: true } },
      },
    });
    if (!item) {
      throw new NotFoundException('Work Item nicht gefunden');
    }
    return item;
  }

  /**
   * Ermittelt den handelnden Monteur: aus dem Worker-Token oder – bei einem
   * Benutzer-Token – über den mit dem User verknüpften Monteur-Datensatz.
   *
   * @param actor - Angemeldeter Akteur (Worker- oder Benutzer-Token)
   * @returns UUID des Monteurs
   * @throws ForbiddenException wenn kein Monteur-Datensatz ermittelbar ist
   */
  async resolveWorkerId(actor: AuthUser): Promise<string> {
    if (actor.type === 'worker') {
      return actor.id;
    }
    const worker = await this.prisma.worker.findFirst({
      where: { userId: actor.id, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!worker) {
      throw new ForbiddenException(
        'Aktion ist Monteuren vorbehalten (kein verknüpfter Monteur-Datensatz)',
      );
    }
    return worker.id;
  }

  /**
   * Monteur muss dem Projekt zugeordnet sein, um Items zu nehmen.
   *
   * @param projectId - ID des Projekts (string)
   * @param workerId - ID des Monteurs (string)
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async assertProjectMember(projectId: string, workerId: string) {
    const assignment = await this.prisma.projectAssignment.findFirst({
      where: { projectId, workerId, active: true },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException('Monteur ist diesem Projekt nicht zugeordnet');
    }
  }

  /**
   * Item muss dem Monteur aktiv zugeordnet sein.
   *
   * @param itemId - ID des Work-Items (string)
   * @param workerId - ID des Monteurs (string)
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async assertActiveAssignment(itemId: string, workerId: string) {
    const assignment = await this.prisma.workItemAssignment.findFirst({
      where: { workItemId: itemId, workerId, active: true },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException('Item ist dir nicht zugeordnet – erst nehmen (claim)');
    }
    return assignment;
  }

  /**
   * Beendet alle aktiven Zuordnungen eines Items.
   *
   * @param tx - Parameter `tx` (Prisma.TransactionClient)
   * @param itemId - ID des Work-Items (string)
   * @param at - Parameter `at` (Date)
   * @returns number
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async endActiveAssignments(
    tx: Prisma.TransactionClient,
    itemId: string,
    at: Date,
  ): Promise<number> {
    const result = await tx.workItemAssignment.updateMany({
      where: { workItemId: itemId, active: true },
      data: { active: false, endedAt: at },
    });
    return result.count;
  }

  /**
   * Schließt offene Sessions (je Monteur oder je Item).
   *
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async closeOpenSessions(
    tx: Prisma.TransactionClient | PrismaService,
    scope: { workerId?: string; workItemId?: string },
    at: Date,
  ): Promise<number> {
    const result = await tx.workItemSession.updateMany({
      where: { ...scope, endedAt: null },
      data: { endedAt: at },
    });
    return result.count;
  }

  /**
   * Prüft, dass übergebene Dokument-IDs existieren.
   *
   * @param ids - Liste von IDs (string[])
   * @returns string[]
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async validateDocumentIds(ids?: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const found = await this.prisma.document.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      const missing = unique.filter((id) => !found.some((d) => d.id === id));
      throw new BadRequestException(
        `Unbekannte Dokument-IDs: ${missing.join(', ')}`,
      );
    }
    return unique;
  }

  /**
   * Legt hochgeladene Fotos als Dokumente ab (Projekt-Kontext + Item-Verknüpfung). Pfad: projekte/<projekt>/arbeitsitems/<itemKey>/<datei>.
   *
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async storePhotos(
    item: { id: string; itemKey: string; projectId: string },
    files: Express.Multer.File[],
    actor: AuthUser,
  ): Promise<string[]> {
    if (files.length === 0) return [];

    const entity = await this.storagePath.getEntityInfo('PROJECT', item.projectId);
    const basePath = `projekte/${entity.slug}/arbeitsitems/${slugify(item.itemKey)}`;
    const ids: string[] = [];

    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(
          `Nur Bilddateien erlaubt (${file.originalname}: ${file.mimetype})`,
        );
      }
      const filename = `${Date.now()}_${fileSlug(file.originalname)}`;
      const doc = await this.documents.createFromBuffer({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        documentType: DocumentType.SITE_PHOTO,
        entityType: 'PROJECT',
        entityId: item.projectId,
        storagePath: `${basePath}/${filename}`,
        title: `${item.itemKey} – Foto`,
        userId: actor.type === 'user' ? actor.id : null,
        additionalLinks: [{ entityType: 'WORK_ITEM', entityId: item.id }],
      });
      ids.push(doc.id);
    }

    return ids;
  }

  /**
   * Verknüpft Fotos mit der Rückmeldung (entityType WORK_ITEM_REPORT).
   *
   * @param tx - Parameter `tx` (Prisma.TransactionClient)
   * @param reportId - ID (reportId) (string)
   * @param documentIds - Parameter `documentIds` (string[])
   * @returns void
   */
  private async linkPhotos(
    tx: Prisma.TransactionClient,
    reportId: string,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) return;
    await tx.documentLink.createMany({
      data: documentIds.map((documentId) => ({
        documentId,
        entityType: 'WORK_ITEM_REPORT',
        entityId: reportId,
      })),
    });
  }
}

/** Dauer in Minuten (0 bei offener Session). */
function durationMinutes(startedAt: Date, endedAt: Date | null): number {
  if (!endedAt) return 0;
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

/** Ergänzt eine Session um die berechnete Dauer. */
function withDuration<T extends { startedAt: Date; endedAt: Date | null }>(session: T) {
  return {
    ...session,
    durationMinutes: session.endedAt
      ? durationMinutes(session.startedAt, session.endedAt)
      : null,
  };
}
