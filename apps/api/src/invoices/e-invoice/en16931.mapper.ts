/**
 * Mappt Office-Invoice + Firmendaten + Kunde auf das EN-16931-Modell.
 */

import { InvoiceTaxKind, InvoiceType } from '@prisma/client';
import type { CompanyInfo } from '../company.config';
import type { En16931Invoice, En16931TaxBreakdown } from './en16931.model';
import { mapUnitCode } from './unit-code.map';

export interface InvoiceForEInvoice {
  invoiceNumber: string | null;
  invoiceType: InvoiceType;
  issueDate: Date;
  dueDate: Date | null;
  periodFrom: Date | null;
  periodTo: Date | null;
  taxKind: InvoiceTaxKind;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  taxBreakdown: unknown;
  paidAmount: number | null;
  creditedInvoice?: { invoiceNumber: string | null } | null;
  lines: Array<{
    id: string;
    position: number;
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    total: number;
    taxRate: number | null;
  }>;
  customer: {
    companyName: string;
    vatId: string | null;
    taxNumber: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    leitwegId: string | null;
    emails?: Array<{ email: string; emailType: string; isPrimary: boolean }>;
    contacts?: Array<{
      firstName: string;
      lastName: string;
      email: string | null;
      phoneMobile: string | null;
      phoneLandline: string | null;
      isAccountingContact: boolean;
    }>;
  } | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseAddress(companyAddress: string): {
  line1: string;
  postalCode: string;
  city: string;
  countryCode: string;
} {
  // Erwartet typisch: "Straße, PLZ Ort" oder "Straße, PLZ Ort, DE"
  const parts = companyAddress.split(',').map((p) => p.trim()).filter(Boolean);
  const line1 = parts[0] ?? companyAddress;
  let postalCode = '';
  let city = '';
  let countryCode = 'DE';
  if (parts.length >= 2) {
    const m = /^(\d{4,5})\s+(.+)$/.exec(parts[1]);
    if (m) {
      postalCode = m[1];
      city = m[2];
    } else {
      city = parts[1];
    }
  }
  if (parts.length >= 3 && /^[A-Z]{2}$/i.test(parts[2])) {
    countryCode = parts[2].toUpperCase();
  }
  return { line1, postalCode, city, countryCode };
}

function taxCategory(
  taxKind: InvoiceTaxKind,
  rate: number,
): En16931TaxBreakdown['taxCategory'] {
  if (taxKind === 'REVERSE_CHARGE') return 'AE';
  if (taxKind === 'TAX_EXEMPT' || rate === 0) return 'Z';
  return 'S';
}

/**
 * Baut das kanonische EN-16931-Modell.
 */
export function mapInvoiceToEn16931(
  invoice: InvoiceForEInvoice,
  company: CompanyInfo & {
    country?: string;
    addressLine1?: string;
    postalCode?: string;
    city?: string;
    electronicAddress?: string;
  },
): En16931Invoice {
  if (!invoice.invoiceNumber) {
    throw new Error('Rechnung ohne Nummer – bitte zuerst finalisieren');
  }
  if (!invoice.customer) {
    throw new Error('Rechnung ohne Kunden');
  }

  const sellerAddr = company.addressLine1
    ? {
        line1: company.addressLine1,
        postalCode: company.postalCode ?? '',
        city: company.city ?? '',
        countryCode: (company.country ?? 'DE').slice(0, 2).toUpperCase(),
      }
    : parseAddress(company.address);

  const buyer = invoice.customer;
  const accounting =
    buyer.contacts?.find((c) => c.isAccountingContact) ??
    buyer.contacts?.[0];
  const billingEmail =
    buyer.emails?.find((e) => e.emailType === 'BILLING' && e.isPrimary)?.email ??
    buyer.emails?.find((e) => e.emailType === 'BILLING')?.email ??
    accounting?.email ??
    undefined;

  const typeCode: '380' | '381' =
    invoice.invoiceType === InvoiceType.STORNO ||
    invoice.invoiceType === InvoiceType.CORRECTION
      ? '381'
      : '380';

  const lines = invoice.lines.map((l) => {
    const rate = l.taxRate ?? invoice.taxRate;
    return {
      id: l.id,
      position: l.position,
      name: l.description.slice(0, 100) || `Position ${l.position}`,
      description: l.description,
      quantity: l.quantity,
      unitCode: mapUnitCode(l.unit),
      unitPrice: round2(l.unitPrice),
      netAmount: round2(l.total),
      taxPercent: rate,
      taxCategory: taxCategory(invoice.taxKind, rate),
    };
  });

  let taxBreakdown: En16931TaxBreakdown[] = [];
  if (Array.isArray(invoice.taxBreakdown)) {
    taxBreakdown = (invoice.taxBreakdown as Array<Record<string, number>>).map(
      (t) => ({
        taxableAmount: round2(Number(t.net ?? t.taxableAmount ?? 0)),
        taxAmount: round2(Number(t.tax ?? t.taxAmount ?? 0)),
        taxPercent: Number(t.rate ?? t.taxPercent ?? invoice.taxRate),
        taxCategory: taxCategory(
          invoice.taxKind,
          Number(t.rate ?? t.taxPercent ?? invoice.taxRate),
        ),
      }),
    );
  }
  if (taxBreakdown.length === 0) {
    taxBreakdown = [
      {
        taxableAmount: round2(invoice.subtotal),
        taxAmount: round2(invoice.taxAmount),
        taxPercent: invoice.taxRate,
        taxCategory: taxCategory(invoice.taxKind, invoice.taxRate),
      },
    ];
  }

  const paid = invoice.paidAmount ?? 0;
  const amountDue = round2(invoice.total - paid);

  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: isoDate(invoice.issueDate),
    dueDate: invoice.dueDate ? isoDate(invoice.dueDate) : undefined,
    typeCode,
    currencyCode: 'EUR',
    buyerReference: buyer.leitwegId ?? undefined,
    seller: {
      name: company.name,
      vatId: company.vatId || undefined,
      taxNumber: company.taxNumber || undefined,
      address: sellerAddr,
      electronicAddress:
        company.electronicAddress || company.email || undefined,
      electronicAddressScheme: 'EM',
      contactEmail: company.email || undefined,
      contactPhone: company.phone || undefined,
    },
    buyer: {
      name: buyer.companyName,
      vatId: buyer.vatId ?? undefined,
      taxNumber: buyer.taxNumber ?? undefined,
      address: {
        line1: buyer.addressLine1 ?? '',
        line2: buyer.addressLine2 ?? undefined,
        postalCode: buyer.postalCode ?? '',
        city: buyer.city ?? '',
        countryCode: (buyer.country ?? 'DE').slice(0, 2).toUpperCase(),
      },
      buyerReference: buyer.leitwegId ?? undefined,
      electronicAddress: billingEmail,
      electronicAddressScheme: billingEmail ? 'EM' : undefined,
      contactName: accounting
        ? `${accounting.firstName} ${accounting.lastName}`
        : undefined,
      contactEmail: accounting?.email ?? billingEmail,
      contactPhone:
        accounting?.phoneMobile ?? accounting?.phoneLandline ?? undefined,
    },
    lines,
    taxBreakdown,
    lineNetTotal: round2(invoice.subtotal),
    taxTotal: round2(invoice.taxAmount),
    grandTotal: round2(invoice.total),
    amountDue,
    paymentMeans: {
      iban: company.bankIban?.replace(/\s/g, '') || undefined,
      bic: company.bankBic || undefined,
      accountName: company.name,
      paymentMeansCode: '30',
    },
    note: invoice.notes ?? undefined,
    periodFrom: invoice.periodFrom ? isoDate(invoice.periodFrom) : undefined,
    periodTo: invoice.periodTo ? isoDate(invoice.periodTo) : undefined,
    precedingInvoiceNumber:
      invoice.creditedInvoice?.invoiceNumber ?? undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
