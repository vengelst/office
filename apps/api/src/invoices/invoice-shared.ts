/**
 * Gemeinsame Typen, Selects und reine Hilfsfunktionen für Rechnungen.
 */

import {
  InvoiceLineType,
  InvoiceStatus,
  InvoiceType,
  Prisma,
} from '@prisma/client';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';

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
    },
  },
  subcontractor: { select: { id: true, name: true } },
  createdBy: { select: { id: true, displayName: true } },
  lines: { orderBy: { position: 'asc' } },
  payments: { orderBy: { paidDate: 'asc' } },
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
export function computeTotals(
  lines: Array<{ total?: number }>,
  taxRate: number,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = round2(lines.reduce((sum, l) => sum + (l.total ?? 0), 0));
  const taxAmount = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, total };
}

export { InvoiceLineType, InvoiceStatus, InvoiceType };
