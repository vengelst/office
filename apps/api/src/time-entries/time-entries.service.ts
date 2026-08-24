/**
 * Service für Time Entries.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

import { ForbiddenException, Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import {
  DocumentType,
  GpsEventType,
  Prisma,
  RoleCode,
  TimeEntryType,
} from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { StoragePathService } from '../common/storage-path.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { WorkItemWorkflowService } from '../work-items/work-item-workflow.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { burnCommentIntoImage } from './photo-overlay';

/** Maximale Foto-Größe: 10 MB. */
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/** Projekt-Projektion inkl. Kunde für die Live-Übersicht. */
const projectSelect = {
  id: true,
  projectNumber: true,
  title: true,
  customer: { select: { id: true, companyName: true } },
} satisfies Prisma.ProjectSelect;

const workerSelect = {
  id: true,
  workerNumber: true,
  firstName: true,
  lastName: true,
  photoPath: true,
} satisfies Prisma.WorkerSelect;

/** Office-Rollen, die für beliebige Monteure stempeln / Status lesen dürfen. */
const STAMP_USER_ROLES: RoleCode[] = [
  RoleCode.SUPERADMIN,
  RoleCode.OFFICE,
  RoleCode.PROJECT_MANAGER,
];

/** Nur "echte" Stempel-Events bestimmen den Ein-/Ausgestempelt-Zustand. */
const CLOCK_TYPES: TimeEntryType[] = [
  TimeEntryType.CLOCK_IN,
  TimeEntryType.CLOCK_OUT,
];

export interface ClockStatus {
  clockedIn: boolean;
  since: Date | null;
  durationMinutes: number;
  project: { id: string; projectNumber: string; title: string } | null;
  timeEntryId: string | null;
}

/**
 * Service für die Zeiterfassung (Stempeluhr).
 * Verwaltet Ein-/Ausstempeln, Live-Übersicht, Foto-Uploads
 * und die Synchronisierung mit Google Drive.
 */
