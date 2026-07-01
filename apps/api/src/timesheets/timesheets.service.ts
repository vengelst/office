import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BreakScopeType,
  DocumentType,
  Prisma,
  SignerType,
  TimeEntryType,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { DocumentsService } from '../documents/documents.service';
import { StoragePathService } from '../common/storage-path.service';
import { TimesheetPdfService } from './pdf.service';
import { GenerateTimesheetDto } from './dto/generate-timesheet.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { SignTimesheetDto } from './dto/sign-timesheet.dto';
import {
  computeBreakMinutes,
  dayKey,
  diffMinutes,
  isoWeekRange,
  selectBreakRule,
} from './timesheet.util';

/** Sortierbare Spalten der Stundenzettel-Liste. */
const SORTABLE_FIELDS = [
  'weekYear',
  'weekNumber',
  'status',
  'generatedAt',
  'totalMinutesNet',
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

/** Status, in denen der Stundenzettel editiert/neu generiert werden darf. */
const EDITABLE_STATUSES: WeeklyTimesheetStatus[] = [
  WeeklyTimesheetStatus.DRAFT,
  WeeklyTimesheetStatus.REJECTED,
];

/** Status, in denen keine Unterschrift mehr hinzugefügt werden darf. */
const FINAL_STATUSES: WeeklyTimesheetStatus[] = [
  WeeklyTimesheetStatus.APPROVED,
  WeeklyTimesheetStatus.COMPLETED,
  WeeklyTimesheetStatus.LOCKED,
  WeeklyTimesheetStatus.ARCHIVED,
];

const listSelect = {
  id: true,
  weekYear: true,
  weekNumber: true,
  status: true,
  totalMinutesGross: true,
  totalBreakMinutes: true,
  totalMinutesNet: true,
  generatedAt: true,
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  worker: {
    select: { id: true, workerNumber: true, firstName: true, lastName: true },
  },
  project: { select: { id: true, projectNumber: true, title: true } },
} satisfies Prisma.WeeklyTimesheetSelect;

const detailInclude = {
  worker: {
    select: {
      id: true,
      workerNumber: true,
      firstName: true,
      lastName: true,
      photoPath: true,
    },
  },
  project: {
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: { select: { id: true, companyName: true } },
    },
  },
  reviewedBy: { select: { id: true, displayName: true } },
  approvedBy: { select: { id: true, displayName: true } },
  days: { orderBy: { workDate: 'asc' } },
  signatures: { orderBy: { signedAt: 'asc' } },
} satisfies Prisma.WeeklyTimesheetInclude;

export interface ListTimesheetsParams {
  page?: number;
  limit?: number;
  workerId?: string;
  projectId?: string;
  weekYear?: number;
  weekNumber?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

interface DayAggregate {
  workDate: Date;
  firstClockInAt: Date | null;
  lastClockOutAt: Date | null;
  grossMinutes: number;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
}

@Injectable()
export class TimesheetsService {
  private readonly logger = new Logger(TimesheetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentsService: DocumentsService,
    private readonly storagePathService: StoragePathService,
    private readonly pdfService: TimesheetPdfService,
  ) {}

  // ── Liste / Detail ───────────────────────────────────────────

  async findAll(params: ListTimesheetsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(
      params.sortBy as SortField,
    )
      ? (params.sortBy as SortField)
      : 'weekYear';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.WeeklyTimesheetWhereInput = {};
    if (params.workerId) where.workerId = params.workerId;
    if (params.projectId) where.projectId = params.projectId;
    if (params.weekYear) where.weekYear = params.weekYear;
    if (params.weekNumber) where.weekNumber = params.weekNumber;
    if (params.status) {
      const statuses = params.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is WeeklyTimesheetStatus =>
          (Object.values(WeeklyTimesheetStatus) as string[]).includes(s),
        );
      if (statuses.length) where.status = { in: statuses };
    }

    const orderBy: Prisma.WeeklyTimesheetOrderByWithRelationInput[] =
      sortBy === 'weekYear'
        ? [{ weekYear: sortDir }, { weekNumber: sortDir }]
        : [{ [sortBy]: sortDir }];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.weeklyTimesheet.findMany({
        where,
        select: listSelect,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.weeklyTimesheet.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string) {
    const timesheet = await this.prisma.weeklyTimesheet.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!timesheet) {
      throw new NotFoundException('Stundenzettel nicht gefunden');
    }
    return timesheet;
  }

