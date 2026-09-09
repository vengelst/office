/**
 * Canonical EN 16931 model for XRechnung / ZUGFeRD generation.
 */

export interface En16931Party {
  name: string;
  street?: string;
  postalCode?: string;
  city?: string;
  countryCode: string; // ISO 3166-1 alpha-2
  vatId?: string;
  taxNumber?: string;
  email?: string;
  /** Leitweg-ID / Buyer reference (BT-10) */
  buyerReference?: string;
  iban?: string;
  bic?: string;
}

export interface En16931Line {
  id: string;
  name: string;
  quantity: number;
  unitCode: string; // UNECE
  netUnitPrice: number;
  netAmount: number;
  vatPercent: number;
}

export interface En16931Invoice {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string;
  currency: string; // EUR
  seller: En16931Party;
  buyer: En16931Party;
  lines: En16931Line[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  paymentMeansNote?: string;
  note?: string;
}
