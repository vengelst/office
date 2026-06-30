import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceLineType,
  InvoiceStatus,
  InvoiceType,
  Prisma,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isoWeekRange } from '../timesheets/timesheet.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { GenerateFromTimesheetsDto } from './dto/generate-from-timesheets.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Sortierbare Spalten der Rechnungsliste. */
const SORTABLE_FIELDS = [
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'total',
  'status',
  'createdAt',
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

/** Standard-Zahlungsziel (Tage), falls weder Rechnung noch Kunde eines setzen. */
const DEFAULT_PAYMENT_TERM_DAYS = 14;

/** Status, in denen offene Beträge entstehen. */
const OPEN_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
];

export interface ListInvoicesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  projectId?: string;
  customerId?: string;
  subcontractorId?: string;
  periodFrom?: string;
  periodTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Schlanke Projektion für die Listenansicht. */
const listSelect = {
  id: true,
  invoiceNumber: true,
  invoiceType: true,
  status: true,
  periodFrom: true,
  periodTo: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  total: true,
  paidAmount: true,
  isPartialInvoice: true,
  partialNumber: true,
  partialPercentage: true,
  issueDate: true,
  dueDate: true,
  paidDate: true,
  createdAt: true,
  project: { select: { id: true, projectNumber: true, title: true } },
  customer: { select: { id: true, companyName: true } },
  subcontractor: { select: { id: true, name: true } },
  _count: { select: { lines: true, payments: true } },
} satisfies Prisma.InvoiceSelect;

/** Vollständige Projektion für die Detailansicht. */
const detailInclude = {
  project: {
    select: {
      id: true,
      projectNumber: true,
      title: true,
      billingMode: true,
      weeklyPackageHours: true,
      weeklyPackagePrice: true,
      overtimeRatePerHour: true,
    },
  },
  customer: {
    select: {
      id: true,
      customerNumber: true,
      companyName: true,
      paymentTermDays: true,
    },
  },
  subcontractor: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  lines: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidDate: 'asc' } },
} satisfies Prisma.InvoiceInclude;

/** Datumsfelder von ISO-Strings nach Date konvertieren. */
function coerceDate(value?: string): Date | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

