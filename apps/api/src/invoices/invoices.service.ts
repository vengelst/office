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
  InvoiceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingSettingsService } from '../app-settings/billing-settings.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { GenerateFromTimesheetsDto } from './dto/generate-from-timesheets.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceExportService } from './invoice-export.service';
import { InvoiceGenerationService } from './invoice-generation.service';
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
  listSelect,
  round2,
} from './invoice-shared';

export type { ListInvoicesParams } from './invoice-shared';

/**
 * Service für die Rechnungsverwaltung.
 * Behandelt Erstellung, Bearbeitung, Finalisierung (DRAFT → SENT),
 * Gutschrift/Storno, Zahlungserfassung; PDF und Generierung delegiert.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: InvoiceExportService,
    private readonly generationService: InvoiceGenerationService,
    private readonly billingSettings: BillingSettingsService,
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
    if (dto.invoiceType === InvoiceType.CREDIT_NOTE) {
      throw new BadRequestException(
        'Gutschriften entstehen nur über Storno einer finalisierten Rechnung',
      );
    }

    await this.validateRelations(
      dto.invoiceType,
      dto.projectId,
      dto.customerId,
      dto.subcontractorId,
    );

    const taxRate = await this.resolveTaxRate(
      dto.taxRate,
      dto.performanceCountryCode,
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

    const taxRate =
      dto.taxRate !== undefined
        ? await this.resolveTaxRate(dto.taxRate, dto.performanceCountryCode)
        : dto.performanceCountryCode
          ? await this.resolveTaxRate(undefined, dto.performanceCountryCode)
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
        taxRate:
          dto.taxRate !== undefined || dto.performanceCountryCode !== undefined
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
      (dto.performanceCountryCode !== undefined &&
        taxRate !== invoice.taxRate)
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
   * Finalisiert eine Ausgangsrechnung (nur SUPERADMIN): vergibt RE-Nummer,
   * setzt Status SENT, issueDate/dueDate und archiviert PDF.
   */
  async finalize(id: string, userId: string | null) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Nur Entwürfe können finalisiert werden');
    }
    if (invoice.invoiceType !== InvoiceType.OUTGOING) {
      throw new BadRequestException(
        'Nur Ausgangsrechnungen können finalisiert werden',
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

    const billing = await this.billingSettings.getSettingsOnly();
    const termDays =
      invoice.paymentTermDays ??
      invoice.customer?.paymentTermDays ??
      billing.defaultPaymentTermDays ??
      DEFAULT_PAYMENT_TERM_DAYS;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + termDays);

    await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.billingSettings.allocateNumber(
        InvoiceSeriesCode.OUTGOING,
        tx,
      );
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          status: InvoiceStatus.SENT,
          issueDate,
          paymentTermDays: termDays,
          dueDate,
          finalizedAt: issueDate,
          finalizedByUserId: userId,
        },
      });
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
   * Storno einer finalisierten Ausgangsrechnung über Gutschrift.
   * Erzeugt CREDIT_NOTE (GS-…), Original → CANCELLED (Beträge/PDF bleiben).
   */
  async createCreditNote(id: string, userId: string | null) {
    const source = await this.findOne(id);
    if (source.invoiceType !== InvoiceType.OUTGOING) {
      throw new BadRequestException(
        'Gutschriften sind nur für Ausgangsrechnungen möglich',
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
    if (source.creditNotes?.length) {
      throw new ConflictException(
        'Zu dieser Rechnung existiert bereits eine Gutschrift',
      );
    }

    const issueDate = new Date();
    const creditId = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.billingSettings.allocateNumber(
        InvoiceSeriesCode.CREDIT_NOTE,
        tx,
      );

      const credit = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: InvoiceType.CREDIT_NOTE,
          status: InvoiceStatus.SENT,
          projectId: source.projectId,
          customerId: source.customerId,
          creditedInvoiceId: source.id,
          periodFrom: source.periodFrom,
          periodTo: source.periodTo,
          performanceCountryCode: source.performanceCountryCode,
          taxRate: source.taxRate,
          subtotal: source.subtotal,
          taxAmount: source.taxAmount,
          total: source.total,
          isPartialInvoice: source.isPartialInvoice,
          partialNumber: source.partialNumber,
          partialPercentage: source.partialPercentage,
          paymentTermDays: source.paymentTermDays,
          issueDate,
          dueDate: issueDate,
          notes: source.notes
            ? `Gutschrift zu ${source.invoiceNumber}\n${source.notes}`
            : `Gutschrift zu ${source.invoiceNumber}`,
          internalNotes: source.internalNotes,
          finalizedAt: issueDate,
          finalizedByUserId: userId,
          createdByUserId: userId,
          lines: {
            create: source.lines.map((l) => ({
              lineType: l.lineType,
              position: l.position,
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unitPrice,
              total: l.total,
              weeklyTimesheetId: l.weeklyTimesheetId,
            })),
          },
        },
        select: { id: true },
      });

      // Original stornieren – Beträge und PDF bleiben nachvollziehbar
      await tx.invoice.update({
        where: { id: source.id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      return credit.id;
    });

    const creditNote = await this.findOne(creditId);
    this.exportService.exportInvoicePdfAsync(creditNote);
    return creditNote;
  }

  /**
   * Storniert nur Entwürfe (ohne Gutschrift). Finalisierte RE → createCreditNote.
   */
  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Rechnung ist bereits storniert');
    }
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Finalisierte Rechnungen bitte über Gutschrift stornieren',
      );
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
      source.invoiceType === InvoiceType.CREDIT_NOTE
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
        total: l.total,
        weeklyTimesheet: l.weeklyTimesheetId
          ? { connect: { id: l.weeklyTimesheetId } }
          : undefined,
      }),
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

  /**
   * Aktualisiert eine bestehende Position und berechnet die Rechnungssummen neu.
   *
   * @param invoiceId - UUID der Rechnung (muss DRAFT sein)
   * @param lineId - UUID der Position
   * @param dto - Zu aktualisierende Felder
   * @returns Die aktualisierte Position
   */
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
          invoiceType: { in: [InvoiceType.OUTGOING, InvoiceType.CREDIT_NOTE] },
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

    // Umsatz: Ausgang positiv, Gutschriften abziehen
    const revenueMonth = revenueRows
      .filter((r) => r.issueDate >= startOfMonth)
      .reduce(
        (sum, r) =>
          sum +
          (r.invoiceType === InvoiceType.CREDIT_NOTE ? -r.subtotal : r.subtotal),
        0,
      );
    const revenueYear = revenueRows.reduce(
      (sum, r) =>
        sum +
        (r.invoiceType === InvoiceType.CREDIT_NOTE ? -r.subtotal : r.subtotal),
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
   * MwSt aus DTO oder Leistungsort-Land ableiten.
   */
  private async resolveTaxRate(
    taxRate?: number,
    performanceCountryCode?: string,
  ): Promise<number> {
    if (taxRate != null && !Number.isNaN(taxRate)) {
      return taxRate;
    }
    if (performanceCountryCode?.trim()) {
      const settings = await this.billingSettings.getSettingsOnly();
      const code = performanceCountryCode.trim().toUpperCase();
      const country = settings.performanceCountries.find(
        (c) => c.countryCode.toUpperCase() === code,
      );
      if (country) return country.standardRate;
    }
    return 19;
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
      select: { taxRate: true, lines: { select: { total: true } } },
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
}
