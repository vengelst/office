/**
 * Gemeinsame Typen, Selects und reine Hilfsfunktionen für Rechnungen.
 */

import {
  InvoiceLineType,
  InvoiceStatus,
  InvoiceTaxKind,
  InvoiceType,
  Prisma,
} from '@prisma/client';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { computeLineNet } from './line-totals';

/** Sortierbare Spalten der Rechnungsliste. */
export const SORTABLE_FIELDS = [
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'total',
  'status',
  'createdAt',
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

/** Standard-Zahlungsziel (Tage), falls weder Rechnung noch Kunde eines setzen. */
export const DEFAULT_PAYMENT_TERM_DAYS = 14;

/** Status, in denen offene Beträge entstehen. */
export const OPEN_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PARTIALLY_CORRECTED,
];

/** Steuer je Satz (aus Netto je Satz, kaufmännisch 2 NK). */
export interface TaxBreakdownLine {
  rate: number;
  net: number;
  tax: number;
  gross: number;
}

/**
 * Vorzeichen-Konvention ST/KO: Positionen und Header-Summen negativ
 * (Spiegelung der RE). OUTGOING bleibt positiv.
 */
export const NEGATIVE_TOTAL_TYPES: InvoiceType[] = [
  InvoiceType.STORNO,
  InvoiceType.CORRECTION,
];

export function isNegativeTotalType(type: InvoiceType): boolean {
  return NEGATIVE_TOTAL_TYPES.includes(type);
}

/** Kalendermonat (UTC) als Steuerperiode. */
export function taxPeriodBounds(date: Date): { from: Date; to: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  };
}

/** PDF-/UI-Titel je Belegart (ohne „Gutschrift“). */
export function documentTitleForType(type: InvoiceType): string {
  switch (type) {
    case InvoiceType.STORNO:
      return 'Stornorechnung';
    case InvoiceType.CORRECTION:
      return 'Rechnungskorrektur';
    case InvoiceType.INCOMING:
      return 'Eingangsrechnung';
    default:
      return 'Rechnung';
  }
}

export function seriesCodeForType(
  type: InvoiceType,
): 'OUTGOING' | 'STORNO' | 'CORRECTION' | null {
  if (type === InvoiceType.OUTGOING) return 'OUTGOING';
  if (type === InvoiceType.STORNO) return 'STORNO';
  if (type === InvoiceType.CORRECTION) return 'CORRECTION';
  return null;
}

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
export const listSelect = {
  id: true,
  invoiceNumber: true,
  invoiceType: true,
  status: true,
  periodFrom: true,
  periodTo: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  taxKind: true,
  total: true,
  paidAmount: true,
  isPartialInvoice: true,
  partialNumber: true,
  partialPercentage: true,
  performanceCountryCode: true,
  issueDate: true,
  dueDate: true,
  paidDate: true,
  finalizedAt: true,
  creditedInvoiceId: true,
  correctionReason: true,
  taxPeriodFrom: true,
  taxPeriodTo: true,
  taxBreakdown: true,
  createdAt: true,
  project: { select: { id: true, projectNumber: true, title: true } },
  customer: { select: { id: true, companyName: true } },
  subcontractor: { select: { id: true, name: true } },
  creditedInvoice: {
    select: { id: true, invoiceNumber: true, status: true },
  },
  _count: { select: { lines: true, payments: true, creditNotes: true } },
} satisfies Prisma.InvoiceSelect;