@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly storagePathService: StoragePathService,
    private readonly driveService: GoogleDriveService,
    private readonly workItemWorkflow: WorkItemWorkflowService,
  ) {}

  // ── Stempeln ─────────────────────────────────────────────────

  /**
   * Stempelt einen Monteur auf einem Projekt ein.
   * Prüft, dass der Monteur nicht bereits eingestempelt ist.
   * Erfasst optional GPS-Koordinaten als GpsEvent.
   *
   * @param dto - Monteur-ID, Projekt-ID, Zeitstempel, GPS-Daten
   * @param actor - Authentifizierter Benutzer/Worker
   * @returns Aktueller Stempel-Status des Monteurs
   */
  async clockIn(dto: ClockInDto, actor: AuthUser) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);
    await this.assertProject(dto.projectId);
    await this.assertProjectAssignment(dto.workerId, dto.projectId);

    // Idempotenter Replay: gleiche clientEventId → Status zurück, kein Insert.
    if (dto.clientEventId) {
      const existing = await this.findByClientEventId(dto.clientEventId);
      if (existing) {
        return this.getStatus(dto.workerId);
      }
    }

    const status = await this.getStatus(dto.workerId);
    if (status.clockedIn) {
      // Offline-Sync liefert IN nach, Server hat bereits IN:
      // gleiches Projekt → Idempotent-OK; anderes Projekt → Konflikt.
      if (dto.clientEventId && status.project?.id === dto.projectId) {
        return status;
      }
      if (dto.clientEventId && status.project?.id !== dto.projectId) {
        throw new ConflictException(
          'Monteur ist bereits auf einem anderen Projekt eingestempelt',
        );
      }
      throw new ConflictException('Monteur ist bereits eingestempelt');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    try {
      const entry = await this.prisma.timeEntry.create({
        data: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          entryType: TimeEntryType.CLOCK_IN,
          occurredAtClient,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          comment: dto.comment,
          sourceDevice: dto.sourceDevice,
          clientEventId: dto.clientEventId ?? null,
          createdByUserId: actor.type === 'user' ? actor.id : null,
        },
      });

      await this.maybeRecordGps(
        entry.id,
        dto,
        GpsEventType.CLOCK_IN,
        dto.projectId,
      );

      return this.getStatus(dto.workerId);
    } catch (err) {
      // Race: paralleler Retry mit gleicher clientEventId → Unique-Violation → Replay.
      if (dto.clientEventId && isUniqueClientEventConflict(err)) {
        return this.getStatus(dto.workerId);
      }
      throw err;
    }
  }

  /**
   * Stempelt einen Monteur aus (beendet die aktive Schicht).
   * Berechnet die Brutto-Arbeitsminuten seit dem letzten Clock-In.
   *
   * @param dto - Monteur-ID, Zeitstempel, GPS-Daten
   * @param actor - Authentifizierter Benutzer/Worker
   * @returns Stempel-Status mit Brutto-Minuten der Schicht
   */
  async clockOut(dto: ClockOutDto, actor: AuthUser) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    // Idempotenter Replay: gleiche clientEventId → Status zurück, kein Insert.
    if (dto.clientEventId) {
      const existing = await this.findByClientEventId(dto.clientEventId);
      if (existing) {
        const status = await this.getStatus(dto.workerId);
        return { ...status, lastGrossMinutes: 0, closedItemSessions: 0 };
      }
    }

    const open = await this.getOpenClockIn(dto.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    try {
      const entry = await this.prisma.timeEntry.create({
        data: {
          workerId: dto.workerId,
          projectId: open.projectId,
          entryType: TimeEntryType.CLOCK_OUT,
          occurredAtClient,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          comment: dto.comment,
          sourceDevice: dto.sourceDevice,
          clientEventId: dto.clientEventId ?? null,
          createdByUserId: actor.type === 'user' ? actor.id : null,
        },
      });

      await this.maybeRecordGps(
        entry.id,
        dto,
        GpsEventType.CLOCK_OUT,
        open.projectId,
      );

      // Item-Zeit läuft nicht über Nacht weiter (SPEZ-arbeitsitems.md Abschnitt 5.1):
      // offene Item-Sessions enden mit dem Ausstempeln, die Zuordnung bleibt bestehen.
      const closedItemSessions =
        await this.workItemWorkflow.closeOpenSessionsForWorker(
          dto.workerId,
          occurredAtClient,
        );

      const grossMinutes = diffMinutes(
        open.occurredAtClient,
        occurredAtClient,
      );

      const status = await this.getStatus(dto.workerId);
      return { ...status, lastGrossMinutes: grossMinutes, closedItemSessions };
    } catch (err) {
      if (dto.clientEventId && isUniqueClientEventConflict(err)) {
        const status = await this.getStatus(dto.workerId);
        return { ...status, lastGrossMinutes: 0, closedItemSessions: 0 };
      }
      throw err;
    }
  }

  // ── Abfragen ─────────────────────────────────────────────────

  /**
   * Stempel-Status aller Monteure eines Projekts (für Kiosk-Übersicht).
   *
   * @param projectId - ID des Projekts (string)
   * @returns Status
   */
  async projectStatus(projectId: string) {
    await this.assertProject(projectId);

    const assignments = await this.prisma.projectAssignment.findMany({
      where: { projectId, active: true, worker: { active: true, deletedAt: null } },
      select: { worker: { select: workerSelect } },
    });

    const workers = assignments.map((a) => a.worker);
    const results: Array<{
      workerId: string;
      firstName: string;
      lastName: string;
      photoPath: string | null;
      clockedIn: boolean;
      since: Date | null;
    }> = [];

    for (const w of workers) {
      const status = await this.getStatus(w.id);
      results.push({
        workerId: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        photoPath: w.photoPath,
        clockedIn: status.clockedIn,
        since: status.since,
      });
    }

    return results;
  }

  /**
   * Aktueller Stempel-Status eines Monteurs.
   *
   * @param workerId - ID des Monteurs (string)
   * @param actor - Ausführender Akteur (Audit) (AuthUser)
   * @returns Status (ClockStatus)
   */
  async status(workerId: string, actor: AuthUser): Promise<ClockStatus> {
    this.assertOwnWorker(workerId, actor);
    return this.getStatus(workerId);
  }

  /**
   * Heutige Stempel-Einträge eines Monteurs.
   *
   * @param workerId - ID des Monteurs (string)
   * @param actor - Ausführender Akteur (Audit) (AuthUser)
   * @returns Liste der heutigen Einträge
   */
  async today(workerId: string, actor: AuthUser) {
    this.assertOwnWorker(workerId, actor);
    const start = startOfToday();
    return this.prisma.timeEntry.findMany({
      where: {
        workerId,
        entryType: { in: CLOCK_TYPES },
        occurredAtClient: { gte: start },
      },
      orderBy: { occurredAtClient: 'asc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        occurredAtServer: true,
        latitude: true,
        longitude: true,
        comment: true,
        project: { select: { id: true, projectNumber: true, title: true } },
      },
    });
  }

  /**
   * Alle aktuell eingestempelten Monteure (Live-Übersicht).
   *
   * @returns Live-Liste
   */
  async live() {
    const since = hoursAgo(48);
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        entryType: { in: CLOCK_TYPES },
        occurredAtClient: { gte: since },
        worker: { active: true, deletedAt: null },
      },
      orderBy: { occurredAtClient: 'desc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        latitude: true,
        longitude: true,
        worker: { select: workerSelect },
        project: { select: projectSelect },
      },
    });

    // Pro Monteur den letzten Stempel-Event ermitteln; nur eingestempelte zeigen.
    const seen = new Set<string>();
    const live: Array<{
      worker: (typeof entries)[number]['worker'];
      project: (typeof entries)[number]['project'];
      since: Date;
      durationMinutes: number;
      timeEntryId: string;
    }> = [];
    for (const e of entries) {
      if (seen.has(e.worker.id)) continue;
      seen.add(e.worker.id);
      if (e.entryType === TimeEntryType.CLOCK_IN) {
        live.push({
          worker: e.worker,
          project: e.project,
          since: e.occurredAtClient,
          durationMinutes: diffMinutes(e.occurredAtClient, new Date()),
          timeEntryId: e.id,
        });
      }
    }
    return live;
  }

  // ── Foto-Upload ──────────────────────────────────────────────

  /**
   * Lädt ein Baustellenfoto hoch, speichert es in MinIO und erstellt einen Dokumenteintrag.
   * Synchronisiert asynchron nach Google Drive mit Shortcut im Monteur-Ordner.
   *
   * @param file - Die Bilddatei (max. 10 MB)
   * @param dto - Monteur-ID, Projekt-ID, optionaler Kommentar
   * @param actor - Authentifizierter Benutzer/Worker
   * @returns Das erstellte Dokument mit Metadaten
   */
  async uploadPhoto(
    file: Express.Multer.File | undefined,
    dto: UploadPhotoDto,
    actor: AuthUser,
  ) {
    this.assertOwnWorker(dto.workerId, actor);
    if (!file) {
      throw new BadRequestException('Keine Datei übermittelt');
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new BadRequestException('Foto überschreitet 10 MB');
    }
    if (!/^image\//.test(file.mimetype)) {
      throw new BadRequestException('Nur Bilddateien erlaubt');
    }
    await this.assertWorker(dto.workerId);
    await this.assertProject(dto.projectId);

    const overlay = await burnCommentIntoImage(
      file.buffer,
      file.mimetype,
      dto.comment,
    );
    const uploadBuffer = overlay.buffer;
    const uploadMime = overlay.mimeType;
    const ext = uploadMime === 'image/jpeg' ? 'jpg' : extensionFor({ ...file, mimetype: uploadMime } as Express.Multer.File);
    const now = new Date();

    // Entity-Infos für lesbaren Dateinamen laden.
    const [projectInfo, workerInfo] = await Promise.all([
      this.storagePathService.getEntityInfo('PROJECT', dto.projectId),
      this.storagePathService.getEntityInfo('WORKER', dto.workerId),
    ]);

    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { firstName: true, lastName: true },
    });
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { title: true },
    });

    const readableFilename = this.storagePathService.buildSitePhotoFilename(
      project?.title ?? 'Projekt',
      worker?.lastName ?? 'Monteur',
      worker?.firstName ?? '',
      now,
      ext,
    );

    // Lesbarer MinIO-Pfad.
    const storagePath = `projekte/${projectInfo.slug}/baustellenfotos/${readableFilename}`;
    const storageKey = `documents/${storagePath}`;
    await this.storage.upload(storageKey, uploadBuffer, uploadMime);

    const doc = await this.prisma.document.create({
      data: {
        storageKey,
        storagePath,
        originalFilename: file.originalname || readableFilename,
        mimeType: uploadMime,
        fileSize: uploadBuffer.length,
        documentType: DocumentType.SITE_PHOTO,
        title: dto.comment?.trim() || 'Baustellenfoto',
        description: dto.comment,
        uploadedByUserId: actor.type === 'user' ? actor.id : null,
        links: {
          create: [
            { entityType: 'PROJECT', entityId: dto.projectId },
            { entityType: 'WORKER', entityId: dto.workerId },
          ],
        },
      },
      select: {
        id: true,
        storageKey: true,
        storagePath: true,
        originalFilename: true,
        documentType: true,
        title: true,
        description: true,
        createdAt: true,
        driveFileId: true,
        links: { select: { entityType: true, entityId: true } },
      },
    });

    // Google Drive Sync + Shortcut (async, non-blocking).
    this.syncPhotoToDrive(
      doc.id, uploadBuffer, uploadMime, readableFilename,
      projectInfo, workerInfo, dto.projectId, dto.workerId,
    ).catch((err) => this.logger.warn(`Drive-Foto-Sync übersprungen: ${(err as Error).message}`));

    return doc;
  }

  /**
   * Syncht ein Baustellenfoto nach Google Drive und erstellt einen Shortcut im Monteur-Ordner.
   */
  private async syncPhotoToDrive(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    filename: string,
    projectInfo: { slug: string; displayName: string; number: string },
    workerInfo: { slug: string; displayName: string; number: string },
    projectId: string,
    workerId: string,
  ): Promise<void> {
    const enabled = await this.driveService.isEnabled();
    if (!enabled) return;

    const projectFolderName = this.storagePathService.driveEntityFolderName('PROJECT', projectInfo);
    const result = await this.driveService.uploadWithStructure(
      buffer, mimeType,
      'Projekte', projectFolderName, 'Baustellenfotos', filename,
    );

    if (result) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { driveFileId: result.fileId, driveFolderId: result.folderId },
      });

      // Shortcut im Monteur-Fotos-Ordner.
      const workerFolderName = this.storagePathService.driveEntityFolderName('WORKER', workerInfo);
      const workerFotosFolderId = await this.driveService.ensureSubfolderStructure(
        'Monteure', workerFolderName, 'Fotos (Verknüpfungen)',
      );
      if (workerFotosFolderId) {
        await this.driveService.createShortcut(result.fileId, workerFotosFolderId);
      }
    }
  }

  // ── intern ───────────────────────────────────────────────────

  /**
   * TimeEntry anhand clientEventId (Offline-Idempotenz).
   *
   * @param clientEventId - ID (clientEventId) (string)
   */
  private async findByClientEventId(clientEventId: string) {
    return this.prisma.timeEntry.findUnique({
      where: { clientEventId },
      select: { id: true, workerId: true, entryType: true },
    });
  }

  /**
   * Letzter Stempel-Event eines Monteurs (CLOCK_IN/CLOCK_OUT).
   *
   * @param workerId - ID des Monteurs (string)
   */
  private async getLatestClockEntry(workerId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { workerId, entryType: { in: CLOCK_TYPES } },
      orderBy: { occurredAtClient: 'desc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        projectId: true,
        latitude: true,
        longitude: true,
        project: { select: { id: true, projectNumber: true, title: true } },
      },
    });
  }

  /**
   * Offener Einstempel-Eintrag (falls aktuell eingestempelt), sonst null.
   *
   * @param workerId - ID des Monteurs (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private async getOpenClockIn(workerId: string) {
    const latest = await this.getLatestClockEntry(workerId);
    if (latest && latest.entryType === TimeEntryType.CLOCK_IN) {
      return latest;
    }
    return null;
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `getStatus` (get Status).
   *
   * @param workerId - ID des Monteurs (string)
   * @returns ClockStatus
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private async getStatus(workerId: string): Promise<ClockStatus> {
    const latest = await this.getLatestClockEntry(workerId);
    if (!latest || latest.entryType !== TimeEntryType.CLOCK_IN) {
      return {
        clockedIn: false,
        since: null,
        durationMinutes: 0,
        project: null,
        timeEntryId: null,
      };
    }
    return {
      clockedIn: true,
      since: latest.occurredAtClient,
      durationMinutes: diffMinutes(latest.occurredAtClient, new Date()),
      project: latest.project,
      timeEntryId: latest.id,
    };
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `maybeRecordGps` (maybe Record Gps).
   *
   * @param timeEntryId - ID (timeEntryId) (string)
   * @param dto - Request-Body / Eingabedaten (ClockInDto | ClockOutDto)
   * @param eventType - Parameter `eventType` (GpsEventType)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private async maybeRecordGps(
    timeEntryId: string,
    dto: ClockInDto | ClockOutDto,
    eventType: GpsEventType,
    projectId?: string | null,
  ): Promise<void> {
    if (dto.latitude === undefined || dto.longitude === undefined) return;
    await this.prisma.gpsEvent.create({
      data: {
        workerId: dto.workerId,
        projectId: projectId ?? null,
        relatedTimeEntryId: timeEntryId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        recordedAt: coerceDate(dto.occurredAtClient),
        eventType,
      },
    });
  }

  /**
   * GPS-Ereignisse für die Stempeluhr-Übersicht (Büro).
   */
  async listGpsEvents(params: {
    from?: string;
    to?: string;
    workerId?: string;
    projectId?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(params.limit ?? 200, 1), 500);
    const recordedAt: { gte?: Date; lte?: Date } = {};
    if (params.from) recordedAt.gte = new Date(params.from);
    if (params.to) recordedAt.lte = new Date(params.to);

    const rows = await this.prisma.gpsEvent.findMany({
      where: {
        ...(Object.keys(recordedAt).length ? { recordedAt } : {}),
        ...(params.workerId ? { workerId: params.workerId } : {}),
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take,
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, photoPath: true },
        },
        project: {
          select: { id: true, title: true, projectNumber: true },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      recordedAt: r.recordedAt,
      eventType: r.eventType,
      latitude: r.latitude,
      longitude: r.longitude,
      accuracy: r.accuracy,
      worker: r.worker,
      project: r.project,
    }));
  }

  /**
   * Stempel-/Status-Zugriff: Worker nur für die eigene ID; User nur mit
   * SUPERADMIN / OFFICE / PROJECT_MANAGER. CUSTOMER_PL und andere Rollen: nein.
   *
   * @param workerId - Ziel-Monteur
   * @param actor - JWT-Akteur
   * @throws {ForbiddenException} Wenn die Berechtigung fehlt
   */
  private assertOwnWorker(workerId: string, actor: AuthUser): void {
    if (actor.type === 'worker') {
      if (actor.id !== workerId) {
        throw new ForbiddenException('Nur eigene Stempelungen erlaubt');
      }
      return;
    }

    const allowed = actor.roles.some((role) =>
      STAMP_USER_ROLES.includes(role as RoleCode),
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Keine Berechtigung für Stempelungen anderer Monteure',
      );
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `assertWorker` (assert Worker).
   *
   * @param workerId - ID des Monteurs (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async assertWorker(workerId: string): Promise<void> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
  }

  /**
   * Clock-In nur mit aktiver Projektzuweisung im Datumsfenster.
   * Master-Monteure dürfen jedes Projekt ohne Zuweisung stempeln.
   */
  private async assertProjectAssignment(
    workerId: string,
    projectId: string,
  ): Promise<void> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, active: true, deletedAt: null },
      select: { masterEngineer: true },
    });
    if (worker?.masterEngineer) {
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const assignment = await this.prisma.projectAssignment.findFirst({
      where: {
        workerId,
        projectId,
        active: true,
        startDate: { lte: endOfToday },
        OR: [{ endDate: null }, { endDate: { gte: startOfToday } }],
      },
      select: { id: true },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Keine gültige Projektzuweisung für diesen Monteur (oder Zuweisung beginnt erst später)',
      );
    }
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `assertProject` (assert Project).
   *
   * @param projectId - ID des Projekts (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }
  }
}

// ── Hilfsfunktionen ────────────────────────────────────────────

function coerceDate(value?: string): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function diffMinutes(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * Ermittelt eine sichere Dateiendung aus Originalname oder MIME-Type.
 *
 * @param file - Multer-Upload
 * @returns Kleinbuchstabige Dateiendung (Fallback: `jpg`)
 */
function extensionFor(file: Express.Multer.File): string {
  const fromName = file.originalname?.split('.').pop();
  if (fromName && /^[a-zA-Z0-9]{1,5}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromMime = file.mimetype.split('/').pop();
  return (fromMime && /^[a-zA-Z0-9]{1,5}$/.test(fromMime) ? fromMime : 'jpg').toLowerCase();
}

/**
 * Prüft auf Prisma-Unique-Konflikt an `clientEventId` (paralleler Offline-Retry).
 *
 * @param err - Unbekannter Fehlerwert
 * @returns true, wenn P2002 auf clientEventId vorliegt
 */
function isUniqueClientEventConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('clientEventId')
  );
}
