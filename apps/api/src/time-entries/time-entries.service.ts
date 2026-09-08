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
import { BreakDto } from './dto/break.dto';
import { ManualEntryDto, UpdateEntryDto } from './dto/manual-entry.dto';
import { burnCommentIntoImage } from './photo-overlay';
import {
  berlinDateKey,
  berlinDayRange,
  effectiveBreakMinutes,
  grossMinutesFromClocks,
  isoWeekRangeBerlin,
  type StempelEvent,
} from './break-calc.util';
import {
  selectBreakRule,
  isoWeekOf,
} from '../timesheets/timesheet.util';
import {
  STAMP_LOCKED_MESSAGE,
  STAMP_LOCKED_STATUSES,
} from '../timesheets/timesheet-shared';
import { TimesheetGenerationService } from '../timesheets/timesheet-generation.service';
import { WorkDocumentationDto } from './dto/work-documentation.dto';
import { validateWorkDocumentation } from './work-documentation.util';
import { isActivityTrackingRequired } from './activity-gate.util';

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
  project: {
    id: string;
    projectNumber: string;
    title: string;
    /** Für UI-Gate Tätigkeits-Select (#34). */
    billingMode?: string | null;
  } | null;
  timeEntryId: string | null;
  /** Pause aktiv (BREAK_START ohne BREAK_END seit offenem CLOCK_IN). */
  onBreak: boolean;
  breakStartedAt: Date | null;
  currentActivity: {
    id: string;
    code: string;
    name: string;
    segmentId: string;
    startedAt: Date;
  } | null;
  /**
   * Ausstehende Arbeitsdokumentation nach Clock-Out (Auftrag #30).
   * null wenn nichts offen.
   */
  pendingWorkDocumentation: PendingWorkDocumentation | null;
}

export interface PendingWorkDocumentation {
  timeEntryId: string;
  projectId: string;
  workNotesEnabled: boolean;
  workActivities: Array<{ id: string; label: string }>;
  /** true wenn keine Tätigkeiten und Freitext aus – Büro muss konfigurieren. */
  configurationError: boolean;
}

export interface ClockOutResult extends ClockStatus {
  lastGrossMinutes: number;
  closedItemSessions: number;
  workDocumentationRequired: boolean;
  workNotesEnabled: boolean;
  workActivities: Array<{ id: string; label: string }>;
  /** ID des CLOCK_OUT-Eintrags (für POST …/work-documentation). */
  clockOutTimeEntryId: string | null;
}

