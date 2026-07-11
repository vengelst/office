import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WorkerAvailability,
  WorkerType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { EmailService } from '../email/email.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

/** Profilbild: max. 5 MB, nur JPEG/PNG. */
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const PHOTO_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Vorlauf für Ablaufwarnungen (Tage). */
const EXPIRY_WINDOW_DAYS = 30;

/** Sortierbare Spalten der Monteur-Liste (DTO-Key → Prisma-Feld). */
const SORT_MAP: Record<string, keyof Prisma.WorkerOrderByWithRelationInput> = {
  name: 'lastName',
  number: 'workerNumber',
  workerNumber: 'workerNumber',
  hourlyRate: 'hourlyRate',
  createdAt: 'createdAt',
};

export interface ListWorkersParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  availability?: string;
  subcontractorId?: string;
  teamId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Aktive Projektzuweisung (für Listen- und Detailansicht). */
const activeAssignmentInclude = {
  where: { active: true },
  orderBy: { startDate: 'desc' },
  include: {
    project: {
      select: { id: true, projectNumber: true, title: true, status: true },
    },
  },
} satisfies Prisma.Worker$assignmentsArgs;

/** Schlanke Projektion für die Listenansicht. */
const listSelect = {
  id: true,
  workerNumber: true,
  firstName: true,
  lastName: true,
  photoPath: true,
  workerType: true,
  availability: true,
  hourlyRate: true,
  phone: true,
  email: true,
  subcontractor: { select: { id: true, name: true } },
  assignments: activeAssignmentInclude,
} satisfies Prisma.WorkerSelect;

function coerceDate(value?: string): Date | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

// ── Optionaler Thumbnail-Support via "sharp" (Dependency optional) ──
let sharpFn: ((input: Buffer) => SharpInstance) | null | undefined;
interface SharpInstance {
  resize: (
    w: number,
    h: number,
    opts?: Record<string, unknown>,
  ) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
}
function loadSharp(): ((input: Buffer) => SharpInstance) | null {
  if (sharpFn !== undefined) return sharpFn;
  try {
    // Über eval, damit tsc/webpack die optionale Dependency nicht auflösen muss.
    const req = eval('require') as NodeRequire;
    sharpFn = req('sharp') as (input: Buffer) => SharpInstance;
  } catch {
    sharpFn = null;
  }
  return sharpFn;
}

/**
 * Service für die Monteur-Verwaltung.
 * Behandelt CRUD, Profilbilder, Sprachkenntnisse, Zertifikate,
 * PIN-Verwaltung (für Stempeluhr) und Ablaufwarnungen für Reisedokumente.
 */
