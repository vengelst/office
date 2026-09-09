/**
 * Mappt Invoice + Company + Customer → EN-16931-Canonical.
 */

import { BadRequestException } from '@nestjs/common';
import type { En16931Invoice, En16931Line } from './en16931.model';
import type { CompanyInfo } from '../company.config';

type InvoiceLineLike = {
  id: string;
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  total: number;
  taxRate?: number | null;
};

type CustomerLike = {
  companyName: string;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  vatId?: string | null;
  taxNumber?: string | null;
  leitwegId?: string | null;
  emails?: { email: string; emailType: string; isPrimary: boolean }[];
};

type InvoiceLike = {
  invoiceNumber: string | null;
  finalizedAt: Date | null;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  lines: InvoiceLineLike[];
  customer: CustomerLike | null;
};

const UNIT_MAP: Record<string, string> = {
  h: 'HUR',
  std: 'HUR',
  stunde: 'HUR',
  stunden: 'HUR',
  hour: 'HUR',
  hours: 'HUR',
  stk: 'C62',
  stück: 'C62',
  stueck: 'C62',
  pc: 'C62',
  pcs: 'C62',
  pauschal: 'LS',
  pauschale: 'LS',
  ls: 'LS',
  m: 'MTR',
  meter: 'MTR',
  km: 'KMT',
  kg: 'KGM',
  tag: 'DAY',
  tage: 'DAY',
};

export function mapUnitToUnece(unit?: string | null): string {
  if (!unit?.trim()) return 'C62';
  const key = unit.trim().toLowerCase();
  return UNIT_MAP[key] ?? 'C62';
}

function countryCode(raw?: string | null): string {
  if (!raw?.trim()) return 'DE';
  const v = raw.trim().toUpperCase();
  if (v.length === 2) return v;
  if (v.startsWith('DE') || v.includes('DEUTSCH')) return 'DE';
  return 'DE';
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function mapInvoiceToEn16931(
  invoice: InvoiceLike,
  company: CompanyInfo,
): En16931Invoice {
  if (!invoice.invoiceNumber || !invoice.finalizedAt) {
    throw new BadRequestException(
      'E-Rechnung nur für finalisierte Rechnungen mit Nummer',
    );
  }
  if (!invoice.customer) {
    throw new BadRequestException('Rechnung hat keinen Kunden');
  }
  const sellerVat = (company.vatId ?? '').trim();
  if (!sellerVat) {
    throw new BadRequestException(
      'Firmen-USt-IdNr. fehlt – unter Einstellungen → Firma hinterlegen',
    );
  }
  const buyer = invoice.customer;
  if (!buyer.addressLine1?.trim() || !buyer.postalCode?.trim() || !buyer.city?.trim()) {
    throw new BadRequestException(
      'Kundenadresse unvollständig (Straße, PLZ, Ort) – für E-Rechnung erforderlich',
    );
  }

  const billingEmail =
    buyer.emails?.find((e) => e.emailType === 'BILLING' && e.isPrimary)?.email ??
    buyer.emails?.find((e) => e.emailType === 'BILLING')?.email ??
    buyer.emails?.find((e) => e.isPrimary)?.email;

  const lines: En16931Line[] = invoice.lines.map((l, idx) => {
    const vatPercent = l.taxRate ?? invoice.taxRate ?? 19;
    return {
      id: String(idx + 1),
      name: l.description || `Position ${idx + 1}`,
      quantity: Number(l.quantity),
      unitCode: mapUnitToUnece(l.unit),
      netUnitPrice: Number(l.unitPrice),
      netAmount: Number(l.total),
      vatPercent: Number(vatPercent),
    };
  });

  if (!lines.length) {
    throw new BadRequestException('Rechnung hat keine Positionen');
  }

  const issueDate = invoice.issueDate ?? invoice.finalizedAt;

  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: ymd(issueDate),
    dueDate: invoice.dueDate ? ymd(invoice.dueDate) : undefined,
    currency: 'EUR',
    seller: {
      name: company.name,
      street: company.address,
      postalCode: undefined,
      city: undefined,
      countryCode: 'DE',
      vatId: sellerVat,
      taxNumber: company.taxNumber,
      email: company.email,
      iban: company.bankIban,
      bic: company.bankBic,
    },
    buyer: {
      name: buyer.companyName,
      street: buyer.addressLine1 ?? undefined,
      postalCode: buyer.postalCode ?? undefined,
      city: buyer.city ?? undefined,
      countryCode: countryCode(buyer.country),
      vatId: buyer.vatId ?? undefined,
      taxNumber: buyer.taxNumber ?? undefined,
      email: billingEmail,
      buyerReference: buyer.leitwegId?.trim() || undefined,
    },
    lines,
    netTotal: Number(invoice.subtotal),
    vatTotal: Number(invoice.taxAmount),
    grossTotal: Number(invoice.total),
    paymentMeansNote: company.bankIban
      ? `IBAN ${company.bankIban}${company.bankBic ? ` BIC ${company.bankBic}` : ''}`
      : undefined,
    note: invoice.notes ?? undefined,
  };
}