export type OverviewRowStatus =
  | 'CLOCKED_IN'
  | 'ON_BREAK'
  | 'CLOCKED_OUT'
  | 'NO_ENTRIES';

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
    private readonly timesheetGeneration: TimesheetGenerationService,
  ) {}

  // ── Stempeln ─────────────────────────────────────────────────

  /**
   * Stellt sicher, dass für die ISO-KW(en) der Stempelzeit(en) ein Stundenzettel existiert.
   * Mehrere Zeitpunkte (z. B. In Sonntag / Out Montag) → alle betroffenen KW.
   */
  private async syncTimesheetsForStamp(
    workerId: string,
    projectId: string,
    ...ats: Date[]
  ): Promise<void> {
    const seen = new Set<string>();
    for (const at of ats) {
      const dateKey = berlinDateKey(at);
      const day = berlinDayRange(dateKey).from;
      const { weekYear, weekNumber } = isoWeekOf(day);
      const key = `${weekYear}-W${weekNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await this.timesheetGeneration.ensureForStamp({
        workerId,
        projectId,
        at,
      });
    }
  }
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
    await this.assertStampAllowed(
      dto.workerId,
      dto.projectId,
      occurredAtClient,
    );
    const workerMeta = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { masterEngineer: true },
    });
    const projectBilling = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
      select: { billingMode: true },
    });
    const activityRequired = isActivityTrackingRequired(
      !!workerMeta?.masterEngineer,
      projectBilling?.billingMode,
    );
    if (activityRequired) {
      if (!dto.activityTypeId) {
        throw new BadRequestException(
          workerMeta?.masterEngineer
            ? 'Master-Monteur: Tätigkeitsbereich ist Pflicht'
            : 'Tätigkeitsbereich ist Pflicht (stundenbasiertes Projekt)',
        );
      }
      await this.assertActiveActivityType(dto.activityTypeId);
    }

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

      if (activityRequired && dto.activityTypeId) {
        await this.prisma.timeActivitySegment.create({
          data: {
            workerId: dto.workerId,
            projectId: dto.projectId,
            activityTypeId: dto.activityTypeId,
            startedAt: occurredAtClient,
          },
        });
      }

      await this.syncTimesheetsForStamp(
        dto.workerId,
        dto.projectId,
        occurredAtClient,
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
  async clockOut(dto: ClockOutDto, actor: AuthUser): Promise<ClockOutResult> {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    // Idempotenter Replay: gleiche clientEventId → Status zurück, kein Insert.
    if (dto.clientEventId) {
      const existing = await this.findByClientEventId(dto.clientEventId);
      if (existing) {
        const status = await this.getStatus(dto.workerId);
        const pending = status.pendingWorkDocumentation;
        return {
          ...status,
          lastGrossMinutes: 0,
          closedItemSessions: 0,
          workDocumentationRequired: !!pending,
          workNotesEnabled: pending?.workNotesEnabled ?? true,
          workActivities: pending?.workActivities ?? [],
          clockOutTimeEntryId: pending?.timeEntryId ?? existing.id,
        };
      }
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    try {
      const open = await this.getOpenClockIn(dto.workerId);
      if (open) {
        await this.assertStampAllowed(
          dto.workerId,
          open.projectId,
          occurredAtClient,
        );
      }
      return await this.performClockOut({
        workerId: dto.workerId,
        occurredAtClient,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        comment: dto.comment,
        sourceDevice: dto.sourceDevice,
        clientEventId: dto.clientEventId ?? null,
        createdByUserId: actor.type === 'user' ? actor.id : null,
      });
    } catch (err) {
      if (dto.clientEventId && isUniqueClientEventConflict(err)) {
        const status = await this.getStatus(dto.workerId);
        const pending = status.pendingWorkDocumentation;
        return {
          ...status,
          lastGrossMinutes: 0,
          closedItemSessions: 0,
          workDocumentationRequired: !!pending,
          workNotesEnabled: pending?.workNotesEnabled ?? true,
          workActivities: pending?.workActivities ?? [],
          clockOutTimeEntryId: pending?.timeEntryId ?? null,
        };
      }
      throw err;
    }
  }

  /**
   * Systemseitiges Ausstempeln (Auto-Clock-Out Cron).
   * Kein Actor-/PIN-Check – nur intern aus dem Cron/Admin-Run aufrufen.
   */
  async systemClockOut(params: {
    workerId: string;
    occurredAtClient: Date;
    comment: string;
    sourceDevice: string;
  }): Promise<ClockOutResult> {
    await this.assertWorker(params.workerId);
    return this.performClockOut({
      workerId: params.workerId,
      occurredAtClient: params.occurredAtClient,
      comment: params.comment,
      sourceDevice: params.sourceDevice,
      clientEventId: null,
      createdByUserId: null,
    });
  }

  /**
   * Gemeinsamer Schließpfad: offene Pause, CLOCK_OUT, Segmente, Item-Sessions.
   * workDocumentedAt bleibt null (Pending Arbeitsdoku #30).
   */
  private async performClockOut(params: {
    workerId: string;
    occurredAtClient: Date;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    comment?: string | null;
    sourceDevice?: string | null;
    clientEventId?: string | null;
    createdByUserId?: string | null;
  }): Promise<ClockOutResult> {
    const open = await this.getOpenClockIn(params.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }

    const occurredAtClient = params.occurredAtClient;

    // Pause während Clock-Out automatisch schließen (Auftrag #23).
    const openBreakForOut = await this.getOpenBreakStart(
      params.workerId,
      open.occurredAtClient,
    );
    if (openBreakForOut) {
      const breakEndAt = new Date(occurredAtClient.getTime() - 1);
      await this.prisma.timeEntry.create({
        data: {
          workerId: params.workerId,
          projectId: open.projectId,
          entryType: TimeEntryType.BREAK_END,
          occurredAtClient: breakEndAt,
          comment: 'Automatisch beendet vor Ausstempeln',
          sourceDevice: params.sourceDevice ?? null,
          createdByUserId: params.createdByUserId ?? null,
        },
      });
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        workerId: params.workerId,
        projectId: open.projectId,
        entryType: TimeEntryType.CLOCK_OUT,
        occurredAtClient,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy,
        comment: params.comment ?? null,
        sourceDevice: params.sourceDevice ?? null,
        clientEventId: params.clientEventId ?? null,
        createdByUserId: params.createdByUserId ?? null,
        // workDocumentedAt bleibt null → Pending bis Doku gespeichert
        workDocumentedAt: null,
      },
    });

    if (params.latitude != null && params.longitude != null) {
      await this.maybeRecordGps(
        entry.id,
        {
          workerId: params.workerId,
          occurredAtClient: occurredAtClient.toISOString(),
          latitude: params.latitude,
          longitude: params.longitude,
          accuracy: params.accuracy,
        } as ClockOutDto,
        GpsEventType.CLOCK_OUT,
        open.projectId,
      );
    }

    await this.closeOpenActivitySegment(params.workerId, occurredAtClient);

    // Item-Zeit läuft nicht über Nacht weiter (SPEZ-arbeitsitems.md Abschnitt 5.1):
    // offene Item-Sessions enden mit dem Ausstempeln, die Zuordnung bleibt bestehen.
    const closedItemSessions =
      await this.workItemWorkflow.closeOpenSessionsForWorker(
        params.workerId,
        occurredAtClient,
      );

    const grossMinutes = diffMinutes(open.occurredAtClient, occurredAtClient);

    await this.syncTimesheetsForStamp(
      params.workerId,
      open.projectId,
      open.occurredAtClient,
      occurredAtClient,
    );

    const workMeta = await this.loadProjectWorkMeta(open.projectId);
    const status = await this.getStatus(params.workerId);
    return {
      ...status,
      lastGrossMinutes: grossMinutes,
      closedItemSessions,
      workDocumentationRequired: true,
      workNotesEnabled: workMeta.workNotesEnabled,
      workActivities: workMeta.workActivities,
      clockOutTimeEntryId: entry.id,
      pendingWorkDocumentation: {
        timeEntryId: entry.id,
        projectId: open.projectId,
        workNotesEnabled: workMeta.workNotesEnabled,
        workActivities: workMeta.workActivities,
        configurationError: workMeta.configurationError,
      },
    };
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
      {
        xNorm: dto.commentX,
        yNorm: dto.commentY,
      },
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
        title: 'Baustellenfoto',
        description: dto.comment?.trim() || null,
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

    if (dto.latitude != null && dto.longitude != null) {
      const open = await this.getOpenClockIn(dto.workerId);
      await this.prisma.gpsEvent.create({
        data: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          relatedTimeEntryId: open?.id ?? null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          recordedAt: now,
          eventType: GpsEventType.PHOTO,
        },
      });
    }

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
        project: {
          select: {
            id: true,
            projectNumber: true,
            title: true,
            billingMode: true,
          },
        },
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
    const pending = await this.findPendingWorkDocumentation(workerId);
    const latest = await this.getLatestClockEntry(workerId);
    if (!latest || latest.entryType !== TimeEntryType.CLOCK_IN) {
      return {
        clockedIn: false,
        since: null,
        durationMinutes: 0,
        project: null,
        timeEntryId: null,
        onBreak: false,
        breakStartedAt: null,
        currentActivity: null,
        pendingWorkDocumentation: pending,
      };
    }
    const openBreak = await this.getOpenBreakStart(
      workerId,
      latest.occurredAtClient,
    );
    const openSeg = await this.prisma.timeActivitySegment.findFirst({
      where: { workerId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        activityType: { select: { id: true, code: true, name: true } },
      },
    });
    return {
      clockedIn: true,
      since: latest.occurredAtClient,
      durationMinutes: diffMinutes(latest.occurredAtClient, new Date()),
      project: latest.project,
      timeEntryId: latest.id,
      onBreak: !!openBreak,
      breakStartedAt: openBreak?.occurredAtClient ?? null,
      currentActivity: openSeg
        ? {
            id: openSeg.activityType.id,
            code: openSeg.activityType.code,
            name: openSeg.activityType.name,
            segmentId: openSeg.id,
            startedAt: openSeg.startedAt,
          }
        : null,
      pendingWorkDocumentation: pending,
    };
  }

  private async loadProjectWorkMeta(projectId: string): Promise<{
    workNotesEnabled: boolean;
    workActivities: Array<{ id: string; label: string }>;
    configurationError: boolean;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workNotesEnabled: true,
        workActivities: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, label: true },
        },
      },
    });
    const workNotesEnabled = project?.workNotesEnabled ?? true;
    const workActivities = project?.workActivities ?? [];
    return {
      workNotesEnabled,
      workActivities,
      configurationError: workActivities.length === 0 && !workNotesEnabled,
    };
  }

  private async findPendingWorkDocumentation(
    workerId: string,
  ): Promise<PendingWorkDocumentation | null> {
    const pending = await this.prisma.timeEntry.findFirst({
      where: {
        workerId,
        entryType: TimeEntryType.CLOCK_OUT,
        workDocumentedAt: null,
      },
      orderBy: { occurredAtClient: 'desc' },
      select: { id: true, projectId: true },
    });
    if (!pending) return null;
    const meta = await this.loadProjectWorkMeta(pending.projectId);
    return {
      timeEntryId: pending.id,
      projectId: pending.projectId,
      workNotesEnabled: meta.workNotesEnabled,
      workActivities: meta.workActivities,
      configurationError: meta.configurationError,
    };
  }

  /**
   * Speichert Arbeitsdokumentation nach Clock-Out (Checkboxen + optional Freitext).
   */
  async saveWorkDocumentation(
    timeEntryId: string,
    dto: WorkDocumentationDto,
    actor: AuthUser,
  ) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      select: {
        id: true,
        workerId: true,
        projectId: true,
        entryType: true,
        occurredAtClient: true,
        workDocumentedAt: true,
      },
    });
    if (!entry) {
      throw new NotFoundException('Stempel-Eintrag nicht gefunden');
    }
    if (entry.entryType !== TimeEntryType.CLOCK_OUT) {
      throw new BadRequestException(
        'Arbeitsdokumentation nur für Ausstempel-Einträge',
      );
    }
    this.assertOwnWorker(entry.workerId, actor);

    if (entry.workDocumentedAt) {
      // Idempotent: bereits dokumentiert → aktuellen Stand zurück
      return this.getWorkDocumentationView(entry.id);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: entry.projectId },
      select: {
        workNotesEnabled: true,
        workActivities: {
          select: { id: true, active: true },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }

    const allowedIds = new Set(project.workActivities.map((a) => a.id));
    const requested = dto.projectWorkActivityIds ?? [];
    for (const id of requested) {
      if (!allowedIds.has(id)) {
        throw new BadRequestException(
          `Arbeitstätigkeit gehört nicht zu diesem Projekt: ${id}`,
        );
      }
    }

    const activeCount = project.workActivities.filter((a) => a.active).length;
    const validated = validateWorkDocumentation({
      workNotesEnabled: project.workNotesEnabled,
      activeActivityCount: activeCount,
      projectWorkActivityIds: requested,
      workNotes: dto.workNotes,
    });
    if (!validated.ok) {
      throw new BadRequestException(validated.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.timeEntryWorkActivity.deleteMany({
        where: { timeEntryId: entry.id },
      });
      if (validated.activityIds.length > 0) {
        await tx.timeEntryWorkActivity.createMany({
          data: validated.activityIds.map((projectWorkActivityId) => ({
            timeEntryId: entry.id,
            projectWorkActivityId,
          })),
        });
      }
      await tx.timeEntry.update({
        where: { id: entry.id },
        data: {
          workNotes: validated.notes,
          workDocumentedAt: new Date(),
        },
      });
    });

    await this.syncDayWorkFromEntries(
      entry.workerId,
      entry.projectId,
      entry.occurredAtClient,
    );

    return this.getWorkDocumentationView(entry.id);
  }

  private async getWorkDocumentationView(timeEntryId: string) {
    return this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      select: {
        id: true,
        workNotes: true,
        workDocumentedAt: true,
        workActivities: {
          select: {
            projectWorkActivity: {
              select: { id: true, label: true },
            },
          },
        },
      },
    });
  }

  /**
   * Aggregiert dokumentierte CLOCK_OUT-Arbeiten auf den Wochen-Tageseintrag.
   */
  private async syncDayWorkFromEntries(
    workerId: string,
    projectId: string,
    at: Date,
  ): Promise<void> {
    const dateKey = berlinDateKey(at);
    const { from, to } = berlinDayRange(dateKey);
    const outs = await this.prisma.timeEntry.findMany({
      where: {
        workerId,
        projectId,
        entryType: TimeEntryType.CLOCK_OUT,
        occurredAtClient: { gte: from, lte: to },
        workDocumentedAt: { not: null },
      },
      include: {
        workActivities: {
          include: {
            projectWorkActivity: { select: { id: true, label: true } },
          },
        },
      },
    });

    const activityIds = [
      ...new Set(
        outs.flatMap((o) =>
          o.workActivities.map((l) => l.projectWorkActivity.id),
        ),
      ),
    ];
    const notes = outs
      .map((o) => o.workNotes?.trim())
      .filter((n): n is string => !!n && n.length > 0)
      .join(' · ');

    const { weekYear, weekNumber } = isoWeekOf(from);
    const sheet = await this.prisma.weeklyTimesheet.findUnique({
      where: {
        workerId_projectId_weekYear_weekNumber: {
          workerId,
          projectId,
          weekYear,
          weekNumber,
        },
      },
      select: { id: true, status: true, days: { select: { id: true, workDate: true } } },
    });
    if (!sheet || STAMP_LOCKED_STATUSES.includes(sheet.status)) return;

    const day = sheet.days.find((d) => berlinDateKey(d.workDate) === dateKey);
    if (!day) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.weeklyTimesheetDayWorkActivity.deleteMany({
        where: { dayId: day.id },
      });
      if (activityIds.length > 0) {
        await tx.weeklyTimesheetDayWorkActivity.createMany({
          data: activityIds.map((projectWorkActivityId) => ({
            dayId: day.id,
            projectWorkActivityId,
          })),
        });
      }
      await tx.weeklyTimesheetDay.update({
        where: { id: day.id },
        data: { workNotes: notes.length > 0 ? notes : null },
      });
    });
  }

  /**
   * Tätigkeit ohne Ausstempeln wechseln (schließt Segment, öffnet neues).
   * Erlaubt für Master immer; für Normal-Monteure nur bei HOURLY_PACKAGE (#34).
   */
  async switchActivity(
    dto: {
      workerId: string;
      activityTypeId: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      occurredAtClient?: string;
    },
    actor: AuthUser,
  ) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    const open = await this.getOpenClockIn(dto.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { masterEngineer: true },
    });
    const projectBilling = await this.prisma.project.findFirst({
      where: { id: open.projectId, deletedAt: null },
      select: { billingMode: true },
    });
    if (
      !isActivityTrackingRequired(
        !!worker?.masterEngineer,
        projectBilling?.billingMode,
      )
    ) {
      throw new ForbiddenException(
        'Tätigkeitswechsel nur für Master oder stundenbasierte Projekte',
      );
    }

    await this.assertActiveActivityType(dto.activityTypeId);
    const at = coerceDate(dto.occurredAtClient ?? new Date().toISOString());

    const current = await this.prisma.timeActivitySegment.findFirst({
      where: { workerId: dto.workerId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (current?.activityTypeId === dto.activityTypeId) {
      return this.getStatus(dto.workerId);
    }

    await this.closeOpenActivitySegment(dto.workerId, at);
    await this.prisma.timeActivitySegment.create({
      data: {
        workerId: dto.workerId,
        projectId: open.projectId,
        activityTypeId: dto.activityTypeId,
        startedAt: at,
      },
    });

    if (dto.latitude != null && dto.longitude != null) {
      await this.prisma.gpsEvent.create({
        data: {
          workerId: dto.workerId,
          projectId: open.projectId,
          relatedTimeEntryId: open.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          recordedAt: at,
          eventType: GpsEventType.ACTION,
        },
      });
    }

    return this.getStatus(dto.workerId);
  }

  private async closeOpenActivitySegment(
    workerId: string,
    endedAt: Date,
  ): Promise<void> {
    await this.prisma.timeActivitySegment.updateMany({
      where: { workerId, endedAt: null },
      data: { endedAt },
    });
  }

  private async assertActiveActivityType(id: string): Promise<void> {
    const row = await this.prisma.activityType.findFirst({
      where: { id, active: true },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException('Ungültiger oder inaktiver Tätigkeitsbereich');
    }
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
    dto: ClockInDto | ClockOutDto | BreakDto,
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
   * GPS-Punkt speichern (Intervall, Login, Logout, Foto, Aktion).
   * Intervall (MANUAL) nur bei offener Schicht; Login/Logout/Foto/Aktion immer.
   */
  async gpsPing(
    dto: {
      workerId: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      projectId?: string;
      eventType?: GpsEventType;
    },
    actor: AuthUser,
  ) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    const eventType = dto.eventType ?? GpsEventType.MANUAL;
    const allowed: GpsEventType[] = [
      GpsEventType.MANUAL,
      GpsEventType.LOGIN,
      GpsEventType.LOGOUT,
      GpsEventType.PHOTO,
      GpsEventType.ACTION,
    ];
    if (!allowed.includes(eventType)) {
      throw new BadRequestException('Ungültiger GPS-Ereignistyp');
    }

    const open = await this.getOpenClockIn(dto.workerId);
    if (eventType === GpsEventType.MANUAL && !open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }

    const projectId = dto.projectId ?? open?.projectId ?? null;
    const event = await this.prisma.gpsEvent.create({
      data: {
        workerId: dto.workerId,
        projectId,
        relatedTimeEntryId: open?.id ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        recordedAt: new Date(),
        eventType,
      },
    });
    return { id: event.id, recordedAt: event.recordedAt, eventType };
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

  // ── Pause (Auftrag #23) ──────────────────────────────────────

  /**
   * Startet eine Pause (nur bei offenem CLOCK_IN und ohne laufende Pause).
   */
  async breakStart(dto: BreakDto, actor: AuthUser) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    if (dto.clientEventId) {
      const existing = await this.findByClientEventId(dto.clientEventId);
      if (existing) return this.getStatus(dto.workerId);
    }

    const open = await this.getOpenClockIn(dto.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }
    if (await this.getOpenBreakStart(dto.workerId, open.occurredAtClient)) {
      throw new ConflictException('Pause läuft bereits');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    await this.assertStampAllowed(
      dto.workerId,
      open.projectId,
      occurredAtClient,
    );
    try {
      const entry = await this.prisma.timeEntry.create({
        data: {
          workerId: dto.workerId,
          projectId: open.projectId,
          entryType: TimeEntryType.BREAK_START,
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
        GpsEventType.ACTION,
        open.projectId,
      );
      return this.getStatus(dto.workerId);
    } catch (err) {
      if (dto.clientEventId && isUniqueClientEventConflict(err)) {
        return this.getStatus(dto.workerId);
      }
      throw err;
    }
  }

  /**
   * Beendet die laufende Pause.
   */
  async breakEnd(dto: BreakDto, actor: AuthUser) {
    this.assertOwnWorker(dto.workerId, actor);
    await this.assertWorker(dto.workerId);

    if (dto.clientEventId) {
      const existing = await this.findByClientEventId(dto.clientEventId);
      if (existing) return this.getStatus(dto.workerId);
    }

    const open = await this.getOpenClockIn(dto.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }
    if (!(await this.getOpenBreakStart(dto.workerId, open.occurredAtClient))) {
      throw new ConflictException('Keine laufende Pause');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    await this.assertStampAllowed(
      dto.workerId,
      open.projectId,
      occurredAtClient,
    );
    try {
      const entry = await this.prisma.timeEntry.create({
        data: {
          workerId: dto.workerId,
          projectId: open.projectId,
          entryType: TimeEntryType.BREAK_END,
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
        GpsEventType.ACTION,
        open.projectId,
      );
      return this.getStatus(dto.workerId);
    } catch (err) {
      if (dto.clientEventId && isUniqueClientEventConflict(err)) {
        return this.getStatus(dto.workerId);
      }
      throw err;
    }
  }

  /** Offener BREAK_START seit dem letzten CLOCK_IN, sonst null. */
  private async getOpenBreakStart(workerId: string, since: Date) {
    const events = await this.prisma.timeEntry.findMany({
      where: {
        workerId,
        occurredAtClient: { gte: since },
        entryType: {
          in: [TimeEntryType.BREAK_START, TimeEntryType.BREAK_END],
        },
      },
      orderBy: { occurredAtClient: 'asc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        projectId: true,
      },
    });
    let open: (typeof events)[number] | null = null;
    for (const e of events) {
      if (e.entryType === TimeEntryType.BREAK_START) open = e;
      else if (e.entryType === TimeEntryType.BREAK_END) open = null;
    }
    return open;
  }

  // ── Zeitraum-Übersicht / Timeline / Korrekturen ──────────────

  async overview(params: {
    date?: string;
    weekYear?: number;
    weekNumber?: number;
    projectId?: string;
    workerId?: string;
    teamId?: string;
  }) {
    let from: Date;
    let to: Date;
    if (params.weekYear != null && params.weekNumber != null) {
      const r = isoWeekRangeBerlin(params.weekYear, params.weekNumber);
      from = r.from;
      to = r.to;
    } else if (params.date) {
      const r = berlinDayRange(params.date);
      from = r.from;
      to = r.to;
    } else {
      throw new BadRequestException(
        'date oder weekYear+weekNumber erforderlich',
      );
    }
    if ((to.getTime() - from.getTime()) / 86_400_000 > 31.5) {
      throw new BadRequestException('Zeitraum max. 31 Tage');
    }

    let workerIds: string[] | undefined;
    if (params.workerId) {
      workerIds = [params.workerId];
    } else if (params.teamId) {
      const members = await this.prisma.workerTeamMember.findMany({
        where: { teamId: params.teamId, leftAt: null },
        select: { workerId: true },
      });
      workerIds = members.map((m) => m.workerId);
      if (workerIds.length === 0) {
        return { from: from.toISOString(), to: to.toISOString(), rows: [] };
      }
    }

    const workers = await this.prisma.worker.findMany({
      where: {
        deletedAt: null,
        ...(workerIds ? { id: { in: workerIds } } : {}),
      },
      select: {
        id: true,
        workerNumber: true,
        firstName: true,
        lastName: true,
        active: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        occurredAtClient: { gte: from, lte: to },
        ...(workerIds ? { workerId: { in: workerIds } } : {}),
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
      orderBy: { occurredAtClient: 'asc' },
      select: {
        workerId: true,
        projectId: true,
        entryType: true,
        occurredAtClient: true,
        project: {
          select: { id: true, projectNumber: true, title: true },
        },
      },
    });

    const rules = await this.prisma.breakRule.findMany({
      where: {
        active: true,
        OR: [
          { scopeType: 'GLOBAL' },
          { scopeType: 'PROJECT' },
        ],
      },
    });

    const byWorker = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byWorker.get(e.workerId) ?? [];
      list.push(e);
      byWorker.set(e.workerId, list);
    }

    const now = new Date();
    const until = to.getTime() > now.getTime() ? now : to;
    const rows = [];

    for (const w of workers) {
      const we = byWorker.get(w.id) ?? [];
      if (
        params.projectId &&
        !params.workerId &&
        !params.teamId &&
        we.length === 0
      ) {
        continue;
      }

      const events: StempelEvent[] = we.map((e) => ({
        entryType: e.entryType,
        occurredAtClient: e.occurredAtClient,
        projectId: e.projectId,
      }));
      const gross = grossMinutesFromClocks(events, until);
      const projectIds = [...new Set(we.map((e) => e.projectId))];
      const primaryRule = selectBreakRule(
        rules,
        projectIds[0] ?? params.projectId ?? '',
      );
      const breakInfo = effectiveBreakMinutes(
        events,
        gross,
        primaryRule,
        until,
      );

      const firstIn =
        we.find((e) => e.entryType === TimeEntryType.CLOCK_IN)
          ?.occurredAtClient ?? null;
      const outs = we.filter((e) => e.entryType === TimeEntryType.CLOCK_OUT);
      const lastOut = outs.length
        ? outs[outs.length - 1].occurredAtClient
        : null;

      const live = await this.getStatus(w.id);
      let status: OverviewRowStatus = 'NO_ENTRIES';
      if (we.length === 0) status = 'NO_ENTRIES';
      else if (live.onBreak) status = 'ON_BREAK';
      else if (live.clockedIn) status = 'CLOCKED_IN';
      else status = 'CLOCKED_OUT';

      const warnings: string[] = [];
      if (breakInfo.booked > 0 && breakInfo.booked < breakInfo.rule) {
        warnings.push('PAUSE_BELOW_RULE');
      }
      if (breakInfo.usedFallback && gross > 0) {
        warnings.push('BREAK_RULE_FALLBACK');
      }
      if (firstIn && !lastOut && !live.clockedIn) {
        warnings.push('MISSING_CLOCK_OUT');
      }
      if (gross > 10 * 60) warnings.push('OVER_10H');

      const projects = [];
      for (const pid of projectIds) {
        const pe = we.filter((e) => e.projectId === pid);
        const pEvents: StempelEvent[] = pe.map((e) => ({
          entryType: e.entryType,
          occurredAtClient: e.occurredAtClient,
          projectId: e.projectId,
        }));
        const pGross = grossMinutesFromClocks(pEvents, until);
        const pBreak = effectiveBreakMinutes(
          pEvents,
          pGross,
          selectBreakRule(rules, pid),
          until,
        );
        const meta = pe[0]?.project;
        if (!meta) continue;
        projects.push({
          id: meta.id,
          projectNumber: meta.projectNumber,
          title: meta.title,
          grossMinutes: pGross,
          netMinutes: Math.max(0, pGross - pBreak.effective),
        });
      }

      rows.push({
        worker: {
          id: w.id,
          workerNumber: w.workerNumber,
          firstName: w.firstName,
          lastName: w.lastName,
          active: w.active,
        },
        status,
        firstClockInAt: firstIn,
        lastClockOutAt: lastOut,
        grossMinutes: gross,
        breakBookedMinutes: breakInfo.booked,
        breakRuleMinutes: breakInfo.rule,
        netMinutes: Math.max(0, gross - breakInfo.effective),
        warnings,
        projects,
      });
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
    };
  }

  async timeline(workerId: string, date: string) {
    if (!date) {
      throw new BadRequestException('date (YYYY-MM-DD) erforderlich');
    }
    const { from, to } = berlinDayRange(date);
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Monteur nicht gefunden');

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        workerId,
        occurredAtClient: { gte: from, lte: to },
      },
      orderBy: { occurredAtClient: 'asc' },
      select: {
        id: true,
        entryType: true,
        occurredAtClient: true,
        occurredAtServer: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        comment: true,
        sourceDevice: true,
        clientEventId: true,
        createdByUserId: true,
        project: {
          select: { id: true, projectNumber: true, title: true },
        },
      },
    });

    const segments = await this.prisma.timeActivitySegment.findMany({
      where: {
        workerId,
        startedAt: { lte: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }],
      },
      orderBy: { startedAt: 'asc' },
      include: {
        activityType: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, projectNumber: true, title: true } },
      },
    });

    return {
      date,
      from: from.toISOString(),
      to: to.toISOString(),
      locked: await this.isDayLocked(workerId, date),
      entries,
      segments: segments.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        activityType: s.activityType,
        project: s.project,
      })),
    };
  }

  async createManual(dto: ManualEntryDto, actor: AuthUser) {
    if (actor.type !== 'user') {
      throw new ForbiddenException('Nur Büro darf manuell stempeln');
    }
    await this.assertProject(dto.projectId);
    const worker = await this.prisma.worker.findFirst({
      where: { id: dto.workerId, deletedAt: null },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Monteur nicht gefunden');

    const occurredAtClient = coerceDate(dto.occurredAtClient);
    await this.assertStampAllowed(
      dto.workerId,
      dto.projectId,
      occurredAtClient,
    );
    if (!dto.comment?.trim()) {
      throw new BadRequestException(
        'Kommentar bei manueller Korrektur Pflicht',
      );
    }

    const allowed: TimeEntryType[] = [
      TimeEntryType.CLOCK_IN,
      TimeEntryType.CLOCK_OUT,
      TimeEntryType.BREAK_START,
      TimeEntryType.BREAK_END,
      TimeEntryType.MANUAL_ADJUSTMENT,
    ];
    if (!allowed.includes(dto.entryType)) {
      throw new BadRequestException('Ungültiger entryType');
    }

    const created = await this.prisma.timeEntry.create({
      data: {
        workerId: dto.workerId,
        projectId: dto.projectId,
        entryType: dto.entryType,
        occurredAtClient,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        comment: dto.comment,
        sourceDevice: 'office-manual',
        createdByUserId: actor.id,
      },
    });

    if (
      dto.entryType === TimeEntryType.CLOCK_IN ||
      dto.entryType === TimeEntryType.CLOCK_OUT ||
      dto.entryType === TimeEntryType.BREAK_START ||
      dto.entryType === TimeEntryType.BREAK_END
    ) {
      await this.syncTimesheetsForStamp(
        dto.workerId,
        dto.projectId,
        occurredAtClient,
      );
    }

    return created;
  }

  async updateEntry(id: string, dto: UpdateEntryDto, actor: AuthUser) {
    if (actor.type !== 'user') {
      throw new ForbiddenException('Nur Büro darf korrigieren');
    }
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Eintrag nicht gefunden');

    const dateKey = berlinDateKey(entry.occurredAtClient);
    if (await this.isDayLocked(entry.workerId, dateKey, entry.projectId)) {
      throw new ConflictException(STAMP_LOCKED_MESSAGE);
    }
    if (dto.occurredAtClient && !dto.comment?.trim()) {
      throw new BadRequestException('Kommentar bei Zeitänderung Pflicht');
    }
    if (!dto.occurredAtClient && dto.comment === undefined) {
      throw new BadRequestException('Keine Änderung');
    }

    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(dto.occurredAtClient
          ? { occurredAtClient: coerceDate(dto.occurredAtClient) }
          : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        createdByUserId: actor.id,
      },
    });

    await this.syncTimesheetsForStamp(
      entry.workerId,
      entry.projectId,
      entry.occurredAtClient,
      updated.occurredAtClient,
    );

    return updated;
  }

  async deleteEntry(id: string, actor: AuthUser, comment: string) {
    if (actor.type !== 'user') {
      throw new ForbiddenException('Nur Büro darf löschen');
    }
    if (!comment?.trim()) {
      throw new BadRequestException('Kommentar beim Löschen Pflicht');
    }
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Eintrag nicht gefunden');

    const dateKey = berlinDateKey(entry.occurredAtClient);
    if (await this.isDayLocked(entry.workerId, dateKey, entry.projectId)) {
      throw new ConflictException(STAMP_LOCKED_MESSAGE);
    }

    await this.prisma.timeEntry.update({
      where: { id },
      data: {
        comment: `[GELÖSCHT] ${comment} | zuvor: ${entry.comment ?? ''}`,
        createdByUserId: actor.id,
      },
    });
    await this.prisma.timeEntry.delete({ where: { id } });

    await this.syncTimesheetsForStamp(
      entry.workerId,
      entry.projectId,
      entry.occurredAtClient,
    );

    return { ok: true };
  }

  /**
   * Sperrt Stempelungen, wenn für worker+project+ISO-KW ein Sheet in
   * STAMP_LOCKED_STATUSES existiert (ab Monteur-Unterschrift).
   */
  private async assertStampAllowed(
    workerId: string,
    projectId: string,
    at: Date,
  ): Promise<void> {
    const dateKey = berlinDateKey(at);
    if (await this.isDayLocked(workerId, dateKey, projectId)) {
      throw new ConflictException(STAMP_LOCKED_MESSAGE);
    }
  }

  private async isDayLocked(
    workerId: string,
    dateStr: string,
    projectId?: string,
  ): Promise<boolean> {
    const day = berlinDayRange(dateStr).from;
    const { weekYear, weekNumber } = isoWeekOf(day);
    const locked = await this.prisma.weeklyTimesheet.findFirst({
      where: {
        workerId,
        weekYear,
        weekNumber,
        ...(projectId ? { projectId } : {}),
        status: { in: STAMP_LOCKED_STATUSES },
      },
      select: { id: true },
    });
    return !!locked;
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
