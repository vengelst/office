import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleCode, WorkItemStatus } from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkItemDto,
  ReplaceMaterialsDto,
  UpdateWorkItemDto,
} from './dto/work-item.dto';
import { ListWorkItemsQueryDto } from './dto/workflow.dto';

/** Schlanke Projektion für Listen und Boards. */
const listSelect = {
  id: true,
  itemKey: true,
  title: true,
  status: true,
  floor: true,
  area: true,
  room: true,
  type: true,
  rc: true,
  detail: true,
  planPage: true,
  pdfFile: true,
  pdfPage: true,
  importedAt: true,
  updatedAt: true,
  block: { select: { id: true, blockKey: true, name: true, pdfDocumentId: true } },
  assignments: {
    where: { active: true },
    select: {
      id: true,
      startedAt: true,
      worker: {
        select: { id: true, workerNumber: true, firstName: true, lastName: true },
      },
    },
  },
  // Letzte Rückmeldung – Board-Spalte "letzte Meldung" (Büro und Kunden-PL).
  reports: {
    orderBy: { reportedAt: 'desc' },
    take: 1,
    select: { id: true, type: true, reportedAt: true },
  },
  _count: { select: { materials: true, reports: true } },
} satisfies Prisma.WorkItemSelect;

/** Vollständige Projektion für die Detailansicht. */
const detailSelect = {
  ...listSelect,
  projectId: true,
  workScopeDe: true,
  workScopeSk: true,
  sheetNo: true,
  sheetTotal: true,
  createdAt: true,
  project: {
    select: { id: true, projectNumber: true, title: true, itemBased: true },
  },
  materials: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      sortOrder: true,
      qty: true,
      qtyUnit: true,
      materialDe: true,
      materialSk: true,
    },
  },
  sessions: {
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      worker: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  reports: {
    orderBy: { reportedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      comment: true,
      reportedAt: true,
      worker: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  reviews: {
    orderBy: { reviewedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      action: true,
      comment: true,
      reviewedAt: true,
      reviewer: { select: { id: true, displayName: true } },
    },
  },
} satisfies Prisma.WorkItemSelect;

/**
 * Stammdaten-Service für Work Items: Listen, Detail, manuelles Anlegen/Ändern,
 * Materialzeilen und die Foto-Dokumente einer Rückmeldung.
 * Statuswechsel laufen ausschließlich über den WorkItemWorkflowService.
 */
@Injectable()
export class WorkItemsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listen / Detail ──────────────────────────────────────────

  /**
   * Listet die Work Items eines Projekts, gefiltert nach Status, Block und Suchbegriff.
   *
   * @param projectId - UUID des Projekts
   * @param query - Filter (status, blockKey, q, take, skip)
   * @returns Items inkl. Block und aktiven Zuordnungen sowie Status-Zähler
   */
  async findByProject(projectId: string, query: ListWorkItemsQueryDto) {
    await this.ensureProject(projectId);

    const where: Prisma.WorkItemWhereInput = { projectId };

    const statuses = parseStatuses(query.status);
    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
    if (query.blockKey) {
      where.block = { blockKey: query.blockKey };
    }
    if (query.q) {
      where.OR = [
        { itemKey: { contains: query.q, mode: 'insensitive' } },
        { title: { contains: query.q, mode: 'insensitive' } },
        { room: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const take = query.take && query.take > 0 ? Math.min(query.take, 1000) : 200;
    const skip = query.skip && query.skip > 0 ? query.skip : 0;

    const [items, total, grouped] = await Promise.all([
      this.prisma.workItem.findMany({
        where,
        orderBy: [{ itemKey: 'asc' }],
        select: listSelect,
        take,
        skip,
      }),
      this.prisma.workItem.count({ where }),
      this.prisma.workItem.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      total,
      take,
      skip,
      statusCounts: toStatusCounts(grouped),
    };
  }

  /**
   * Liefert ein Work Item mit Materialliste, aktiven Zuordnungen,
   * letzten Rückmeldungen, Prüfungen und Sessions.
   *
   * @param id - UUID des Work Items
   * @returns Item-Detail inkl. Foto-Dokument-IDs je Rückmeldung
   */
  async findOne(id: string) {
    const item = await this.prisma.workItem.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!item) {
      throw new NotFoundException('Work Item nicht gefunden');
    }

    const photos = await this.photosByReport(item.reports.map((r) => r.id));

    return {
      ...item,
      // Abgeleitetes UI-Flag: spart der Monteur-App die Prüfung auf
      // `block.pdfDocumentId` und bleibt stabil, falls die PDF-Quelle wächst.
      hasPdf: item.block?.pdfDocumentId != null,
      reports: item.reports.map((report) => ({
        ...report,
        photoDocumentIds: photos.get(report.id) ?? [],
      })),
    };
  }

  /** Materialzeilen eines Work Items. */
  async findMaterials(workItemId: string) {
    await this.ensureItem(workItemId);
    return this.prisma.workItemMaterial.findMany({
      where: { workItemId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ── Pflege (Büro) ────────────────────────────────────────────

  /**
   * Legt ein einzelnes Work Item an (Regelfall ist der Excel-Import).
   * Ein unbekannter blockKey wird automatisch als Block angelegt.
   *
   * @param projectId - UUID des Projekts
   * @param dto - Item-Daten
   * @returns Das angelegte Item (Detailansicht)
   */
  async create(projectId: string, dto: CreateWorkItemDto) {
    await this.ensureProject(projectId);
    const { blockKey, ...rest } = dto;
    const blockId = blockKey
      ? (await this.ensureBlock(projectId, blockKey)).id
      : null;

    const existing = await this.prisma.workItem.findUnique({
      where: { projectId_itemKey: { projectId, itemKey: dto.itemKey } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Item "${dto.itemKey}" existiert bereits in diesem Projekt`,
      );
    }

    const item = await this.prisma.workItem.create({
      data: { ...rest, projectId, blockId },
      select: { id: true },
    });
    return this.findOne(item.id);
  }

  /**
   * Aktualisiert die Metadaten eines Work Items (kein Statuswechsel).
   *
   * @param id - UUID des Work Items
   * @param dto - Zu ändernde Felder
   * @returns Das aktualisierte Item (Detailansicht)
   */
  async update(id: string, dto: UpdateWorkItemDto) {
    const item = await this.ensureItem(id);
    const { blockKey, ...rest } = dto;
    const blockId =
      blockKey === undefined
        ? undefined
        : blockKey
          ? (await this.ensureBlock(item.projectId, blockKey)).id
          : null;

    await this.prisma.workItem.update({
      where: { id },
      data: { ...rest, blockId },
    });
    return this.findOne(id);
  }

  /**
   * Ersetzt die Materialliste eines Work Items vollständig.
   *
   * @param id - UUID des Work Items
   * @param dto - Neue Materialzeilen
   * @returns Die neu angelegten Materialzeilen
   */
  async replaceMaterials(id: string, dto: ReplaceMaterialsDto) {
    await this.ensureItem(id);
    await this.prisma.$transaction([
      this.prisma.workItemMaterial.deleteMany({ where: { workItemId: id } }),
      this.prisma.workItemMaterial.createMany({
        data: dto.materials.map((line, index) => ({
          workItemId: id,
          sortOrder: line.sortOrder ?? index + 1,
          qty: line.qty,
          qtyUnit: line.qtyUnit,
          materialDe: line.materialDe,
          materialSk: line.materialSk,
        })),
      }),
    ]);
    return this.findMaterials(id);
  }

  /** Löscht ein Work Item samt Material, Zuordnungen, Sessions und Meldungen. */
  async remove(id: string) {
    await this.ensureItem(id);
    await this.prisma.workItem.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Worker-Sicht ─────────────────────────────────────────────

  /**
   * Items des angemeldeten Monteurs: eigene aktive Zuordnungen plus offene Items
   * der Projekte, denen der Monteur zugeordnet ist.
   *
   * @param workerId - UUID des Monteurs (aus dem Worker-Token)
   * @param projectId - Optional: auf ein Projekt einschränken
   * @returns mine (eigene Items), open (freier Pool) und die laufende Session
   */
  async findForWorker(workerId: string, projectId?: string) {
    const projectAssignments = await this.prisma.projectAssignment.findMany({
      where: {
        workerId,
        active: true,
        project: { deletedAt: null, itemBased: true },
        ...(projectId ? { projectId } : {}),
      },
      select: { projectId: true },
    });
    const projectIds = projectAssignments.map((a) => a.projectId);

    const [mine, open, activeSession] = await Promise.all([
      this.prisma.workItem.findMany({
        where: {
          assignments: { some: { workerId, active: true } },
          ...(projectId ? { projectId } : {}),
        },
        orderBy: [{ status: 'asc' }, { itemKey: 'asc' }],
        select: listSelect,
      }),
      projectIds.length > 0
        ? this.prisma.workItem.findMany({
            where: { projectId: { in: projectIds }, status: WorkItemStatus.OPEN },
            orderBy: [{ itemKey: 'asc' }],
            select: listSelect,
            take: 500,
          })
        : Promise.resolve([]),
      this.prisma.workItemSession.findFirst({
        where: { workerId, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          workItem: { select: { id: true, itemKey: true, title: true, projectId: true } },
        },
      }),
    ]);

    return { projectIds, mine, open, currentSession: activeSession };
  }

  /**
   * Item-Detail für die Monteur-App. Zugriff hat, wem das Item zugeordnet ist
   * oder wer dem Projekt des Items zugeordnet ist.
   *
   * @param id - UUID des Work Items
   * @param workerId - UUID des Monteurs (aus dem Worker-Token)
   */
  async findOneForWorker(id: string, workerId: string) {
    await this.assertWorkerItemAccess(id, workerId);
    return this.findOne(id);
  }

  /**
   * Stellt sicher, dass der Monteur dieses Item sehen darf: aktive Zuordnung
   * am Item **oder** aktive Zuordnung am Projekt des Items (konsistent zu
   * `claim` und `findOneForWorker`).
   *
   * @param id - UUID des Work Items
   * @param workerId - UUID des Monteurs (aus dem Worker-Token)
   * @returns Das Item (schlanke Projektion aus `ensureItem`)
   * @throws NotFoundException wenn das Item nicht existiert
   * @throws ForbiddenException wenn weder Item- noch Projektzuordnung besteht
   */
  async assertWorkerItemAccess(id: string, workerId: string) {
    const item = await this.ensureItem(id);
    const [itemAssignment, projectAssignment] = await Promise.all([
      this.prisma.workItemAssignment.findFirst({
        where: { workItemId: id, workerId, active: true },
        select: { id: true },
      }),
      this.prisma.projectAssignment.findFirst({
        where: { projectId: item.projectId, workerId, active: true },
        select: { id: true },
      }),
    ]);
    if (!itemAssignment && !projectAssignment) {
      throw new ForbiddenException('Kein Zugriff auf dieses Item');
    }
    return item;
  }

  /**
   * Ermittelt das Block-PDF, das der Monteur zu diesem Item öffnen darf.
   *
   * Bewusst eng: Die Dokument-ID kommt **ausschließlich** aus
   * `item.block.pdfDocumentId` – der Aufrufer kann keine Dokument-ID
   * mitgeben. Damit bleibt `/documents/:id/download` für Monteure zu und es
   * gibt keinen Weg, über dieses Item an fremde Dokumente zu kommen.
   * Einzelseiten je Item (SPEZ 10.2) sind noch nicht modelliert; solange es
   * dafür kein Feld gibt, bleibt es beim Block-PDF.
   *
   * @param id - UUID des Work Items
   * @param workerId - UUID des Monteurs (aus dem Worker-Token)
   * @returns Dokument-ID des Block-PDFs samt Kontext für Dateiname/Log
   * @throws NotFoundException wenn am Block kein PDF hinterlegt ist
   */
  async findWorkerPdf(
    id: string,
    workerId: string,
  ): Promise<{ documentId: string; itemKey: string; blockKey: string }> {
    await this.assertWorkerItemAccess(id, workerId);

    const item = await this.prisma.workItem.findUnique({
      where: { id },
      select: {
        itemKey: true,
        block: { select: { blockKey: true, pdfDocumentId: true } },
      },
    });
    if (!item?.block?.pdfDocumentId) {
      throw new NotFoundException('Kein PDF verknüpft');
    }
    return {
      documentId: item.block.pdfDocumentId,
      itemKey: item.itemKey,
      blockKey: item.block.blockKey,
    };
  }

  // ── Kunden-PL-Sicht ──────────────────────────────────────────

  /**
   * Board-Daten für den Kunden-PL. Prüft, dass der User dem Projekt
   * als CUSTOMER_PL zugeordnet ist (SUPERADMIN darf immer).
   *
   * @param projectId - UUID des Projekts
   * @param query - Filter wie in der Büro-Liste
   * @param user - Angemeldeter Benutzer (JWT)
   */
  async findForCustomerPl(
    projectId: string,
    query: ListWorkItemsQueryDto,
    user: AuthUser,
  ) {
    await this.assertCustomerPlAccess(projectId, user);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, projectNumber: true, title: true, itemBased: true },
    });
    const data = await this.findByProject(projectId, query);
    return { project, ...data };
  }

  /**
   * Item-Detail für den Kunden-PL (Zugriffsprüfung über das Projekt).
   *
   * @param id - UUID des Work Items
   * @param user - Angemeldeter Benutzer (JWT)
   */
  async findOneForCustomerPl(id: string, user: AuthUser) {
    const item = await this.ensureItem(id);
    await this.assertCustomerPlAccess(item.projectId, user);
    return this.findOne(id);
  }

  /**
   * Stellt sicher, dass der Benutzer den Kunden-PL-Zugriff auf das Projekt hat.
   *
   * @throws ForbiddenException wenn keine aktive Zuordnung existiert
   */
  async assertCustomerPlAccess(projectId: string, user: AuthUser): Promise<void> {
    if (user.type !== 'user') {
      throw new ForbiddenException('Kunden-PL-Zugriff erfordert einen Benutzer-Login');
    }
    if (user.roles.includes(RoleCode.SUPERADMIN)) {
      return;
    }
    const assignment = await this.prisma.projectCustomerPlAssignment.findFirst({
      where: { projectId, userId: user.id, active: true },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException('Kein Zugriff auf dieses Projekt');
    }
  }

  /**
   * Projekt-IDs, für die der Benutzer als Kunden-PL aktiv freigeschaltet ist.
   * Basis für projektbezogene Filter außerhalb dieses Moduls (z. B. Stundenzettel).
   *
   * @param user - Angemeldeter Benutzer (JWT)
   * @returns Projekt-IDs (leer, wenn keine Zuordnung besteht)
   */
  async findCustomerPlProjectIds(user: AuthUser): Promise<string[]> {
    if (user.type !== 'user') {
      throw new ForbiddenException('Kunden-PL-Zugriff erfordert einen Benutzer-Login');
    }
    const assignments = await this.prisma.projectCustomerPlAssignment.findMany({
      where: { userId: user.id, active: true, project: { deletedAt: null } },
      select: { projectId: true },
    });
    return assignments.map((a) => a.projectId);
  }

  /**
   * Prüft, ob ein Foto-Dokument zu diesem Item gehört und der Kunden-PL es
   * sehen darf. Erlaubt sind nur Dokumente, die am Item selbst oder an einer
   * seiner Rückmeldungen hängen – bewusst keine breite Dokumentfreigabe.
   *
   * @param itemId - UUID des Work Items
   * @param documentId - UUID des Dokuments
   * @param user - Angemeldeter Benutzer (JWT)
   * @throws ForbiddenException wenn das Projekt nicht zugewiesen ist
   * @throws NotFoundException wenn das Dokument nicht zu diesem Item gehört
   */
  async assertCustomerPlPhotoAccess(
    itemId: string,
    documentId: string,
    user: AuthUser,
  ): Promise<void> {
    const item = await this.ensureItem(itemId);
    await this.assertCustomerPlAccess(item.projectId, user);

    const reports = await this.prisma.workItemReport.findMany({
      where: { workItemId: itemId },
      select: { id: true },
    });
    const link = await this.prisma.documentLink.findFirst({
      where: {
        documentId,
        OR: [
          { entityType: 'WORK_ITEM', entityId: itemId },
          {
            entityType: 'WORK_ITEM_REPORT',
            entityId: { in: reports.map((r) => r.id) },
          },
        ],
      },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('Foto gehört nicht zu diesem Item');
    }
  }

  // ── Helfer ───────────────────────────────────────────────────

  /** Prüft die Existenz eines nicht gelöschten Projekts. */
  async ensureProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, projectNumber: true, itemBased: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
    return project;
  }

  /** Prüft die Existenz eines Work Items. */
  async ensureItem(id: string) {
    const item = await this.prisma.workItem.findUnique({
      where: { id },
      select: { id: true, projectId: true, itemKey: true, status: true },
    });
    if (!item) {
      throw new NotFoundException('Work Item nicht gefunden');
    }
    return item;
  }

  /** Legt einen Block bei Bedarf an (Import und manuelle Pflege). */
  async ensureBlock(projectId: string, blockKey: string) {
    return this.prisma.projectBlock.upsert({
      where: { projectId_blockKey: { projectId, blockKey } },
      update: {},
      create: { projectId, blockKey },
      select: { id: true, blockKey: true },
    });
  }

  /** Ermittelt die Foto-Dokument-IDs je Rückmeldung (DocumentLink). */
  private async photosByReport(reportIds: string[]) {
    const map = new Map<string, string[]>();
    if (reportIds.length === 0) return map;
    const links = await this.prisma.documentLink.findMany({
      where: { entityType: 'WORK_ITEM_REPORT', entityId: { in: reportIds } },
      select: { entityId: true, documentId: true },
    });
    for (const link of links) {
      const list = map.get(link.entityId) ?? [];
      list.push(link.documentId);
      map.set(link.entityId, list);
    }
    return map;
  }
}

/** "OPEN,REVIEW" → [OPEN, REVIEW]; unbekannte Werte werden ignoriert. */
function parseStatuses(value?: string): WorkItemStatus[] {
  if (!value) return [];
  const allowed = new Set(Object.values(WorkItemStatus));
  return value
    .split(',')
    .map((part) => part.trim().toUpperCase() as WorkItemStatus)
    .filter((part) => allowed.has(part));
}

/** groupBy-Ergebnis in ein vollständiges Status→Anzahl-Objekt überführen. */
function toStatusCounts(
  grouped: Array<{ status: WorkItemStatus; _count: { _all: number } }>,
): Record<WorkItemStatus, number> {
  const counts = Object.values(WorkItemStatus).reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<WorkItemStatus, number>,
  );
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  return counts;
}
