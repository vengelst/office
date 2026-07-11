import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  GpsEventType,
  Prisma,
  TimeEntryType,
} from '@prisma/client';
import { AuthUser } from '@office/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { StoragePathService } from '../common/storage-path.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';

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

    const status = await this.getStatus(dto.workerId);
    if (status.clockedIn) {
      throw new ConflictException('Monteur ist bereits eingestempelt');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
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
        createdByUserId: actor.type === 'user' ? actor.id : null,
      },
    });

    await this.maybeRecordGps(entry.id, dto, GpsEventType.CLOCK_IN);

    return this.getStatus(dto.workerId);
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

    const open = await this.getOpenClockIn(dto.workerId);
    if (!open) {
      throw new ConflictException('Monteur ist nicht eingestempelt');
    }

    const occurredAtClient = coerceDate(dto.occurredAtClient);
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
        createdByUserId: actor.type === 'user' ? actor.id : null,
      },
    });

    await this.maybeRecordGps(entry.id, dto, GpsEventType.CLOCK_OUT);

    const grossMinutes = diffMinutes(
      open.occurredAtClient,
      occurredAtClient,
    );

    const status = await this.getStatus(dto.workerId);
    return { ...status, lastGrossMinutes: grossMinutes };
  }

  // ── Abfragen ─────────────────────────────────────────────────

  /** Stempel-Status aller Monteure eines Projekts (für Kiosk-Übersicht). */
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

  /** Aktueller Stempel-Status eines Monteurs. */
  async status(workerId: string, actor: AuthUser): Promise<ClockStatus> {
    this.assertOwnWorker(workerId, actor);
    return this.getStatus(workerId);
  }

  /** Heutige Stempel-Einträge eines Monteurs. */
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

  /** Alle aktuell eingestempelten Monteure (Live-Übersicht). */
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

    const ext = extensionFor(file);
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
    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const doc = await this.prisma.document.create({
      data: {
        storageKey,
        storagePath,
        originalFilename: file.originalname || readableFilename,
        mimeType: file.mimetype,
        fileSize: file.size,
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
      doc.id, file.buffer, file.mimetype, readableFilename,
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

  /** Letzter Stempel-Event eines Monteurs (CLOCK_IN/CLOCK_OUT). */
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

  /** Offener Einstempel-Eintrag (falls aktuell eingestempelt), sonst null. */
  private async getOpenClockIn(workerId: string) {
    const latest = await this.getLatestClockEntry(workerId);
    if (latest && latest.entryType === TimeEntryType.CLOCK_IN) {
      return latest;
    }
    return null;
  }

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

  private async maybeRecordGps(
    timeEntryId: string,
    dto: ClockInDto | ClockOutDto,
    eventType: GpsEventType,
  ): Promise<void> {
    if (dto.latitude === undefined || dto.longitude === undefined) return;
    await this.prisma.gpsEvent.create({
      data: {
        workerId: dto.workerId,
        relatedTimeEntryId: timeEntryId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        recordedAt: coerceDate(dto.occurredAtClient),
        eventType,
      },
    });
  }

  private assertOwnWorker(workerId: string, actor: AuthUser): void {
    if (actor.type === 'worker' && actor.id !== workerId) {
      throw new ForbiddenException('Nur eigene Stempelungen erlaubt');
    }
  }

  private async assertWorker(workerId: string): Promise<void> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
  }

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

function extensionFor(file: Express.Multer.File): string {
  const fromName = file.originalname?.split('.').pop();
  if (fromName && /^[a-zA-Z0-9]{1,5}$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  const fromMime = file.mimetype.split('/').pop();
  return (fromMime && /^[a-zA-Z0-9]{1,5}$/.test(fromMime) ? fromMime : 'jpg').toLowerCase();
}
