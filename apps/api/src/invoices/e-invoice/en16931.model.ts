/**
 * Kanonisches EN 16931 Modell (Business Terms) für E-Rechnung.
 */

export interface En16931Address {
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  /** ISO-3166-1 alpha-2 */
  countryCode: string;
}

export interface En16931Party {
  name: string;
  tradingName?: string;
  vatId?: string;
  taxNumber?: string;
  address: En16931Address;
  /** BT-34 / BT-49 elektronische Adresse */
  electronicAddress?: string;
  electronicAddressScheme?: string;
  /** BT-10 Buyer reference / Leitweg-ID */
  buyerReference?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface En16931Line {
  id: string;
  position: number;
  name: string;
  description?: string;
  quantity: number;
  /** UNECE Recommendation 20 unit code */
  unitCode: string;
  unitPrice: number;
  netAmount: number;
  taxPercent: number;
  taxCategory: 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O';
}

export interface En16931TaxBreakdown {
  taxableAmount: number;
  taxAmount: number;
  taxPercent: number;
  taxCategory: 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O';
}

export interface En16931PaymentMeans {
  iban?: string;
  bic?: string;
  accountName?: string;
  paymentMeansCode?: string;
}

export interface En16931Invoice {
  /** BT-1 */
  invoiceNumber: string;
  /** BT-2 YYYY-MM-DD */
  issueDate: string;
  /** BT-9 */
  dueDate?: string;
  /** BT-3: 380 commercial invoice, 381 credit note */
  typeCode: '380' | '381';
  currencyCode: string;
  buyerReference?: string;
  seller: En16931Party;
  buyer: En16931Party;
  lines: En16931Line[];
  taxBreakdown: En16931TaxBreakdown[];
  lineNetTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountDue: number;
  paymentMeans?: En16931PaymentMeans;
  note?: string;
  /** BT-73 / BT-74 Leistungszeitraum */
  periodFrom?: string;
  periodTo?: string;
  /** Referenz auf Originalrechnung (bei Storno/Korrektur) */
  precedingInvoiceNumber?: string;
}