@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly emailService: EmailService,
  ) {}

  // ── Monteur CRUD ─────────────────────────────────────────────

  /**
   * Liefert eine paginierte, filterbare und sortierbare Monteur-Liste.
   *
   * @param params - Filter (Typ, Verfügbarkeit, Subunternehmen, Team), Suche und Sortierung
   * @returns Paginierte Liste mit Monteur-Übersichtsdaten inkl. aktiver Zuweisung
   */
  async findAll(params: ListWorkersParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy = SORT_MAP[params.sortBy ?? ''] ?? 'lastName';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.WorkerWhereInput = { deletedAt: null };
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { workerNumber: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.type && this.isWorkerType(params.type)) {
      where.workerType = params.type;
    }
    if (params.availability && this.isAvailability(params.availability)) {
      where.availability = params.availability;
    }
    if (params.subcontractorId) where.subcontractorId = params.subcontractorId;
    if (params.teamId) {
      where.teamMemberships = {
        some: { teamId: params.teamId, leftAt: null },
      };
    }

    const orderBy: Prisma.WorkerOrderByWithRelationInput[] =
      sortBy === 'lastName'
        ? [{ lastName: sortDir }, { firstName: sortDir }]
        : [{ [sortBy]: sortDir }];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.worker.findMany({
        where,
        select: listSelect,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.worker.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Liefert einen einzelnen Monteur mit allen Relationen und der aktuellen Zuweisung.
   *
   * @param id - UUID des Monteurs
   * @returns Monteur-Details mit Sprachen, Zertifikaten, Teams und Zuordnungen
   * @throws NotFoundException wenn der Monteur nicht existiert
   */
  async findOne(id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      include: {
        subcontractor: { select: { id: true, name: true, city: true } },
        languages: { orderBy: { language: 'asc' } },
        certifications: { orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }] },
        teamMemberships: {
          where: { leftAt: null },
          include: { team: { select: { id: true, name: true } } },
        },
        assignments: {
          orderBy: { startDate: 'desc' },
          include: {
            project: {
              select: {
                id: true,
                projectNumber: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
    const currentAssignment =
      worker.assignments.find((a) => a.active) ?? null;
    return { ...worker, currentAssignment };
  }

  /**
   * Erstellt einen neuen Monteur mit automatischer Nummer (W-YYYY-NNNN).
   * Prüft bei Subunternehmer-Monteuren die Pflicht-Zuordnung zum Sub.
   *
   * @param dto - Monteurdaten (Name, Typ, Stundensatz, Dokumente, etc.)
   * @returns Der erstellte Monteur mit allen Relationen
   */
  async create(dto: CreateWorkerDto) {
    this.assertSubcontractorRule(
      dto.workerType ?? WorkerType.SUBCONTRACTED,
      dto.subcontractorId ?? null,
    );
    if (dto.subcontractorId) {
      await this.ensureSubcontractor(dto.subcontractorId);
    }

    const workerNumber = await this.generateWorkerNumber();
    const worker = await this.prisma.worker.create({
      data: {
        ...dto,
        workerNumber,
        dateOfBirth: coerceDate(dto.dateOfBirth) ?? undefined,
        passportExpiry: coerceDate(dto.passportExpiry) ?? undefined,
        residencePermitExpiry:
          coerceDate(dto.residencePermitExpiry) ?? undefined,
        workPermitExpiry: coerceDate(dto.workPermitExpiry) ?? undefined,
        contractStart: coerceDate(dto.contractStart) ?? undefined,
        contractEnd: coerceDate(dto.contractEnd) ?? undefined,
      },
    });
    return this.findOne(worker.id);
  }

  /**
   * Aktualisiert einen bestehenden Monteur (Partial Update).
   * Validiert Sub-Zugehörigkeit bei Typwechsel.
   *
   * @param id - UUID des Monteurs
   * @param dto - Zu aktualisierende Felder
   * @returns Der aktualisierte Monteur
   */
  async update(id: string, dto: UpdateWorkerDto) {
    const current = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      select: { workerType: true, subcontractorId: true },
    });
    if (!current) {
      throw new NotFoundException('Monteur nicht gefunden');
    }

    const nextType = dto.workerType ?? current.workerType;
    const nextSubId =
      dto.subcontractorId === undefined
        ? current.subcontractorId
        : dto.subcontractorId || null;
    this.assertSubcontractorRule(nextType, nextSubId);
    if (nextSubId) await this.ensureSubcontractor(nextSubId);

    const { subcontractorId, ...rest } = dto;
    await this.prisma.worker.update({
      where: { id },
      data: {
        ...rest,
        subcontractorId:
          subcontractorId === undefined ? undefined : subcontractorId || null,
        dateOfBirth: coerceDate(dto.dateOfBirth),
        passportExpiry: coerceDate(dto.passportExpiry),
        residencePermitExpiry: coerceDate(dto.residencePermitExpiry),
        workPermitExpiry: coerceDate(dto.workPermitExpiry),
        contractStart: coerceDate(dto.contractStart),
        contractEnd: coerceDate(dto.contractEnd),
      },
    });
    return this.findOne(id);
  }

  /** Soft-Delete: setzt deletedAt. Nur wenn keine aktiven Zuweisungen. */
  async remove(id: string) {
    await this.ensureWorker(id);
    const activeAssignments = await this.prisma.projectAssignment.count({
      where: { workerId: id, active: true },
    });
    if (activeAssignments > 0) {
      throw new BadRequestException(
        'Monteur hat aktive Zuweisungen und kann nicht gelöscht werden. Bitte zuerst deaktivieren.',
      );
    }
    await this.prisma.worker.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { id, deleted: true };
  }

  // ── Ablaufwarnungen ──────────────────────────────────────────

  /** Monteure mit Reisepass/Aufenthalt/Arbeitserlaubnis-Ablauf in <30 Tagen. */
  async expiringDocuments() {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + EXPIRY_WINDOW_DAYS);

    const expiring: Prisma.WorkerWhereInput = {
      deletedAt: null,
      OR: [
        { passportExpiry: { not: null, lte: threshold } },
        { residencePermitExpiry: { not: null, lte: threshold } },
        { workPermitExpiry: { not: null, lte: threshold } },
      ],
    };

    return this.prisma.worker.findMany({
      where: expiring,
      select: {
        id: true,
        workerNumber: true,
        firstName: true,
        lastName: true,
        passportNumber: true,
        passportExpiry: true,
        residencePermitNumber: true,
        residencePermitExpiry: true,
        workPermitNumber: true,
        workPermitExpiry: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ── Profilbild ───────────────────────────────────────────────

  /**
   * Lädt ein Profilbild hoch (JPEG/PNG, max. 5 MB).
   * Erstellt automatisch ein 150×150 Thumbnail falls sharp verfügbar ist.
   *
   * @param id - UUID des Monteurs
   * @param file - Die hochgeladene Bilddatei
   * @returns Pfad zum gespeicherten Bild
   */
  async uploadPhoto(id: string, file: Express.Multer.File | undefined) {
    await this.ensureWorker(id);
    if (!file) {
      throw new BadRequestException('Keine Datei übermittelt');
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new BadRequestException('Profilbild überschreitet 5 MB');
    }
    const ext = PHOTO_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Nur JPEG oder PNG erlaubt');
    }

    // Thumbnail (150x150) falls "sharp" verfügbar, sonst Original.
    let buffer = file.buffer;
    const sharp = loadSharp();
    if (sharp) {
      try {
        buffer = await sharp(file.buffer)
          .resize(150, 150, { fit: 'cover' })
          .toBuffer();
      } catch {
        buffer = file.buffer;
      }
    }

    const storageKey = `workers/${id}/photo.${ext}`;

    // Vorhandenes Bild mit abweichendem Key entfernen (z.B. jpg→png).
    const existing = await this.prisma.worker.findUnique({
      where: { id },
      select: { photoPath: true },
    });
    if (existing?.photoPath && existing.photoPath !== storageKey) {
      await this.storage.remove(existing.photoPath).catch(() => undefined);
    }

    await this.storage.upload(storageKey, buffer, file.mimetype);
    await this.prisma.worker.update({
      where: { id },
      data: { photoPath: storageKey },
    });
    return { id, photoPath: storageKey };
  }

  /**
   * Liefert das Profilbild eines Monteurs als Stream.
   *
   * @param id - UUID des Monteurs
   * @returns Stream mit MIME-Type des Bildes
   * @throws NotFoundException wenn kein Profilbild vorhanden
   */
  async getPhoto(
    id: string,
  ): Promise<{ stream: Readable; mimeType: string }> {
    const worker = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      select: { photoPath: true },
    });
    if (!worker?.photoPath) {
      throw new NotFoundException('Kein Profilbild vorhanden');
    }
    const mimeType = worker.photoPath.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
    const stream = await this.storage.getStream(worker.photoPath);
    return { stream, mimeType };
  }

  // ── Sprachkenntnisse ─────────────────────────────────────────

  /** Liefert alle Sprachkenntnisse eines Monteurs. */
  async findLanguages(workerId: string) {
    await this.ensureWorker(workerId);
    return this.prisma.workerLanguage.findMany({
      where: { workerId },
      orderBy: { language: 'asc' },
    });
  }

  /** Erfasst eine Sprachkenntnis (Duplikat-Prüfung per Sprache). */
  async createLanguage(workerId: string, dto: CreateLanguageDto) {
    await this.ensureWorker(workerId);
    const existing = await this.prisma.workerLanguage.findFirst({
      where: { workerId, language: dto.language },
    });
    if (existing) {
      throw new BadRequestException('Diese Sprache ist bereits erfasst.');
    }
    return this.prisma.workerLanguage.create({
      data: { workerId, language: dto.language, proficiency: dto.proficiency },
    });
  }

  /** Aktualisiert eine Sprachkenntnis (z.B. Niveau-Änderung). */
  async updateLanguage(
    workerId: string,
    langId: string,
    dto: UpdateLanguageDto,
  ) {
    await this.ensureLanguage(workerId, langId);
    return this.prisma.workerLanguage.update({
      where: { id: langId },
      data: { ...dto },
    });
  }

  /** Löscht eine Sprachkenntnis. */
  async removeLanguage(workerId: string, langId: string) {
    await this.ensureLanguage(workerId, langId);
    await this.prisma.workerLanguage.delete({ where: { id: langId } });
    return { id: langId, deleted: true };
  }

  // ── Zertifikate ──────────────────────────────────────────────

  /** Liefert alle Zertifikate eines Monteurs. */
  async findCertifications(workerId: string) {
    await this.ensureWorker(workerId);
    return this.prisma.workerCertification.findMany({
      where: { workerId },
      orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
    });
  }

  /** Erfasst ein neues Zertifikat (z.B. SCC, Staplerschein). */
  async createCertification(workerId: string, dto: CreateCertificationDto) {
    await this.ensureWorker(workerId);
    return this.prisma.workerCertification.create({
      data: {
        workerId,
        name: dto.name,
        issuedBy: dto.issuedBy,
        issuedDate: coerceDate(dto.issuedDate) ?? undefined,
        expiryDate: coerceDate(dto.expiryDate) ?? undefined,
        notes: dto.notes,
      },
    });
  }

  /** Aktualisiert ein bestehendes Zertifikat. */
  async updateCertification(
    workerId: string,
    certId: string,
    dto: UpdateCertificationDto,
  ) {
    await this.ensureCertification(workerId, certId);
    return this.prisma.workerCertification.update({
      where: { id: certId },
      data: {
        ...dto,
        issuedDate: coerceDate(dto.issuedDate),
        expiryDate: coerceDate(dto.expiryDate),
      },
    });
  }

  /** Löscht ein Zertifikat. */
  async removeCertification(workerId: string, certId: string) {
    await this.ensureCertification(workerId, certId);
    await this.prisma.workerCertification.delete({ where: { id: certId } });
    return { id: certId, deleted: true };
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  /** Erzeugt die nächste Monteur-Nummer im Format W-YYYY-NNNN. */
  private async generateWorkerNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `W-${year}-`;
    const last = await this.prisma.worker.findFirst({
      where: { workerNumber: { startsWith: prefix } },
      orderBy: { workerNumber: 'desc' },
      select: { workerNumber: true },
    });
    const lastSeq = last
      ? Number.parseInt(last.workerNumber.slice(prefix.length), 10) || 0
      : 0;
    const next = (lastSeq + 1).toString().padStart(4, '0');
    return `${prefix}${next}`;
  }

  private assertSubcontractorRule(
    workerType: WorkerType,
    subcontractorId: string | null,
  ): void {
    if (workerType === WorkerType.SUBCONTRACTED && !subcontractorId) {
      throw new BadRequestException(
        'Für Subunternehmer-Monteure muss ein Subunternehmen gewählt werden.',
      );
    }
  }

  private isWorkerType(value: string): value is WorkerType {
    return (Object.values(WorkerType) as string[]).includes(value);
  }

  private isAvailability(value: string): value is WorkerAvailability {
    return (Object.values(WorkerAvailability) as string[]).includes(value);
  }

  private async ensureWorker(id: string): Promise<void> {
    const count = await this.prisma.worker.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
  }

  private async ensureSubcontractor(id: string): Promise<void> {
    const count = await this.prisma.subcontractor.count({
      where: { id, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }
  }

  private async ensureLanguage(workerId: string, id: string): Promise<void> {
    const count = await this.prisma.workerLanguage.count({
      where: { id, workerId },
    });
    if (count === 0) {
      throw new NotFoundException('Sprachkenntnis nicht gefunden');
    }
  }

  private async ensureCertification(
    workerId: string,
    id: string,
  ): Promise<void> {
    const count = await this.prisma.workerCertification.count({
      where: { id, workerId },
    });
    if (count === 0) {
      throw new NotFoundException('Zertifikat nicht gefunden');
    }
  }

  // ── PIN-Verwaltung ────────────────────────────────────────────

  /**
   * Setzt eine neue 6-stellige PIN für die Stempeluhr-Anmeldung.
   * Deaktiviert alle vorherigen PINs des Monteurs.
   *
   * @param workerId - UUID des Monteurs
   * @param pin - Neue 6-stellige PIN
   * @returns Erfolgsmeldung
   */
  async setPin(workerId: string, pin: string): Promise<{ success: true }> {
    await this.ensureWorker(workerId);
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('PIN muss genau 6 Ziffern sein.');
    }

    await this.prisma.workerPin.updateMany({
      where: { workerId, isActive: true },
      data: { isActive: false, validTo: new Date() },
    });

    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.workerPin.create({
      data: {
        workerId,
        pinHash,
        validFrom: new Date(),
        isActive: true,
      },
    });

    return { success: true };
  }

  /**
   * Setzt eine neue PIN und sendet sie per E-Mail an den Monteur.
   * Voraussetzung: Monteur hat eine E-Mail-Adresse hinterlegt.
   *
   * @param workerId - UUID des Monteurs
   * @param pin - Die zu setzende und zu versendende PIN
   * @returns Sendestatus (Erfolg/Fehler)
   */
  async sendPinEmail(
    workerId: string,
    pin: string,
  ): Promise<{ success: boolean; error?: string }> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!worker) {
      throw new NotFoundException('Monteur nicht gefunden');
    }
    if (!worker.email) {
      throw new BadRequestException(
        'Monteur hat keine E-Mail-Adresse hinterlegt.',
      );
    }

    await this.setPin(workerId, pin);

    const name = [worker.firstName, worker.lastName].filter(Boolean).join(' ');
    const html = `<div style="font-family: sans-serif; padding: 20px; max-width: 500px;">
      <h2 style="color: #333;">Stempeluhr-PIN</h2>
      <p>Hallo ${name},</p>
      <p>deine PIN für die Stempeluhr-App lautet:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center;">${pin}</p>
      <p style="color: #dc2626; font-weight: 500;">Bitte gib diese PIN auf keinen Fall weiter.</p>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">Diese E-Mail wurde automatisch von Office generiert.</p>
    </div>`;

    return this.emailService.send(worker.email, 'Deine Stempeluhr-PIN', html);
  }
}