/** Vollständige Projektion für die Detailansicht. */
export const detailInclude = {
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
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      vatId: true,
      vatIdValid: true,
      vatIdValidatedAt: true,
      vatIdViesName: true,
      emails: {
        select: {
          id: true,
          email: true,
          emailType: true,
          isPrimary: true,
          label: true,
        },
      },
    },
  },
  subcontractor: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  finalizedBy: { select: { id: true, displayName: true } },
  creditedInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      total: true,
      issueDate: true,
      invoiceType: true,
    },
  },
  creditNotes: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      status: true,
      total: true,
      issueDate: true,
      correctionReason: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      product: {
        select: { id: true, code: true, name: true, unit: true },
      },
      weeklyTimesheet: {
        select: {
          id: true,
          weekNumber: true,
          weekYear: true,
          worker: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
  payments: { orderBy: { paidDate: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

/** Datumsfelder von ISO-Strings nach Date konvertieren. */
export function coerceDate(value?: string): Date | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

/** Kaufmännisch auf 2 Nachkommastellen runden. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Wandelt Line-DTOs in Prisma-Create-Inputs (mit Position + Summe) um.
 */
export function buildLineData(
  lines: CreateInvoiceLineDto[],
  options?: { negateTotals?: boolean },
): Prisma.InvoiceLineCreateWithoutInvoiceInput[] {
  return lines.map((l, index) => {
    const quantity = l.quantity ?? 1;
    const unitPrice = l.unitPrice ?? 0;
    const discountPercent = l.discountPercent ?? null;
    const discountAmount = l.discountAmount ?? null;
    const taxRate = l.taxRate ?? null;
    let total = computeLineNet({
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
    });
    if (options?.negateTotals) {
      total = -Math.abs(total);
    }
    return {
      lineType: l.lineType,
      position: l.position ?? index,
      description: l.description,
      quantity,
      unit: l.unit,
      unitPrice,
      discountPercent,
      discountAmount,
      taxRate,
      product: l.productId ? { connect: { id: l.productId } } : undefined,
      total,
      weeklyTimesheet: l.weeklyTimesheetId
        ? { connect: { id: l.weeklyTimesheetId } }
        : undefined,
    };
  });
}

/**
 * Steuer je Satz: Nettosumme je Steuersatz → Steuer = round2(net * rate / 100).
 * Nicht Summe positionsweise gerundeter Steuer.
 */
export function computeTaxBreakdown(
  lines: Array<{ total?: number; taxRate?: number | null }>,
  defaultTaxRate: number,
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: TaxBreakdownLine[];
} {
  const byRate = new Map<number, number>();
  for (const l of lines) {
    const rate = l.taxRate != null && !Number.isNaN(l.taxRate)
      ? l.taxRate
      : defaultTaxRate;
    byRate.set(rate, round2((byRate.get(rate) ?? 0) + (l.total ?? 0)));
  }
  const taxBreakdown: TaxBreakdownLine[] = [];
  let subtotal = 0;
  let taxAmount = 0;
  for (const [rate, net] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
    const tax = round2((net * rate) / 100);
    const gross = round2(net + tax);
    taxBreakdown.push({ rate, net, tax, gross });
    subtotal = round2(subtotal + net);
    taxAmount = round2(taxAmount + tax);
  }
  return {
    subtotal,
    taxAmount,
    total: round2(subtotal + taxAmount),
    taxBreakdown,
  };
}

/** Summen aus Positionsdaten berechnen (inkl. Steuer je Satz). */
export function computeTotals(
  lines: Array<{ total?: number; taxRate?: number | null }>,
  taxRate: number,
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: TaxBreakdownLine[];
} {
  return computeTaxBreakdown(lines, taxRate);
}

/** Effektiver Steuersatz aus taxKind + Länderliste / explizitem Satz. */
export function effectiveTaxRateForKind(
  taxKind: InvoiceTaxKind,
  explicitRate: number | undefined,
  countryRates: { standardRate: number; reducedRate: number } | null,
): number {
  if (
    taxKind === InvoiceTaxKind.REVERSE_CHARGE ||
    taxKind === InvoiceTaxKind.TAX_EXEMPT
  ) {
    return 0;
  }
  if (taxKind === InvoiceTaxKind.REDUCED) {
    if (explicitRate != null && !Number.isNaN(explicitRate)) return explicitRate;
    return countryRates?.reducedRate ?? 7;
  }
  if (explicitRate != null && !Number.isNaN(explicitRate)) return explicitRate;
  return countryRates?.standardRate ?? 19;
}

/** Cast taxBreakdown for Prisma Json field. */
export function toJsonBreakdown(
  taxBreakdown: TaxBreakdownLine[],
): Prisma.InputJsonValue {
  return taxBreakdown as unknown as Prisma.InputJsonValue;
}

export { InvoiceLineType, InvoiceStatus, InvoiceType, InvoiceTaxKind };