  // ── Generieren aus TimeEntries ───────────────────────────────

  async generate(dto: GenerateTimesheetDto) {
    await this.assertWorker(dto.workerId);
    await this.assertProject(dto.projectId);

    const existing = await this.prisma.weeklyTimesheet.findUnique({
      where: {
        workerId_projectId_weekYear_weekNumber: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          weekYear: dto.weekYear,
          weekNumber: dto.weekNumber,
        },
      },
      select: { id: true, status: true },
    });
    if (existing && !EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        'Stundenzettel ist bereits eingereicht/freigegeben und kann nicht neu generiert werden',
      );
    }

    const { start, end } = isoWeekRange(dto.weekYear, dto.weekNumber);

    const entries = await this.prisma.timeEntry.findMany({
      where: {
        workerId: dto.workerId,
        projectId: dto.projectId,
        entryType: { in: [TimeEntryType.CLOCK_IN, TimeEntryType.CLOCK_OUT] },
        occurredAtClient: { gte: start, lte: end },
      },
      orderBy: { occurredAtClient: 'asc' },
    });

    const rule = selectBreakRule(
      await this.prisma.breakRule.findMany({
        where: {
          active: true,
          OR: [
            { scopeType: BreakScopeType.GLOBAL },
            { scopeType: BreakScopeType.PROJECT, projectId: dto.projectId },
          ],
        },
      }),
      dto.projectId,
    );

    const aggregates = this.aggregateDays(entries);

    const days = aggregates.map((a) => {
      const breakMinutes = computeBreakMinutes(a.grossMinutes, rule);
      return {
        workDate: a.workDate,
        firstClockInAt: a.firstClockInAt,
        lastClockOutAt: a.lastClockOutAt,
        grossMinutes: a.grossMinutes,
        breakMinutes,
        netMinutes: Math.max(0, a.grossMinutes - breakMinutes),
        clockInLatitude: a.clockInLatitude,
        clockInLongitude: a.clockInLongitude,
        clockOutLatitude: a.clockOutLatitude,
        clockOutLongitude: a.clockOutLongitude,
      };
    });

    const totals = sumTotals(days);

    const timesheet = await this.prisma.$transaction(async (tx) => {
      const sheet = await tx.weeklyTimesheet.upsert({
        where: {
          workerId_projectId_weekYear_weekNumber: {
            workerId: dto.workerId,
            projectId: dto.projectId,
            weekYear: dto.weekYear,
            weekNumber: dto.weekNumber,
          },
        },
        create: {
          workerId: dto.workerId,
          projectId: dto.projectId,
          weekYear: dto.weekYear,
          weekNumber: dto.weekNumber,
          status: WeeklyTimesheetStatus.DRAFT,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.break,
          totalMinutesNet: totals.net,
        },
        update: {
          status: WeeklyTimesheetStatus.DRAFT,
          generatedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          totalMinutesGross: totals.gross,
          totalBreakMinutes: totals.break,
          totalMinutesNet: totals.net,
        },
        select: { id: true },
      });

      await tx.weeklyTimesheetDay.deleteMany({
        where: { weeklyTimesheetId: sheet.id },
      });
      if (days.length) {
        await tx.weeklyTimesheetDay.createMany({
          data: days.map((d) => ({ ...d, weeklyTimesheetId: sheet.id })),
        });
      }
      return sheet;
    });

