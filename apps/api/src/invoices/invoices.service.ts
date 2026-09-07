/**
 * Service für Invoices.
 * Kapselt CRUD, Status-Workflow und Zahlungen; Generierung/PDF-Export sind ausgelagert.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceSeriesCode,
  InvoiceStatus,
  InvoiceTaxKind,
  InvoiceType,
  CorrectionReason,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingSettingsService } from '../app-settings/billing-settings.service';
import { VAT_VALIDATION_MAX_AGE_DAYS } from '../app-settings/billing-settings.types';
import { EmailService, EmailAttachment } from '../email/email.service';
import { DocumentsService } from '../documents/documents.service';
import { TimesheetPdfService } from '../timesheets/pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { GenerateFromTimesheetsDto } from './dto/generate-from-timesheets.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';
import {
  CreateCorrectionDto,
  CreateStornoDto,
} from './dto/create-storno-correction.dto';
import { InvoiceExportService } from './invoice-export.service';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { computeLineNet } from './line-totals';
import {
  DEFAULT_PAYMENT_TERM_DAYS,
  ListInvoicesParams,
  OPEN_STATUSES,
  SORTABLE_FIELDS,
  SortField,
  buildLineData,
  coerceDate,
  computeTotals,
  detailInclude,
  documentTitleForType,
  effectiveTaxRateForKind,
  isNegativeTotalType,
  listSelect,
  round2,
  seriesCodeForType,
  taxPeriodBounds,
  toJsonBreakdown,
} from './invoice-shared';

export type { ListInvoicesParams } from './invoice-shared';

/**
 * Service für die Rechnungsverwaltung.
 * Behandelt Erstellung, Bearbeitung, Finalisierung (DRAFT → SENT),
 * Storno (ST) / Korrektur (KO), Zahlungserfassung; PDF und Generierung delegiert.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: InvoiceExportService,
    private readonly generationService: InvoiceGenerationService,
    private readonly billingSettings: BillingSettingsService,
    private readonly emailService: EmailService,
    private readonly documentsService: DocumentsService,
    private readonly timesheetPdf: TimesheetPdfService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  // ── Liste / Detail ───────────────────────────────────────────

  /**
   * Liefert eine paginierte, filterbare und sortierbare Rechnungsliste.
   *
   * @param params - Filter (Typ, Status, Projekt, Kunde, Zeitraum), Paginierung und Sortierung
   * @returns Paginierte Liste mit Rechnungs-Übersichtsdaten
   */
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
      const q = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
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

  /**
   * Liefert eine einzelne Rechnung mit allen Positionen, Zahlungen und Relationen.
   *
   * @param id - UUID der Rechnung
   * @returns Vollständige Rechnungsdetails
   * @throws NotFoundException wenn die Rechnung nicht existiert
   */
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

  /**
   * Erstellt eine neue Rechnung manuell im Status DRAFT.
   * Keine Geschäftsnummer – die wird erst beim Finalisieren vergeben.
   */
  async create(dto: CreateInvoiceDto, userId: string | null) {
    if (dto.invoiceType === InvoiceType.INCOMING) {
      throw new ForbiddenException(
        'Eingangsrechnungen werden nicht mehr angelegt (DATEV)',
      );
    }
    if (
      dto.invoiceType === InvoiceType.STORNO ||
      dto.invoiceType === InvoiceType.CORRECTION
    ) {
      throw new BadRequestException(
        'Stornorechnungen und Korrekturen entstehen nur über die entsprechenden Aktionen an einer finalisierten RE',
      );
    }

    await this.validateRelations(
      dto.invoiceType,
      dto.projectId,
      dto.customerId,
      dto.subcontractorId,
    );

    const taxKind = dto.taxKind ?? InvoiceTaxKind.STANDARD;
    if (taxKind === InvoiceTaxKind.REVERSE_CHARGE) {
      await this.assertReverseChargeAllowed(dto.customerId ?? null);
    }
    const taxRate = await this.resolveTaxRate(
      dto.taxRate,
      dto.performanceCountryCode,
      taxKind,
    );
    const lines = buildLineData(dto.lines ?? []);
    const totals = computeTotals(lines, taxRate);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: null,
        invoiceType: dto.invoiceType,
        status: InvoiceStatus.DRAFT,
        projectId: dto.projectId ?? null,
        customerId: dto.customerId ?? null,
        subcontractorId: dto.subcontractorId ?? null,
        periodFrom: coerceDate(dto.periodFrom) ?? undefined,
        periodTo: coerceDate(dto.periodTo) ?? undefined,
        performanceCountryCode: dto.performanceCountryCode?.trim().toUpperCase() || null,
        taxKind,
        taxRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        taxBreakdown: toJsonBreakdown(totals.taxBreakdown),
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

  /**
   * Generiert eine Rechnung automatisch aus genehmigten Stundenzetteln eines Projekts.
   * Unterscheidet zwischen Ausgangsrechnungen (Wochenpakete + Überstunden)
   * und Eingangsrechnungen (pro Monteur + KW).
   *
   * @param dto - Projektzeitraum, Rechnungstyp, optional Subunternehmen
   * @param userId - ID des erstellenden Benutzers
   * @returns Die generierte Rechnung im Status DRAFT
   */
  async generateFromTimesheets(
    dto: GenerateFromTimesheetsDto,
    userId: string | null,
  ) {
    return this.generationService.generateFromTimesheets(dto, userId);
  }

  // ── Bearbeiten / Löschen (nur DRAFT) ─────────────────────────

  /**
   * Aktualisiert eine Rechnung.
   * DRAFT: alle Header-Felder; finalisiert: nur internalNotes.
   */
  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.ensureInvoice(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      // Nach Finalisierung: nur interner Kommentar
      if (dto.internalNotes === undefined) {
        throw new ConflictException(
          'Finalisierte Rechnungen können nicht mehr bearbeitet werden (außer interner Kommentar)',
        );
      }
      const forbiddenKeys = Object.keys(dto).filter((k) => k !== 'internalNotes');
      if (forbiddenKeys.length > 0) {
        throw new ConflictException(
          'Finalisierte Rechnungen können nicht mehr bearbeitet werden (außer interner Kommentar)',
        );
      }
      await this.prisma.invoice.update({
        where: { id },
        data: { internalNotes: dto.internalNotes },
      });
      return this.findOne(id);
    }

    const taxKind = dto.taxKind ?? invoice.taxKind;
    if (
      dto.taxKind === InvoiceTaxKind.REVERSE_CHARGE ||
      (taxKind === InvoiceTaxKind.REVERSE_CHARGE &&
        (dto.customerId !== undefined || dto.taxKind !== undefined))
    ) {
      await this.assertReverseChargeAllowed(
        dto.customerId !== undefined
          ? dto.customerId || null
          : invoice.customerId,
      );
    }

    const taxRate =
      dto.taxRate !== undefined ||
      dto.performanceCountryCode !== undefined ||
      dto.taxKind !== undefined
        ? await this.resolveTaxRate(
            dto.taxRate,
            dto.performanceCountryCode ?? invoice.performanceCountryCode ?? undefined,
            taxKind,
          )
        : invoice.taxRate;

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
        performanceCountryCode:
          dto.performanceCountryCode === undefined
            ? undefined
            : dto.performanceCountryCode?.trim().toUpperCase() || null,
        taxKind: dto.taxKind ?? undefined,
        taxRate:
          dto.taxRate !== undefined ||
          dto.performanceCountryCode !== undefined ||
          dto.taxKind !== undefined
            ? taxRate
            : undefined,
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

    if (
      (dto.taxRate !== undefined && dto.taxRate !== invoice.taxRate) ||
      dto.performanceCountryCode !== undefined ||
      dto.taxKind !== undefined
    ) {
      await this.recomputeTotals(id, taxRate);
    }
    return this.findOne(id);
  }

  /**
   * Löscht eine Rechnung vollständig (nur im Status DRAFT).
   *
   * @param id - UUID der Rechnung
   * @returns Bestätigung der Löschung
   * @throws ConflictException wenn die Rechnung nicht im DRAFT-Status ist
   */
  async remove(id: string) {
    await this.ensureDraft(id);
    await this.prisma.invoice.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Status-Workflow ──────────────────────────────────────────

  /**
   * Finalisiert einen Entwurf: vergibt RE-/ST-/KO-Nummer, setzt Status SENT,
   * issueDate/dueDate und archiviert PDF. Bei KO: Ursprungs-RE → PARTIALLY_CORRECTED.
   */
  async finalize(id: string, userId: string | null) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Nur Entwürfe können finalisiert werden');
    }
    const seriesCode = seriesCodeForType(invoice.invoiceType);
    if (!seriesCode) {
      throw new BadRequestException(
        'Dieser Belegtyp kann nicht finalisiert werden',
      );
    }
    if (!invoice.lines.length) {
      throw new BadRequestException('Mindestens eine Position erforderlich');
    }
    if (!invoice.customerId) {
      throw new BadRequestException('Kunde ist erforderlich');
    }
    if (!invoice.periodFrom || !invoice.periodTo) {
      throw new BadRequestException('Leistungszeitraum ist erforderlich');
    }
    if (invoice.taxRate == null) {
      throw new BadRequestException('MwSt-Satz ist erforderlich');
    }
    if (invoice.taxKind === InvoiceTaxKind.REVERSE_CHARGE) {
      await this.assertReverseChargeAllowed(invoice.customerId);
    }

    if (
      invoice.invoiceType === InvoiceType.STORNO ||
      invoice.invoiceType === InvoiceType.CORRECTION
    ) {
      await this.assertStornoOrCorrectionReady(invoice);
    }

    const billing = await this.billingSettings.getSettingsOnly();
    const termDays =
      invoice.paymentTermDays ??
      invoice.customer?.paymentTermDays ??
      billing.defaultPaymentTermDays ??
      DEFAULT_PAYMENT_TERM_DAYS;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + termDays);

    const totals = computeTotals(
      invoice.lines.map((l) => ({ total: l.total, taxRate: l.taxRate })),
      invoice.taxRate,
    );

    const taxPeriod = this.resolveTaxPeriod(
      invoice.invoiceType,
      invoice.correctionReason,
      invoice.creditedInvoice?.issueDate ?? null,
      issueDate,
    );

    await this.prisma.$transaction(async (tx) => {
      if (invoice.invoiceType === InvoiceType.CORRECTION) {
        await this.assertCorrectionWithinRemaining(tx, invoice);
      }

      const invoiceNumber = await this.billingSettings.allocateNumber(
        seriesCode === 'OUTGOING'
          ? InvoiceSeriesCode.OUTGOING
          : seriesCode === 'STORNO'
            ? InvoiceSeriesCode.STORNO
            : InvoiceSeriesCode.CORRECTION,
        tx,
      );
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          status: InvoiceStatus.SENT,
          issueDate,
          paymentTermDays: termDays,
          dueDate:
            invoice.invoiceType === InvoiceType.OUTGOING ? dueDate : issueDate,
          finalizedAt: issueDate,
          finalizedByUserId: userId,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          taxBreakdown: toJsonBreakdown(totals.taxBreakdown),
          taxPeriodFrom: taxPeriod?.from ?? null,
          taxPeriodTo: taxPeriod?.to ?? null,
        },
      });

      if (
        invoice.invoiceType === InvoiceType.CORRECTION &&
        invoice.creditedInvoiceId
      ) {
        const source = await tx.invoice.findUnique({
          where: { id: invoice.creditedInvoiceId },
          select: { status: true },
        });
        if (source && source.status !== InvoiceStatus.CANCELLED) {
          await tx.invoice.update({
            where: { id: invoice.creditedInvoiceId },
            data: { status: InvoiceStatus.PARTIALLY_CORRECTED },
          });
        }
      }
    });

    const finalized = await this.findOne(id);
    this.exportService.exportInvoicePdfAsync(finalized);
    return finalized;
  }

  /**
   * @deprecated Durch finalize ersetzt – Alias für Kompatibilität.
   */
  async send(id: string, userId: string | null = null) {
    return this.finalize(id, userId);
  }

  /**
   * Storno einer finalisierten Ausgangsrechnung: erzeugt finalisierte ST
   * als exakte Spiegelung (negative Totals), Original → CANCELLED.
   */
  async createStorno(
    id: string,
    dto: CreateStornoDto,
    userId: string | null,
  ) {
    const source = await this.findOne(id);
    if (source.invoiceType !== InvoiceType.OUTGOING) {
      throw new BadRequestException(
        'Stornorechnungen sind nur für Ausgangsrechnungen möglich',
      );
    }
    if (source.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Entwürfe bitte löschen statt stornieren',
      );
    }
    if (source.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Rechnung ist bereits storniert');
    }
    if (!source.invoiceNumber || !source.finalizedAt) {
      throw new ConflictException(
        'Nur finalisierte Rechnungen können storniert werden',
      );
    }

    const related = source.creditNotes ?? [];
    if (related.some((r) => r.status !== InvoiceStatus.CANCELLED)) {
      const hasStorno = await this.prisma.invoice.findFirst({
        where: {
          creditedInvoiceId: source.id,
          invoiceType: InvoiceType.STORNO,
        },
        select: { id: true, invoiceType: true },
      });
      const hasKo = await this.prisma.invoice.findFirst({
        where: {
          creditedInvoiceId: source.id,
          invoiceType: InvoiceType.CORRECTION,
        },
        select: { id: true },
      });
      if (hasStorno) {
        throw new ConflictException(
          'Zu dieser Rechnung existiert bereits eine Stornorechnung',
        );
      }
      if (hasKo) {
        throw new ConflictException(
          'Storno nicht möglich: es existiert bereits eine Rechnungskorrektur',
        );
      }
    }

    // Explizit nochmal prüfen (auch Entwurfs-KO blockiert ST)
    const anyKo = await this.prisma.invoice.count({
      where: {
        creditedInvoiceId: source.id,
        invoiceType: InvoiceType.CORRECTION,
      },
    });
    if (anyKo > 0) {
      throw new ConflictException(
        'Storno nicht möglich: es existiert bereits eine Rechnungskorrektur',
      );
    }
    const anySt = await this.prisma.invoice.count({
      where: {
        creditedInvoiceId: source.id,
        invoiceType: InvoiceType.STORNO,
      },
    });
    if (anySt > 0) {
      throw new ConflictException(
        'Zu dieser Rechnung existiert bereits eine Stornorechnung',
      );
    }

    const issueDate = new Date();
    const taxPeriod = this.resolveTaxPeriod(
      InvoiceType.STORNO,
      dto.correctionReason,
      source.issueDate,
      issueDate,
    )!;

    const mirroredLines = source.lines.map((l) => ({
      lineType: l.lineType,
      position: l.position,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      productId: l.productId,
      taxRate: l.taxRate,
      total: -Math.abs(l.total),
      weeklyTimesheetId: l.weeklyTimesheetId,
    }));
    const totals = computeTotals(
      mirroredLines.map((l) => ({ total: l.total, taxRate: l.taxRate })),
      source.taxRate,
    );

    // Invariante 9: Spiegelbild inkl. Steuer je Satz
    if (
      Math.abs(totals.subtotal + source.subtotal) > 0.001 ||
      Math.abs(totals.taxAmount + source.taxAmount) > 0.001 ||
      Math.abs(totals.total + source.total) > 0.001
    ) {
      // Recalculate source breakdown for mirror check if legacy without breakdown
      const sourceTotals = computeTotals(
        source.lines.map((l) => ({ total: l.total, taxRate: l.taxRate })),
        source.taxRate,
      );
      if (
        Math.abs(totals.subtotal + sourceTotals.subtotal) > 0.001 ||
        Math.abs(totals.taxAmount + sourceTotals.taxAmount) > 0.001 ||
        Math.abs(totals.total + sourceTotals.total) > 0.001
      ) {
        throw new ConflictException(
          'Storno-Spiegelung der Beträge fehlgeschlagen',
        );
      }
    }

    const stornoId = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.billingSettings.allocateNumber(
        InvoiceSeriesCode.STORNO,
        tx,
      );

      const storno = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: InvoiceType.STORNO,
          status: InvoiceStatus.SENT,
          projectId: source.projectId,
          customerId: source.customerId,
          creditedInvoiceId: source.id,
          correctionReason: dto.correctionReason,
          taxPeriodFrom: taxPeriod.from,
          taxPeriodTo: taxPeriod.to,
          periodFrom: source.periodFrom,
          periodTo: source.periodTo,
          performanceCountryCode: source.performanceCountryCode,
          taxKind: source.taxKind,
          taxRate: source.taxRate,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          taxBreakdown: toJsonBreakdown(totals.taxBreakdown),
          isPartialInvoice: source.isPartialInvoice,
          partialNumber: source.partialNumber,
          partialPercentage: source.partialPercentage,
          paymentTermDays: source.paymentTermDays,
          issueDate,
          dueDate: issueDate,
          notes: `Storno zu Rechnung ${source.invoiceNumber} vom ${formatDeDate(source.issueDate)}${
            source.notes ? `\n${source.notes}` : ''
          }`,
          internalNotes: source.internalNotes,
          finalizedAt: issueDate,
          finalizedByUserId: userId,
          createdByUserId: userId,
          lines: {
            create: mirroredLines,
          },
        },
        select: { id: true },
      });

      await tx.invoice.update({
        where: { id: source.id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      return storno.id;
    });

    const storno = await this.findOne(stornoId);
    this.exportService.exportInvoicePdfAsync(storno);
    return storno;
  }

  /**
   * Erzeugt einen KO-Entwurf zu einer finalisierten RE (Positionen editierbar).
   */
  async createCorrection(
    id: string,
    dto: CreateCorrectionDto,
    userId: string | null,
  ) {
    const source = await this.findOne(id);
    if (source.invoiceType !== InvoiceType.OUTGOING) {
      throw new BadRequestException(
        'Korrekturen sind nur für Ausgangsrechnungen möglich',
      );
    }
    if (source.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        'Stornierte Rechnungen können nicht korrigiert werden',
      );
    }
    if (source.status === InvoiceStatus.DRAFT || !source.finalizedAt) {
      throw new BadRequestException(
        'Nur finalisierte Rechnungen können korrigiert werden',
      );
    }
    const anySt = await this.prisma.invoice.count({
      where: {
        creditedInvoiceId: source.id,
        invoiceType: InvoiceType.STORNO,
      },
    });
    if (anySt > 0) {
      throw new ConflictException(
        'Korrektur nicht möglich: Rechnung ist bereits storniert',
      );
    }

    const lineDtos = (dto.lines ?? []).map((l) => ({
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
    }));
    const lines = buildLineData(lineDtos, { negateTotals: true });
    const totals = computeTotals(
      lines.map((l) => ({
        total: typeof l.total === 'number' ? l.total : 0,
        taxRate: typeof l.taxRate === 'number' ? l.taxRate : null,
      })),
      source.taxRate,
    );

    const created = await this.prisma.invoice.create({
      data: {
        invoiceNumber: null,
        invoiceType: InvoiceType.CORRECTION,
        status: InvoiceStatus.DRAFT,
        projectId: source.projectId,
        customerId: source.customerId,
        creditedInvoiceId: source.id,
        correctionReason: dto.correctionReason,
        periodFrom: source.periodFrom,
        periodTo: source.periodTo,
        performanceCountryCode: source.performanceCountryCode,
        taxKind: source.taxKind,
        taxRate: source.taxRate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        taxBreakdown: toJsonBreakdown(totals.taxBreakdown),
        isPartialInvoice: false,
        paymentTermDays: source.paymentTermDays,
        notes: `Korrektur zu Rechnung ${source.invoiceNumber} vom ${formatDeDate(source.issueDate)}`,
        createdByUserId: userId,
        lines: lines.length ? { create: lines } : undefined,
      },
      select: { id: true },
    });
    return this.findOne(created.id);
  }

  /**
   * Storniert nur Entwürfe. Finalisierte RE → createStorno.
   */
  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Rechnung ist bereits storniert');
    }
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Finalisierte Rechnungen bitte über Stornorechnung stornieren',
      );
    }
    if (invoice.invoiceType === InvoiceType.STORNO) {
      throw new BadRequestException('Stornorechnungen können nicht storniert werden');
    }
    await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
    return this.findOne(id);
  }

  /**
   * Dupliziert eine Rechnung als neuen Entwurf ohne Geschäftsnummer.
   */
  async duplicate(id: string, userId: string | null) {
    const source = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { position: 'asc' } } },
    });
    if (!source) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    if (source.invoiceType === InvoiceType.INCOMING) {
      throw new ForbiddenException(
        'Eingangsrechnungen werden nicht mehr angelegt (DATEV)',
      );
    }

    const invoiceType =
      source.invoiceType === InvoiceType.STORNO ||
      source.invoiceType === InvoiceType.CORRECTION
        ? InvoiceType.OUTGOING
        : source.invoiceType;

    const lines: Prisma.InvoiceLineCreateWithoutInvoiceInput[] = source.lines.map(
      (l) => ({
        lineType: l.lineType,
        position: l.position,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        discountAmount: l.discountAmount,
        taxRate: l.taxRate,
        product: l.productId ? { connect: { id: l.productId } } : undefined,
        total: Math.abs(l.total),
        weeklyTimesheet: l.weeklyTimesheetId
          ? { connect: { id: l.weeklyTimesheetId } }
          : undefined,
      }),
    );

    const copyTotals = computeTotals(
      lines.map((l) => ({
        total: typeof l.total === 'number' ? l.total : 0,
        taxRate: typeof l.taxRate === 'number' ? l.taxRate : null,
      })),
      source.taxRate,
    );

    const copy = await this.prisma.invoice.create({
      data: {
        invoiceNumber: null,
        invoiceType,
        status: InvoiceStatus.DRAFT,
        projectId: source.projectId,
        customerId: source.customerId,
        subcontractorId: null,
        periodFrom: source.periodFrom,
        periodTo: source.periodTo,
        performanceCountryCode: source.performanceCountryCode,
        taxKind: source.taxKind,
        taxRate: source.taxRate,
        subtotal: copyTotals.subtotal,
        taxAmount: copyTotals.taxAmount,
        total: copyTotals.total,
        taxBreakdown: toJsonBreakdown(copyTotals.taxBreakdown),
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

  /**
   * Liefert alle Positionen einer Rechnung, sortiert nach Position.
   *
   * @param invoiceId - UUID der Rechnung
   * @returns Array der Rechnungspositionen
   */
  async findLines(invoiceId: string) {
    await this.ensureInvoice(invoiceId);
    return this.prisma.invoiceLine.findMany({
      where: { invoiceId },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Fügt eine neue Position zur Rechnung hinzu und aktualisiert die Summen.
   *
   * @param invoiceId - UUID der Rechnung (muss DRAFT sein)
   * @param dto - Positionsdaten (Beschreibung, Menge, Einzelpreis)
   * @returns Die erstellte Position
   */
  async addLine(invoiceId: string, dto: CreateInvoiceLineDto) {
    const invoice = await this.ensureDraft(invoiceId);
    const position = dto.position ?? (await this.nextLinePosition(invoiceId));
    const quantity = dto.quantity ?? 1;
    const unitPrice = dto.unitPrice ?? 0;
    const discountPercent = dto.discountPercent ?? null;
    const discountAmount = dto.discountAmount ?? null;
    const taxRate = dto.taxRate ?? null;

    let total = computeLineNet({
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
    });
    if (isNegativeTotalType(invoice.invoiceType)) {
      total = -Math.abs(total);
    }

    const line = await this.prisma.invoiceLine.create({
      data: {
        invoiceId,
        lineType: dto.lineType,
        position,
        description: dto.description,
        quantity,
        unit: dto.unit,
        unitPrice,
        discountPercent,
        discountAmount,
        taxRate,
        productId: dto.productId ?? null,
        total,
        weeklyTimesheetId: dto.weeklyTimesheetId ?? null,
      },
    });
    await this.recomputeTotals(invoiceId);
    return line;
  }

  /**
   * Aktualisiert eine bestehende Position und berechnet die Rechnungssummen neu.
   *
   * @param invoiceId - UUID der Rechnung (muss DRAFT sein)
   * @param lineId - UUID der Position
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Position
   */
  async updateLine(invoiceId: string, lineId: string, dto: UpdateInvoiceLineDto) {
    const invoice = await this.ensureDraft(invoiceId);
    const line = await this.ensureLine(invoiceId, lineId);

    const quantity = dto.quantity ?? line.quantity;
    const unitPrice = dto.unitPrice ?? line.unitPrice;
    const discountPercent =
      dto.discountPercent === undefined
        ? line.discountPercent
        : dto.discountPercent;
    const discountAmount =
      dto.discountAmount === undefined
        ? line.discountAmount
        : dto.discountAmount;
    const taxRate =
      dto.taxRate === undefined ? line.taxRate : dto.taxRate;

    let total = computeLineNet({
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
    });
    if (isNegativeTotalType(invoice.invoiceType)) {
      total = -Math.abs(total);
    }

    const updated = await this.prisma.invoiceLine.update({
      where: { id: lineId },
      data: {
        lineType: dto.lineType ?? undefined,
        description: dto.description ?? undefined,
        quantity: dto.quantity ?? undefined,
        unit: dto.unit === undefined ? undefined : dto.unit,
        unitPrice: dto.unitPrice ?? undefined,
        position: dto.position ?? undefined,
        productId:
          dto.productId === undefined ? undefined : dto.productId || null,
        discountPercent:
          dto.discountPercent === undefined ? undefined : dto.discountPercent,
        discountAmount:
          dto.discountAmount === undefined ? undefined : dto.discountAmount,
        taxRate: dto.taxRate === undefined ? undefined : dto.taxRate,
        weeklyTimesheetId:
          dto.weeklyTimesheetId === undefined
            ? undefined
            : dto.weeklyTimesheetId || null,
        total,
      },
    });
    await this.recomputeTotals(invoiceId);
    return updated;
  }

  /**
   * Entfernt eine Position und berechnet die Rechnungssummen neu.
   *
   * @param invoiceId - UUID der Rechnung (muss DRAFT sein)
   * @param lineId - UUID der Position
   * @returns Bestätigung der Löschung
   */
  async removeLine(invoiceId: string, lineId: string) {
    await this.ensureDraft(invoiceId);
    await this.ensureLine(invoiceId, lineId);
    await this.prisma.invoiceLine.delete({ where: { id: lineId } });
    await this.recomputeTotals(invoiceId);
    return { id: lineId, deleted: true };
  }

  /**
   * Sortiert die Positionen einer Rechnung anhand der übergebenen ID-Reihenfolge neu.
   *
   * @param invoiceId - UUID der Rechnung (muss DRAFT sein)
   * @param lineIds - Geordnetes Array aller Positions-IDs
   * @returns Die neu sortierten Positionen
   */
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

  /**
   * Liefert alle erfassten Zahlungen einer Rechnung.
   *
   * @param invoiceId - UUID der Rechnung
   * @returns Array der Zahlungen, sortiert nach Zahlungsdatum
   */
  async findPayments(invoiceId: string) {
    await this.ensureInvoice(invoiceId);
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { paidDate: 'asc' },
    });
  }

  /**
   * Erfasst eine Zahlung und aktualisiert den Rechnungsstatus automatisch
   * (PARTIALLY_PAID bzw. PAID bei vollständiger Bezahlung).
   *
   * @param invoiceId - UUID der Rechnung
   * @param dto - Zahlungsdaten (Betrag, Datum, Zahlungsart)
   * @returns Die erstellte Zahlung
   * @throws ConflictException bei stornierten Rechnungen
   */
  async addPayment(invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findOne(invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        'Für stornierte Rechnungen können keine Zahlungen erfasst werden',
      );
    }
    const skontoApplied = dto.skontoApplied === true;
    if (skontoApplied) {
      if (dto.skontoAmount == null || !(dto.skontoAmount > 0)) {
        throw new BadRequestException(
          'Bei „Skonto gezogen“ muss ein Skontobetrag > 0 angegeben werden',
        );
      }
    }
    const payment = await this.prisma.invoicePayment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        paidDate: new Date(dto.paidDate),
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        skontoApplied,
        skontoAmount: skontoApplied ? dto.skontoAmount! : null,
      },
    });
    await this.recomputePaymentStatus(invoiceId);
    return payment;
  }

  /**
   * Löscht eine Zahlung und aktualisiert den Rechnungsstatus entsprechend.
   *
   * @param invoiceId - UUID der Rechnung
   * @param paymentId - UUID der Zahlung
   * @returns Bestätigung der Löschung
   */
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

  /**
   * Liefert Rechnungs-Kennzahlen für das Dashboard:
   * Offene/überfällige Beträge (ein- und ausgehend) sowie Umsatz (Monat/Jahr).
   *
   * @returns Statistische Übersicht der Rechnungen
   */
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
          invoiceType: {
            in: [
              InvoiceType.OUTGOING,
              InvoiceType.STORNO,
              InvoiceType.CORRECTION,
            ],
          },
          status: { not: InvoiceStatus.CANCELLED },
          issueDate: { gte: startOfYear },
        },
        select: { subtotal: true, issueDate: true, invoiceType: true },
      }),
    ]);

    const outstanding = (rows: typeof open, type: InvoiceType) =>
      rows
        .filter((r) => r.invoiceType === type)
        .reduce((sum, r) => sum + (r.total - (r.paidAmount ?? 0)), 0);

    const countOf = (rows: typeof open, type: InvoiceType) =>
      rows.filter((r) => r.invoiceType === type).length;

    // Umsatz: ST/KO haben bereits negative subtotals
    const revenueMonth = revenueRows
      .filter((r) => r.issueDate >= startOfMonth)
      .reduce((sum, r) => sum + r.subtotal, 0);
    const revenueYear = revenueRows.reduce(
      (sum, r) => sum + r.subtotal,
      0,
    );

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
   * MwSt aus taxKind, DTO oder Leistungsort-Land ableiten.
   */
  private async resolveTaxRate(
    taxRate?: number,
    performanceCountryCode?: string | null,
    taxKind: InvoiceTaxKind = InvoiceTaxKind.STANDARD,
  ): Promise<number> {
    let countryRates: { standardRate: number; reducedRate: number } | null =
      null;
    if (performanceCountryCode?.trim()) {
      const settings = await this.billingSettings.getSettingsOnly();
      const code = performanceCountryCode.trim().toUpperCase();
      const country = settings.performanceCountries.find(
        (c) => c.countryCode.toUpperCase() === code,
      );
      if (country) {
        countryRates = {
          standardRate: country.standardRate,
          reducedRate: country.reducedRate,
        };
      }
    }
    return effectiveTaxRateForKind(taxKind, taxRate, countryRates);
  }

  /**
   * Reverse Charge nur mit gültiger, nicht zu alter VIES-Prüfung.
   */
  private async assertReverseChargeAllowed(
    customerId: string | null | undefined,
  ): Promise<void> {
    if (!customerId) {
      throw new BadRequestException(
        'Reverse Charge erfordert einen Kunden mit gültiger USt-IdNr.',
      );
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        vatId: true,
        vatIdValid: true,
        vatIdValidatedAt: true,
      },
    });
    if (!customer?.vatId?.trim()) {
      throw new BadRequestException(
        'Kunde hat keine USt-IdNr. – Reverse Charge nicht möglich',
      );
    }
    if (customer.vatIdValid !== true || !customer.vatIdValidatedAt) {
      throw new BadRequestException(
        'USt-IdNr. des Kunden ist nicht gültig geprüft (VIES). Bitte zuerst prüfen.',
      );
    }
    const ageMs = Date.now() - customer.vatIdValidatedAt.getTime();
    const maxAgeMs = VAT_VALIDATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      throw new BadRequestException(
        `VIES-Prüfung ist älter als ${VAT_VALIDATION_MAX_AGE_DAYS} Tage. Bitte erneut prüfen.`,
      );
    }
  }

  /**
   * Skonto-Auswertung: Zahlungen mit skontoApplied.
   */
  async listSkontoPayments(params?: {
    page?: number;
    limit?: number;
    periodFrom?: string;
    periodTo?: string;
    customerId?: string;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 50));
    const skip = (page - 1) * limit;
    const where: Prisma.InvoicePaymentWhereInput = {
      skontoApplied: true,
    };
    const from = coerceDate(params?.periodFrom) ?? undefined;
    const to = coerceDate(params?.periodTo) ?? undefined;
    if (from || to) {
      where.paidDate = {};
      if (from) where.paidDate.gte = from;
      if (to) where.paidDate.lte = to;
    }
    if (params?.customerId) {
      where.invoice = { customerId: params.customerId };
    }

    const [data, total, sumAgg] = await this.prisma.$transaction([
      this.prisma.invoicePayment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceType: true,
              total: true,
              customer: {
                select: { id: true, companyName: true, customerNumber: true },
              },
            },
          },
        },
        orderBy: { paidDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoicePayment.count({ where }),
      this.prisma.invoicePayment.aggregate({
        where,
        _sum: { skontoAmount: true, amount: true },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sums: {
        skontoAmount: round2(sumAgg._sum.skontoAmount ?? 0),
        paymentAmount: round2(sumAgg._sum.amount ?? 0),
      },
    };
  }

  /**
   * Vorschläge für E-Mail-Anhänge (Kundendokumente + verknüpfte Stundenzettel).
   */
  async getEmailAttachmentOptions(id: string) {
    const invoice = await this.findOne(id);
    if (!invoice.customerId) {
      throw new BadRequestException('Rechnung hat keinen Kunden');
    }
    const customerDocs = await this.documentsService.findByEntity(
      'CUSTOMER',
      invoice.customerId,
    );
    const timesheetIds = [
      ...new Set(
        invoice.lines
          .map((l) => l.weeklyTimesheetId)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const timesheets = timesheetIds.length
      ? await this.prisma.weeklyTimesheet.findMany({
          where: { id: { in: timesheetIds } },
          select: {
            id: true,
            weekNumber: true,
            weekYear: true,
            worker: { select: { firstName: true, lastName: true } },
          },
        })
      : [];

    const billingEmail =
      invoice.customer?.emails?.find(
        (e) => e.emailType === 'BILLING' && e.isPrimary,
      ) ??
      invoice.customer?.emails?.find((e) => e.emailType === 'BILLING') ??
      null;

    return {
      recipient: billingEmail
        ? {
            email: billingEmail.email,
            label: billingEmail.label,
            emailType: billingEmail.emailType,
          }
        : null,
      customerDocuments: customerDocs.map((d) => ({
        id: d.id,
        title: d.title,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        documentType: d.documentType,
        createdAt: d.createdAt,
      })),
      timesheets: timesheets.map((t) => ({
        id: t.id,
        label: `Stundenzettel KW${t.weekNumber}/${t.weekYear} – ${t.worker.lastName}, ${t.worker.firstName}`,
        weekNumber: t.weekNumber,
        weekYear: t.weekYear,
      })),
    };
  }

  /**
   * Finalisierte RE/ST/KO per E-Mail an Billing-Adresse senden.
   */
  async sendEmail(id: string, dto: SendInvoiceEmailDto) {
    const invoice = await this.findOne(id);
    if (
      invoice.invoiceType !== InvoiceType.OUTGOING &&
      invoice.invoiceType !== InvoiceType.STORNO &&
      invoice.invoiceType !== InvoiceType.CORRECTION
    ) {
      throw new BadRequestException(
        'Nur Ausgangsrechnungen, Stornorechnungen und Korrekturen können per E-Mail versendet werden',
      );
    }
    if (
      invoice.status === InvoiceStatus.DRAFT ||
      !invoice.invoiceNumber ||
      !invoice.finalizedAt
    ) {
      throw new BadRequestException(
        'Nur finalisierte Rechnungen können per E-Mail versendet werden',
      );
    }
    if (!invoice.customerId) {
      throw new BadRequestException('Rechnung hat keinen Kunden');
    }

    const emails = invoice.customer?.emails ?? [];
    const billing =
      emails.find((e) => e.emailType === 'BILLING' && e.isPrimary) ??
      emails.find((e) => e.emailType === 'BILLING');
    if (!billing?.email) {
      throw new BadRequestException(
        'Kunde hat keine Billing-E-Mail (Typ BILLING). Bitte unter Kunden → E-Mails hinterlegen.',
      );
    }

    const attachments: EmailAttachment[] = [];

    // Rechnungs-PDF
    const { buffer: pdfBuffer, filename: pdfFilename } =
      await this.pdfService.generate(id);
    attachments.push({
      filename: pdfFilename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });

    // Kundendokumente
    const docIds = [...new Set(dto.documentIds ?? [])];
    for (const docId of docIds) {
      const link = await this.prisma.documentLink.findFirst({
        where: {
          documentId: docId,
          entityType: 'CUSTOMER',
          entityId: invoice.customerId,
        },
        select: { id: true },
      });
      if (!link) {
        throw new BadRequestException(
          `Dokument ${docId} gehört nicht zu diesem Kunden`,
        );
      }
      const { stream, filename, mimeType } =
        await this.documentsService.getDownload(docId);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      attachments.push({
        filename,
        content: Buffer.concat(chunks),
        contentType: mimeType,
      });
    }

    // Stundenzettel-PDFs (nur wenn an Rechnung verknüpft)
    const allowedTs = new Set(
      invoice.lines
        .map((l) => l.weeklyTimesheetId)
        .filter((x): x is string => Boolean(x)),
    );
    const tsIds = [...new Set(dto.weeklyTimesheetIds ?? [])];
    for (const tsId of tsIds) {
      if (!allowedTs.has(tsId)) {
        throw new BadRequestException(
          `Stundenzettel ${tsId} ist nicht mit dieser Rechnung verknüpft`,
        );
      }
      const { buffer, filename } = await this.timesheetPdf.generate(tsId);
      attachments.push({
        filename,
        content: buffer,
        contentType: 'application/pdf',
      });
    }

    const docTitle = documentTitleForType(invoice.invoiceType);
    const article =
      invoice.invoiceType === InvoiceType.STORNO
        ? 'die Stornorechnung'
        : invoice.invoiceType === InvoiceType.CORRECTION
          ? 'die Rechnungskorrektur'
          : 'die Rechnung';
    const subject = `${docTitle} ${invoice.invoiceNumber} – ${invoice.customer?.companyName ?? ''}`;
    const html = `<div style="font-family: sans-serif; padding: 20px; max-width: 560px;">
  <h2 style="color: #333;">${docTitle} ${invoice.invoiceNumber}</h2>
  <p>anbei erhalten Sie ${article} als PDF.</p>
  <p style="color: #666; font-size: 12px; margin-top: 24px;">Diese E-Mail wurde aus Office versendet.</p>
</div>`;

    const result = await this.emailService.send(
      billing.email,
      subject,
      html,
      attachments,
    );

    await this.prisma.emailLog.create({
      data: {
        recipientEmail: billing.email,
        subject,
        body: html,
        attachmentPath: pdfFilename,
        sentAt: result.success ? new Date() : null,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error ?? null,
        relatedEntityType: 'INVOICE',
        relatedEntityId: id,
      },
    });

    if (!result.success) {
      throw new BadRequestException(
        result.error ?? 'E-Mail-Versand fehlgeschlagen',
      );
    }

    return {
      success: true,
      recipient: billing.email,
      messageId: result.messageId,
      attachmentCount: attachments.length,
    };
  }

  /**
   * Summen anhand der gespeicherten Positionen neu berechnen.
   */
  private async recomputeTotals(
    invoiceId: string,
    taxRateOverride?: number,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        taxRate: true,
        lines: { select: { total: true, taxRate: true } },
      },
    });
    if (!invoice) return;
    const totals = computeTotals(
      invoice.lines,
      taxRateOverride ?? invoice.taxRate,
    );
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        taxBreakdown: toJsonBreakdown(totals.taxBreakdown),
      },
    });
  }

  /**
   * Aktualisiert paidAmount und Status anhand der erfassten Zahlungen: paidAmount >= total → PAID, 0 < paidAmount < total → PARTIALLY_PAID.
   *
   * @param invoiceId - ID (invoiceId) (string)
   * @returns void
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

  /**
   * Interner Helfer: Interner Helfer: Implementiert `nextLinePosition` (next Line Position).
   *
   * @param invoiceId - ID (invoiceId) (string)
   * @returns number
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   */
  private async nextLinePosition(invoiceId: string): Promise<number> {
    const last = await this.prisma.invoiceLine.findFirst({
      where: { invoiceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `customerPaymentTerm` (customer Payment Term).
   *
   * @param customerId - ID des Kunden (string | null)
   * @returns number | null
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
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

  /**
   * Prüft Bezugsdaten passend zum Rechnungstyp.
   *
   * @param type - Parameter `type` (InvoiceType)
   * @param projectId - ID des Projekts (string)
   * @param customerId - ID des Kunden (string)
   * @param subcontractorId - ID (subcontractorId) (string)
   * @returns void
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {BadRequestException} Bei ungültigen Eingaben
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
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

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureInvoice` (ensure Invoice).
   *
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  private async ensureInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        taxRate: true,
        taxKind: true,
        customerId: true,
        performanceCountryCode: true,
        invoiceType: true,
        invoiceNumber: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Rechnung nicht gefunden');
    }
    return invoice;
  }

  /**
   * Stellt sicher, dass die Rechnung existiert und im Status DRAFT ist.
   *
   * @param id - Primärschlüssel der Entität (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   * @throws {ConflictException} Bei Konflikten (z. B. Duplikate)
   */
  private async ensureDraft(id: string) {
    const invoice = await this.ensureInvoice(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(
        'Nur Entwürfe können bearbeitet werden',
      );
    }
    return invoice;
  }

  /**
   * Interner Helfer: Interner Helfer: Implementiert `ensureLine` (ensure Line).
   *
   * @param invoiceId - ID (invoiceId) (string)
   * @param lineId - ID (lineId) (string)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async ensureLine(invoiceId: string, lineId: string) {
    const line = await this.prisma.invoiceLine.findFirst({
      where: { id: lineId, invoiceId },
    });
    if (!line) {
      throw new NotFoundException('Position nicht gefunden');
    }
    return line;
  }

  /** Steuerperiode aus Korrekturgrund ableiten (Client darf nicht setzen). */
  private resolveTaxPeriod(
    type: InvoiceType,
    reason: CorrectionReason | null | undefined,
    sourceIssueDate: Date | null,
    docIssueDate: Date,
  ): { from: Date; to: Date } | null {
    if (type !== InvoiceType.STORNO && type !== InvoiceType.CORRECTION) {
      return null;
    }
    if (!reason) {
      throw new BadRequestException('Korrekturgrund ist erforderlich');
    }
    if (reason === CorrectionReason.INVOICE_ERROR) {
      if (!sourceIssueDate) {
        throw new BadRequestException(
          'Ursprungsrechnung hat kein Ausstellungsdatum für die Steuerperiode',
        );
      }
      return taxPeriodBounds(sourceIssueDate);
    }
    return taxPeriodBounds(docIssueDate);
  }

  private async assertStornoOrCorrectionReady(invoice: {
    invoiceType: InvoiceType;
    creditedInvoiceId: string | null;
    correctionReason: CorrectionReason | null;
    creditedInvoice: { status: InvoiceStatus; invoiceType?: InvoiceType } | null;
  }): Promise<void> {
    if (!invoice.creditedInvoiceId) {
      throw new BadRequestException(
        'ST/KO benötigen einen Bezug auf eine Ausgangsrechnung',
      );
    }
    if (!invoice.correctionReason) {
      throw new BadRequestException('Korrekturgrund ist erforderlich');
    }
    const source = await this.prisma.invoice.findUnique({
      where: { id: invoice.creditedInvoiceId },
      select: { invoiceType: true, status: true },
    });
    if (!source || source.invoiceType !== InvoiceType.OUTGOING) {
      throw new BadRequestException(
        'Bezug muss eine Ausgangsrechnung (RE) sein',
      );
    }
    if (source.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException(
        'Bezug auf stornierte Rechnung nicht erlaubt',
      );
    }
    if (invoice.invoiceType === InvoiceType.CORRECTION) {
      const anySt = await this.prisma.invoice.count({
        where: {
          creditedInvoiceId: invoice.creditedInvoiceId,
          invoiceType: InvoiceType.STORNO,
        },
      });
      if (anySt > 0) {
        throw new ConflictException(
          'Korrektur nicht möglich: Rechnung ist bereits storniert',
        );
      }
    }
  }

  private async assertCorrectionWithinRemaining(
    tx: Prisma.TransactionClient,
    invoice: {
      id: string;
      creditedInvoiceId: string | null;
      total: number;
    },
  ): Promise<void> {
    if (!invoice.creditedInvoiceId) {
      throw new BadRequestException('Korrektur ohne Bezugsrechnung');
    }
    const source = await tx.invoice.findUnique({
      where: { id: invoice.creditedInvoiceId },
      select: { total: true },
    });
    if (!source) {
      throw new NotFoundException('Bezugsrechnung nicht gefunden');
    }
    const otherKos = await tx.invoice.findMany({
      where: {
        creditedInvoiceId: invoice.creditedInvoiceId,
        invoiceType: InvoiceType.CORRECTION,
        id: { not: invoice.id },
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.PARTIALLY_CORRECTED,
          ],
        },
      },
      select: { total: true },
    });
    // KO-Totals sind negativ → Summe der Absolutbeträge
    const used = round2(
      otherKos.reduce((sum, k) => sum + Math.abs(k.total), 0),
    );
    const thisAbs = Math.abs(invoice.total);
    if (round2(used + thisAbs) > round2(source.total) + 0.001) {
      throw new BadRequestException(
        `Korrekturbetrag übersteigt den Restbetrag der Rechnung (max. ${round2(source.total - used).toFixed(2)} €)`,
      );
    }
  }
}

function formatDeDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
