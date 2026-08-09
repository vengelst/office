/**
 * Generierung von Rechnungen aus genehmigten Stundenzetteln.
 */

import {
  BadRequestException,
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
import { GenerateFromTimesheetsDto } from './dto/generate-from-timesheets.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import {
  buildLineData,
  computeTotals,
  detailInclude,
  round2,
} from './invoice-shared';

/**
 * Erzeugt Entwurfsrechnungen (OUTGOING/INCOMING) aus APPROVED-Stundenzetteln.
 */
@Injectable()
export class InvoiceGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generiert eine Rechnung automatisch aus genehmigten Stundenzetteln eines Projekts.
   */
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
    const autoPackage =
      project.billingMode === 'HOURLY_PACKAGE' ||
      project.billingMode === 'MIXED';

    const sheets = await this.loadApprovedTimesheets(project.id, from, to);

    const byWeek = new Map<
      string,
      { year: number; week: number; net: number }
    >();
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
      lines: buildLineData(lines),
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
      lines: buildLineData(lines),
      userId,
    });
  }

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

    return sheets.filter((s) => {
      const { start, end } = isoWeekRange(s.weekYear, s.weekNumber);
      return start <= to && end >= from;
    });
  }

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
    const totals = computeTotals(input.lines, input.taxRate);
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

    const full = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: detailInclude,
    });
    if (!full) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    return full;
  }

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
}