    return this.findOne(timesheet.id);
  }

  // ── Tageskorrektur ───────────────────────────────────────────

  async updateDay(id: string, dayId: string, dto: UpdateDayDto) {
    const sheet = await this.ensureEditable(id);
    const day = sheet.days.find((d) => d.id === dayId);
    if (!day) {
      throw new NotFoundException('Tageseintrag nicht gefunden');
    }

    const firstClockInAt =
      dto.firstClockInAt !== undefined
        ? parseDate(dto.firstClockInAt)
        : day.firstClockInAt;
    const lastClockOutAt =
      dto.lastClockOutAt !== undefined
        ? parseDate(dto.lastClockOutAt)
        : day.lastClockOutAt;

    let grossMinutes = day.grossMinutes ?? 0;
    if (firstClockInAt && lastClockOutAt) {
      grossMinutes = diffMinutes(firstClockInAt, lastClockOutAt);
    }

    const rule = selectBreakRule(
      await this.prisma.breakRule.findMany({
        where: {
          active: true,
          OR: [
            { scopeType: BreakScopeType.GLOBAL },
            { scopeType: BreakScopeType.PROJECT, projectId: sheet.projectId },
          ],
        },
      }),
      sheet.projectId,
    );
    const breakMinutes =
      dto.breakMinutes !== undefined
        ? dto.breakMinutes
        : computeBreakMinutes(grossMinutes, rule);

    await this.prisma.weeklyTimesheetDay.update({
      where: { id: dayId },
      data: {
        firstClockInAt,
        lastClockOutAt,
        grossMinutes,
        breakMinutes,
        netMinutes: Math.max(0, grossMinutes - breakMinutes),
        summaryComment:
          dto.summaryComment !== undefined
            ? dto.summaryComment
            : day.summaryComment,
      },
    });

    await this.recomputeTotals(id);
    return this.findOne(id);
  }

  // ── Workflow ─────────────────────────────────────────────────

  async submit(id: string) {
    const sheet = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Nur Entwürfe oder zurückgewiesene Stundenzettel können eingereicht werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.SUBMITTED,
        submittedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    return this.findOne(id);
  }

  async approve(id: string, userId: string | null) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.SUBMITTED) {
      throw new ConflictException(
        'Nur eingereichte Stundenzettel können genehmigt werden',
      );
    }
    const now = new Date();
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.APPROVED,
        reviewedAt: now,
        approvedAt: now,
        reviewedByUserId: userId,
        approvedByUserId: userId,
      },
    });

    // PDF-Export (async, non-blocking).
    this.exportTimesheetPdf(id, sheet, userId)
      .catch((err) => this.logger.warn(`Stundenzettel-PDF-Export fehlgeschlagen: ${(err as Error).message}`));

    return this.findOne(id);
  }

  /**
   * Generiert PDF, speichert in MinIO und erstellt Document-Eintrag.
   */
  private async exportTimesheetPdf(
    timesheetId: string,
    sheet: { weekNumber: number; worker: { id: string; firstName: string; lastName: string }; project: { id: string } },
    userId: string | null,
  ): Promise<void> {
    const { buffer } = await this.pdfService.generate(timesheetId);
    const filename = this.storagePathService.buildTimesheetFilename(
      sheet.weekNumber,
      sheet.worker.lastName,
      sheet.worker.firstName,
    );
    const storagePath = await this.storagePathService.generatePath(
      'PROJECT',
      sheet.project.id,
      'PROJECT_DOC',
      filename,
    );
    const readablePath = storagePath.replace(/\/protokolle\//, '/stundenzettel/');

    await this.documentsService.createFromBuffer({
      buffer,
      filename,
      mimeType: 'application/pdf',
      documentType: DocumentType.PROJECT_DOC,
      entityType: 'PROJECT',
      entityId: sheet.project.id,
      storagePath: readablePath,
      title: `Stundenzettel KW${sheet.weekNumber} ${sheet.worker.lastName}`,
      userId,
    });
  }

  async reject(id: string, reason: string, userId: string | null) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.SUBMITTED) {
      throw new ConflictException(
        'Nur eingereichte Stundenzettel können zurückgewiesen werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        status: WeeklyTimesheetStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
    return this.findOne(id);
  }

  // ── Archivieren ─────────────────────────────────────────────

  async archive(id: string) {
    const sheet = await this.findOne(id);
    if (sheet.status !== WeeklyTimesheetStatus.APPROVED) {
      throw new ConflictException(
        'Nur genehmigte Stundenzettel können archiviert werden',
      );
    }
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: { status: WeeklyTimesheetStatus.ARCHIVED },
    });
    return this.findOne(id);
  }

  // ── Unterschrift ─────────────────────────────────────────────

  async sign(id: string, dto: SignTimesheetDto, meta: SignatureMeta) {
    const sheet = await this.findOne(id);
    if (FINAL_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Stundenzettel ist abgeschlossen – keine Unterschrift mehr möglich',
      );
    }

    const buffer = decodeBase64Png(dto.signatureBase64);
    const storageKey = `timesheets/${id}/signatures/${dto.signerType}.png`;
    await this.storage.upload(storageKey, buffer, 'image/png');

    // Bestehende Unterschrift desselben Typs ersetzen.
    await this.prisma.weeklyTimesheetSignature.deleteMany({
      where: { weeklyTimesheetId: id, signerType: dto.signerType },
    });
    await this.prisma.weeklyTimesheetSignature.create({
      data: {
        weeklyTimesheetId: id,
        signerType: dto.signerType,
        signerName: dto.signerName,
        signerRole: dto.signerRole,
        signatureImagePath: storageKey,
        ipAddress: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
      },
    });

    // Status-Übergang bei Monteur-Unterschrift im Entwurf.
    if (
      dto.signerType === SignerType.WORKER &&
      sheet.status === WeeklyTimesheetStatus.DRAFT
    ) {
      await this.prisma.weeklyTimesheet.update({
        where: { id },
        data: { status: WeeklyTimesheetStatus.WORKER_SIGNED },
      });
    }

    return this.findOne(id);
  }

  // ── intern ───────────────────────────────────────────────────

  /** Aggregiert Stempel-Einträge tageweise zu Brutto-Zeiten. */
  private aggregateDays(
    entries: Array<{
      entryType: TimeEntryType;
      occurredAtClient: Date;
      latitude: number | null;
      longitude: number | null;
    }>,
  ): DayAggregate[] {
    const byDay = new Map<string, DayAggregate>();

    const openIn = new Map<
      string,
      { at: Date; lat: number | null; lng: number | null }
    >();

    for (const e of entries) {
      const key = dayKey(e.occurredAtClient);
      let agg = byDay.get(key);
      if (!agg) {
        const workDate = new Date(e.occurredAtClient);
        workDate.setHours(0, 0, 0, 0);
        agg = {
          workDate,
          firstClockInAt: null,
          lastClockOutAt: null,
          grossMinutes: 0,
          clockInLatitude: null,
          clockInLongitude: null,
          clockOutLatitude: null,
          clockOutLongitude: null,
        };
        byDay.set(key, agg);
      }

      if (e.entryType === TimeEntryType.CLOCK_IN) {
        if (!agg.firstClockInAt) {
          agg.firstClockInAt = e.occurredAtClient;
          agg.clockInLatitude = e.latitude;
          agg.clockInLongitude = e.longitude;
        }
        openIn.set(key, {
          at: e.occurredAtClient,
          lat: e.latitude,
          lng: e.longitude,
        });
      } else if (e.entryType === TimeEntryType.CLOCK_OUT) {
        const open = openIn.get(key);
        if (open) {
          agg.grossMinutes += diffMinutes(open.at, e.occurredAtClient);
          openIn.delete(key);
        }
        agg.lastClockOutAt = e.occurredAtClient;
        agg.clockOutLatitude = e.latitude;
        agg.clockOutLongitude = e.longitude;
      }
    }

    return [...byDay.values()].sort(
      (a, b) => a.workDate.getTime() - b.workDate.getTime(),
    );
  }

  private async recomputeTotals(id: string): Promise<void> {
    const days = await this.prisma.weeklyTimesheetDay.findMany({
      where: { weeklyTimesheetId: id },
      select: { grossMinutes: true, breakMinutes: true, netMinutes: true },
    });
    const totals = sumTotals(days);
    await this.prisma.weeklyTimesheet.update({
      where: { id },
      data: {
        totalMinutesGross: totals.gross,
        totalBreakMinutes: totals.break,
        totalMinutesNet: totals.net,
      },
    });
  }

  private async ensureEditable(id: string) {
    const sheet = await this.findOne(id);
    if (!EDITABLE_STATUSES.includes(sheet.status)) {
      throw new ConflictException(
        'Stundenzettel kann in diesem Status nicht bearbeitet werden',
      );
    }
    return sheet;
  }

  private async assertWorker(workerId: string): Promise<void> {
    const worker = await this.prisma.worker.findFirst({
      where: { id: workerId, deletedAt: null },
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

export interface SignatureMeta {
  ipAddress?: string;
  deviceInfo?: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────

function sumTotals(
  days: Array<{
    grossMinutes: number | null;
    breakMinutes: number | null;
    netMinutes: number | null;
  }>,
): { gross: number; break: number; net: number } {
  return days.reduce(
    (acc, d) => ({
      gross: acc.gross + (d.grossMinutes ?? 0),
      break: acc.break + (d.breakMinutes ?? 0),
      net: acc.net + (d.netMinutes ?? 0),
    }),
    { gross: 0, break: 0, net: 0 },
  );
}

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Ungültiges Datum: ${value}`);
  }
  return d;
}

/** Dekodiert eine Base64-PNG (Data-URL oder reiner Base64-String) zu Buffer. */
function decodeBase64Png(input: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/.exec(input.trim());
  const base64 = match ? match[1] : input.trim();
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new BadRequestException('Ungültige Base64-Signatur');
  }
}