/** Kaufmännisch auf 2 Nachkommastellen runden. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Liste / Detail ───────────────────────────────────────────

  async findAll(params: ListInvoicesParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const sortBy: SortField = SORTABLE_FIELDS.includes(params.sortBy as SortField)
      ? (params.sortBy as SortField)
      : 'issueDate';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.InvoiceWhereInput = {};
    if (params.search?.trim()) {
      where.invoiceNumber = {
        contains: params.search.trim(),
        mode: 'insensitive',
      };
    }
    if (params.type) {
      const types = params.type
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is InvoiceType =>
          (Object.values(InvoiceType) as string[]).includes(t),
        );
      if (types.length) where.invoiceType = { in: types };
    }
    if (params.status) {
      const statuses = params.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is InvoiceStatus =>
          (Object.values(InvoiceStatus) as string[]).includes(s),
        );
      if (statuses.length) where.status = { in: statuses };
    }
    if (params.projectId) where.projectId = params.projectId;
    if (params.customerId) where.customerId = params.customerId;
    if (params.subcontractorId) where.subcontractorId = params.subcontractorId;

    const from = coerceDate(params.periodFrom) ?? undefined;
    const to = coerceDate(params.periodTo) ?? undefined;
    if (from || to) {
      where.issueDate = {};
      if (from) where.issueDate.gte = from;
      if (to) where.issueDate.lte = to;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: listSelect,
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    return invoice;
  }

  // ── Erstellen (manuell) ──────────────────────────────────────

  async create(dto: CreateInvoiceDto, userId: string | null) {
    await this.validateRelations(
      dto.invoiceType,
      dto.projectId,
      dto.customerId,
      dto.subcontractorId,
    );

    const taxRate = dto.taxRate ?? 19;
    const invoiceNumber = await this.generateInvoiceNumber(dto.invoiceType);
    const lines = this.buildLineData(dto.lines ?? []);
    const totals = this.computeTotals(lines, taxRate);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: dto.invoiceType,
        status: InvoiceStatus.DRAFT,
        projectId: dto.projectId ?? null,
        customerId: dto.customerId ?? null,
        subcontractorId: dto.subcontractorId ?? null,
        periodFrom: coerceDate(dto.periodFrom) ?? undefined,
        periodTo: coerceDate(dto.periodTo) ?? undefined,
        taxRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        isPartialInvoice: dto.isPartialInvoice ?? false,
        partialNumber: dto.partialNumber ?? null,
        partialPercentage: dto.partialPercentage ?? null,
        paymentTermDays: dto.paymentTermDays ?? null,
        issueDate: coerceDate(dto.issueDate) ?? undefined,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
        createdByUserId: userId,
        lines: lines.length ? { create: lines } : undefined,
      },
      select: { id: true },
    });

    return this.findOne(invoice.id);
  }

  // ── Generieren aus Stundenzetteln ────────────────────────────

  async generateFromTimesheets(
    dto: GenerateFromTimesheetsDto,
    userId: string | null,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
      select: {
        id: true,
        customerId: true,
        billingMode: true,
        weeklyPackageHours: true,
        weeklyPackagePrice: true,
        overtimeRatePerHour: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Projekt nicht gefunden');
    }

    const from = new Date(dto.periodFrom);
    const to = new Date(dto.periodTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Ungültiger Zeitraum');
    }

    if (dto.invoiceType === InvoiceType.INCOMING) {
      return this.generateIncoming(dto, project.id, from, to, userId);
    }
    return this.generateOutgoing(dto, project, from, to, userId);
  }

  private async generateOutgoing(
    dto: GenerateFromTimesheetsDto,
    project: {
      id: string;
      customerId: string;
      billingMode: string | null;
      weeklyPackageHours: number | null;
      weeklyPackagePrice: number | null;
      overtimeRatePerHour: number | null;
    },
    from: Date,
    to: Date,
    userId: string | null,
  ) {
    // Pauschal-Lines nur bei HOURLY_PACKAGE / MIXED.
    const autoPackage =
      project.billingMode === 'HOURLY_PACKAGE' ||
      project.billingMode === 'MIXED';

    const sheets = await this.loadApprovedTimesheets(project.id, from, to);

    // Pro Kalenderwoche die Netto-Minuten aller Monteure aggregieren.
    const byWeek = new Map<string, { year: number; week: number; net: number }>();
    for (const s of sheets) {
      const key = `${s.weekYear}-${s.weekNumber}`;
      const agg = byWeek.get(key) ?? {
        year: s.weekYear,
        week: s.weekNumber,
        net: 0,
      };
      agg.net += s.totalMinutesNet ?? 0;
      byWeek.set(key, agg);
    }

    const lines: CreateInvoiceLineDto[] = [];
    if (autoPackage) {
      const weeks = [...byWeek.values()].sort(
        (a, b) => a.year - b.year || a.week - b.week,
      );
      const packagePrice = project.weeklyPackagePrice ?? 0;
      const packageHours = project.weeklyPackageHours ?? 0;
      const overtimeRate = project.overtimeRatePerHour ?? 0;

      for (const w of weeks) {
        lines.push({
          lineType: InvoiceLineType.WEEKLY_PACKAGE,
          description: `Wochenpaket KW ${w.week}/${w.year}`,
          quantity: 1,
          unit: 'Pauschale',
          unitPrice: packagePrice,
        });

        const netHours = round2(w.net / 60);
        if (packageHours > 0 && netHours > packageHours && overtimeRate > 0) {
          const overtimeHours = round2(netHours - packageHours);
          lines.push({
            lineType: InvoiceLineType.OVERTIME,
            description: `Überstunden KW ${w.week}/${w.year}: ${overtimeHours} Std`,
            quantity: overtimeHours,
            unit: 'Std',
            unitPrice: overtimeRate,
          });
        }
      }
    }

    return this.createGenerated({
      invoiceType: InvoiceType.OUTGOING,
      projectId: project.id,
      customerId: project.customerId,
      subcontractorId: null,
      from,
      to,
      taxRate: dto.taxRate ?? 19,
      paymentTermDays:
        (await this.customerPaymentTerm(project.customerId)) ?? null,
      lines: this.buildLineData(lines),
      userId,
    });
  }

  private async generateIncoming(
    dto: GenerateFromTimesheetsDto,
    projectId: string,
    from: Date,
    to: Date,
    userId: string | null,
  ) {
    if (!dto.subcontractorId) {
      throw new BadRequestException(
        'Bei Eingangsrechnungen ist die Auswahl eines Subunternehmens erforderlich',
      );
    }
    const sub = await this.prisma.subcontractor.findFirst({
      where: { id: dto.subcontractorId, deletedAt: null },
      select: { id: true },
    });
    if (!sub) {
      throw new NotFoundException('Subunternehmen nicht gefunden');
    }

    const sheets = await this.loadApprovedTimesheets(projectId, from, to, {
      worker: { subcontractorId: dto.subcontractorId },
    });

    // Pro Monteur + KW eine Position (Netto-Stunden × Stundensatz).
    const lines: CreateInvoiceLineDto[] = [];
    for (const s of sheets) {
      const netHours = round2((s.totalMinutesNet ?? 0) / 60);
      if (netHours <= 0) continue;
      const rate = s.worker.hourlyRate ?? 0;
      const name = `${s.worker.firstName} ${s.worker.lastName}`.trim();
      lines.push({
        lineType: InvoiceLineType.CUSTOM,
        description: `${name}, KW ${s.weekNumber}/${s.weekYear}: ${netHours} Std × ${rate.toFixed(2)} €/Std`,
        quantity: netHours,
        unit: 'Std',
        unitPrice: rate,
        weeklyTimesheetId: s.id,
      });
    }

    return this.createGenerated({
      invoiceType: InvoiceType.INCOMING,
      projectId,
      customerId: null,
      subcontractorId: dto.subcontractorId,
      from,
      to,
      taxRate: dto.taxRate ?? 19,
      paymentTermDays: null,
      lines: this.buildLineData(lines),
      userId,
    });
  }

  /** Lädt genehmigte Stundenzettel eines Projekts, deren KW in [from,to] liegt. */
  private async loadApprovedTimesheets(
    projectId: string,
    from: Date,
    to: Date,
    extraWhere: Prisma.WeeklyTimesheetWhereInput = {},
  ) {
    const sheets = await this.prisma.weeklyTimesheet.findMany({
      where: {
        projectId,
        status: WeeklyTimesheetStatus.APPROVED,
        ...extraWhere,
      },
      select: {
        id: true,
        weekYear: true,
        weekNumber: true,
        totalMinutesNet: true,
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hourlyRate: true,
            dailyRate: true,
          },
        },
      },
      orderBy: [{ weekYear: 'asc' }, { weekNumber: 'asc' }],
    });

    // Auf Wochen filtern, die sich mit dem Zeitraum überschneiden.
    return sheets.filter((s) => {
      const { start, end } = isoWeekRange(s.weekYear, s.weekNumber);
      return start <= to && end >= from;
    });
  }

  /** Gemeinsame Erstellung generierter Rechnungen (Status DRAFT). */
  private async createGenerated(input: {
    invoiceType: InvoiceType;
    projectId: string;
    customerId: string | null;
    subcontractorId: string | null;
    from: Date;
    to: Date;
    taxRate: number;
    paymentTermDays: number | null;
    lines: Prisma.InvoiceLineCreateWithoutInvoiceInput[];
    userId: string | null;
  }) {
    const totals = this.computeTotals(input.lines, input.taxRate);
    const invoiceNumber = await this.generateInvoiceNumber(input.invoiceType);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: input.invoiceType,
        status: InvoiceStatus.DRAFT,
        projectId: input.projectId,
        customerId: input.customerId,
        subcontractorId: input.subcontractorId,
        periodFrom: input.from,
        periodTo: input.to,
        taxRate: input.taxRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        paymentTermDays: input.paymentTermDays,
        createdByUserId: input.userId,
        lines: input.lines.length ? { create: input.lines } : undefined,
      },
      select: { id: true },
    });
    return this.findOne(invoice.id);
  }

  // ── Bearbeiten / Löschen (nur DRAFT) ─────────────────────────

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.ensureDraft(id);

    const taxRate = dto.taxRate ?? invoice.taxRate;
    await this.prisma.invoice.update({
      where: { id },
      data: {
        projectId: dto.projectId === undefined ? undefined : dto.projectId || null,
        customerId:
          dto.customerId === undefined ? undefined : dto.customerId || null,
        subcontractorId:
          dto.subcontractorId === undefined
            ? undefined
            : dto.subcontractorId || null,
        periodFrom: coerceDate(dto.periodFrom),
        periodTo: coerceDate(dto.periodTo),
        taxRate: dto.taxRate ?? undefined,
        isPartialInvoice: dto.isPartialInvoice ?? undefined,
        partialNumber:
          dto.partialNumber === undefined ? undefined : dto.partialNumber,
        partialPercentage:
          dto.partialPercentage === undefined
            ? undefined
            : dto.partialPercentage,
        paymentTermDays:
          dto.paymentTermDays === undefined ? undefined : dto.paymentTermDays,
        issueDate: coerceDate(dto.issueDate) ?? undefined,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
      },
    });

    // Steuersatz-Änderung schlägt auf die Summen durch.
    if (dto.taxRate !== undefined && dto.taxRate !== invoice.taxRate) {
      await this.recomputeTotals(id, taxRate);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.ensureDraft(id);
    await this.prisma.invoice.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Status-Workflow ──────────────────────────────────────────

  async send(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(
        'Nur Entwürfe können versendet werden',
      );
    }
    const termDays =
      invoice.paymentTermDays ??
      invoice.customer?.paymentTermDays ??
      DEFAULT_PAYMENT_TERM_DAYS;
    const dueDate = new Date(invoice.issueDate);
    dueDate.setDate(dueDate.getDate() + termDays);

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.SENT,
        paymentTermDays: termDays,
        dueDate,
      },
    });
    return this.findOne(id);
  }

  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Rechnung ist bereits storniert');
    }
    // Stornierung: Status CANCELLED, Beträge auf 0 – keine Löschung.
    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      },
    });
    return this.findOne(id);
  }

  async duplicate(id: string, userId: string | null) {
    const source = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: 'asc' } } },
    });
    if (!source) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }

    const invoiceNumber = await this.generateInvoiceNumber(source.invoiceType);
    const lines: Prisma.InvoiceLineCreateWithoutInvoiceInput[] = source.lines.map(
      (l) => ({
        lineType: l.lineType,
        position: l.position,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        total: l.total,
        weeklyTimesheet: l.weeklyTimesheetId
          ? { connect: { id: l.weeklyTimesheetId } }
          : undefined,
      }),
    );

    const copy = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: source.invoiceType,
        status: InvoiceStatus.DRAFT,
        projectId: source.projectId,
        customerId: source.customerId,
        subcontractorId: source.subcontractorId,
        periodFrom: source.periodFrom,
        periodTo: source.periodTo,
        taxRate: source.taxRate,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        total: source.total,
        isPartialInvoice: source.isPartialInvoice,
        partialNumber: source.partialNumber,
        partialPercentage: source.partialPercentage,
        paymentTermDays: source.paymentTermDays,
        notes: source.notes,
        internalNotes: source.internalNotes,
        createdByUserId: userId,
        lines: lines.length ? { create: lines } : undefined,
      },
      select: { id: true },
    });
    return this.findOne(copy.id);
  }

  // ── Positionen ───────────────────────────────────────────────

  async findLines(invoiceId: string) {
    await this.ensureInvoice(invoiceId);
    return this.prisma.invoiceLine.findMany({
      where: { invoiceId },
      orderBy: { position: 'asc' },
    });
  }

  async addLine(invoiceId: string, dto: CreateInvoiceLineDto) {
    await this.ensureDraft(invoiceId);
    const position = dto.position ?? (await this.nextLinePosition(invoiceId));
    const quantity = dto.quantity ?? 1;
    const unitPrice = dto.unitPrice ?? 0;

    const line = await this.prisma.invoiceLine.create({
      data: {
        invoiceId,
        lineType: dto.lineType,
        position,
        description: dto.description,
        quantity,
        unit: dto.unit,
        unitPrice,
        total: round2(quantity * unitPrice),
        weeklyTimesheetId: dto.weeklyTimesheetId ?? null,
      },
    });
    await this.recomputeTotals(invoiceId);
    return line;
  }

  async updateLine(invoiceId: string, lineId: string, dto: UpdateInvoiceLineDto) {
    await this.ensureDraft(invoiceId);
    const line = await this.ensureLine(invoiceId, lineId);

    const quantity = dto.quantity ?? line.quantity;
    const unitPrice = dto.unitPrice ?? line.unitPrice;

    const updated = await this.prisma.invoiceLine.update({
      where: { id: lineId },
      data: {
        lineType: dto.lineType ?? undefined,
        description: dto.description ?? undefined,
        quantity: dto.quantity ?? undefined,
        unit: dto.unit === undefined ? undefined : dto.unit,
        unitPrice: dto.unitPrice ?? undefined,
        position: dto.position ?? undefined,
        weeklyTimesheetId:
          dto.weeklyTimesheetId === undefined
            ? undefined
            : dto.weeklyTimesheetId || null,
        total: round2(quantity * unitPrice),
      },
    });
    await this.recomputeTotals(invoiceId);
    return updated;
  }

  async removeLine(invoiceId: string, lineId: string) {
    await this.ensureDraft(invoiceId);
    await this.ensureLine(invoiceId, lineId);
    await this.prisma.invoiceLine.delete({ where: { id: lineId } });
    await this.recomputeTotals(invoiceId);
    return { id: lineId, deleted: true };
  }

  async reorderLines(invoiceId: string, lineIds: string[]) {
    await this.ensureDraft(invoiceId);
    const existing = await this.prisma.invoiceLine.findMany({
      where: { invoiceId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((l) => l.id));
    if (
      lineIds.length !== existing.length ||
      !lineIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException(
        'Die übergebenen Positions-IDs stimmen nicht mit der Rechnung überein',
      );
    }

    await this.prisma.$transaction(
      lineIds.map((id, index) =>
        this.prisma.invoiceLine.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.findLines(invoiceId);
  }

  // ── Zahlungen ────────────────────────────────────────────────

  async findPayments(invoiceId: string) {
    await this.ensureInvoice(invoiceId);
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { paidDate: 'asc' },
    });
  }

  async addPayment(invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findOne(invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        'Für stornierte Rechnungen können keine Zahlungen erfasst werden',
      );
    }
    const payment = await this.prisma.invoicePayment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        paidDate: new Date(dto.paidDate),
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
      },
    });
    await this.recomputePaymentStatus(invoiceId);
    return payment;
  }

  async removePayment(invoiceId: string, paymentId: string) {
    await this.ensureInvoice(invoiceId);
    const payment = await this.prisma.invoicePayment.findFirst({
      where: { id: paymentId, invoiceId },
      select: { id: true },
    });
    if (!payment) {
      throw new NotFoundException('Zahlung nicht gefunden');
    }
    await this.prisma.invoicePayment.delete({ where: { id: paymentId } });
    await this.recomputePaymentStatus(invoiceId);
    return { id: paymentId, deleted: true };
  }

  // ── Dashboard / Statistik ────────────────────────────────────

  async stats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [open, overdue, revenueRows] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { status: { in: OPEN_STATUSES } },
        select: { invoiceType: true, total: true, paidAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          status: { in: OPEN_STATUSES },
          dueDate: { lt: now },
        },
        select: { invoiceType: true, total: true, paidAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          invoiceType: InvoiceType.OUTGOING,
          status: { not: InvoiceStatus.CANCELLED },
          issueDate: { gte: startOfYear },
        },
        select: { subtotal: true, issueDate: true },
      }),
    ]);

    const outstanding = (rows: typeof open, type: InvoiceType) =>
      rows
        .filter((r) => r.invoiceType === type)
        .reduce((sum, r) => sum + (r.total - (r.paidAmount ?? 0)), 0);

    const countOf = (rows: typeof open, type: InvoiceType) =>
      rows.filter((r) => r.invoiceType === type).length;

    const revenueMonth = revenueRows
      .filter((r) => r.issueDate >= startOfMonth)
      .reduce((sum, r) => sum + r.subtotal, 0);
    const revenueYear = revenueRows.reduce((sum, r) => sum + r.subtotal, 0);

    return {
      outgoing: {
        openCount: countOf(open, InvoiceType.OUTGOING),
        openAmount: round2(outstanding(open, InvoiceType.OUTGOING)),
        overdueCount: countOf(overdue, InvoiceType.OUTGOING),
        overdueAmount: round2(outstanding(overdue, InvoiceType.OUTGOING)),
      },
      incoming: {
        openCount: countOf(open, InvoiceType.INCOMING),
        openAmount: round2(outstanding(open, InvoiceType.INCOMING)),
        overdueCount: countOf(overdue, InvoiceType.INCOMING),
        overdueAmount: round2(outstanding(overdue, InvoiceType.INCOMING)),
      },
      revenue: {
        month: round2(revenueMonth),
        year: round2(revenueYear),
      },
    };
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────

  /**
   * Erzeugt die nächste Rechnungsnummer:
   * RE-YYYY-NNNN (Ausgang) bzw. ER-YYYY-NNNN (Eingang).
   */
  private async generateInvoiceNumber(type: InvoiceType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${type === InvoiceType.OUTGOING ? 'RE' : 'ER'}-${year}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const lastSeq = last
      ? Number.parseInt(last.invoiceNumber.slice(prefix.length), 10) || 0
      : 0;
    const next = (lastSeq + 1).toString().padStart(4, '0');
    return `${prefix}${next}`;
  }

  /** Wandelt Line-DTOs in Prisma-Create-Inputs (mit Position + Summe) um. */
  private buildLineData(
    lines: CreateInvoiceLineDto[],
  ): Prisma.InvoiceLineCreateWithoutInvoiceInput[] {
    return lines.map((l, index) => {
      const quantity = l.quantity ?? 1;
      const unitPrice = l.unitPrice ?? 0;
      return {
        lineType: l.lineType,
        position: l.position ?? index,
        description: l.description,
        quantity,
        unit: l.unit,
        unitPrice,
        total: round2(quantity * unitPrice),
        weeklyTimesheet: l.weeklyTimesheetId
          ? { connect: { id: l.weeklyTimesheetId } }
          : undefined,
      };
    });
  }

  /** Summen aus Positionsdaten berechnen. */
  private computeTotals(
    lines: Array<{ total?: number }>,
    taxRate: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = round2(lines.reduce((sum, l) => sum + (l.total ?? 0), 0));
    const taxAmount = round2((subtotal * taxRate) / 100);
    const total = round2(subtotal + taxAmount);
    return { subtotal, taxAmount, total };
  }

  /** Summen anhand der gespeicherten Positionen neu berechnen. */
  private async recomputeTotals(
    invoiceId: string,
    taxRateOverride?: number,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { taxRate: true, lines: { select: { total: true } } },
    });
    if (!invoice) return;
    const totals = this.computeTotals(
      invoice.lines,
      taxRateOverride ?? invoice.taxRate,
    );
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    });
  }

  /**
   * Aktualisiert paidAmount und Status anhand der erfassten Zahlungen:
   * paidAmount >= total → PAID, 0 < paidAmount < total → PARTIALLY_PAID.
   */
  private async recomputePaymentStatus(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        status: true,
        total: true,
        payments: { select: { amount: true, paidDate: true } },
      },
    });
    if (!invoice || invoice.status === InvoiceStatus.CANCELLED) return;

    const paidAmount = round2(
      invoice.payments.reduce((sum, p) => sum + p.amount, 0),
    );

    const data: Prisma.InvoiceUpdateInput = { paidAmount };
    if (paidAmount >= invoice.total && invoice.total > 0) {
      data.status = InvoiceStatus.PAID;
      const latest = invoice.payments.reduce<Date | null>(
        (max, p) => (max === null || p.paidDate > max ? p.paidDate : max),
        null,
      );
      data.paidDate = latest ?? new Date();
    } else if (paidAmount > 0) {
      data.status = InvoiceStatus.PARTIALLY_PAID;
      data.paidDate = null;
    } else {
      // Keine (mehr) Zahlungen: zurück auf SENT, falls bereits versendet war.
      if (
        invoice.status === InvoiceStatus.PAID ||
        invoice.status === InvoiceStatus.PARTIALLY_PAID
      ) {
        data.status = InvoiceStatus.SENT;
      }
      data.paidDate = null;
    }

    await this.prisma.invoice.update({ where: { id: invoiceId }, data });
  }

  private async nextLinePosition(invoiceId: string): Promise<number> {
    const last = await this.prisma.invoiceLine.findFirst({
      where: { invoiceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }

  private async customerPaymentTerm(
    customerId: string | null,
  ): Promise<number | null> {
    if (!customerId) return null;
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { paymentTermDays: true },
    });
    return customer?.paymentTermDays ?? null;
  }

  /** Prüft Bezugsdaten passend zum Rechnungstyp. */
  private async validateRelations(
    type: InvoiceType,
    projectId?: string,
    customerId?: string,
    subcontractorId?: string,
  ): Promise<void> {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Projekt nicht gefunden');
    }
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Kunde nicht gefunden');
    }
    if (subcontractorId) {
      const sub = await this.prisma.subcontractor.findFirst({
        where: { id: subcontractorId, deletedAt: null },
        select: { id: true },
      });
      if (!sub) throw new NotFoundException('Subunternehmen nicht gefunden');
    }
    if (type === InvoiceType.INCOMING && !subcontractorId) {
      throw new BadRequestException(
        'Eingangsrechnungen benötigen ein Subunternehmen',
      );
    }
  }

  private async ensureInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, taxRate: true },
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    return invoice;
  }

  /** Stellt sicher, dass die Rechnung existiert und im Status DRAFT ist. */
  private async ensureDraft(id: string) {
    const invoice = await this.ensureInvoice(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(
        'Nur Entwürfe können bearbeitet werden',
      );
    }
    return invoice;
  }

  private async ensureLine(invoiceId: string, lineId: string) {
    const line = await this.prisma.invoiceLine.findFirst({
      where: { id: lineId, invoiceId },
    });
    if (!line) {
      throw new NotFoundException('Position nicht gefunden');
    }
    return line;
  }
}
