/**
 * Typen und Defaults für Verrechnung-Settings (Nummernkreise getrennt in InvoiceNumberSeries).
 */

export interface PerformanceCountry {
  countryCode: string;
  name: string;
  standardRate: number;
  reducedRate: number;
}

export interface SkontoSettings {
  /** Skonto in Prozent; null = kein Skonto. */
  percent: number | null;
  /** Skonto-Frist in Tagen. */
  days: number | null;
  /** PDF-Hinweis mit Platzhaltern. */
  pdfHintTemplate: string | null;
}

export interface BillingSettings {
  defaultPaymentTermDays: number;
  paymentTermOptions: number[];
  skonto: SkontoSettings;
  performanceCountries: PerformanceCountry[];
  /** PDF-Hinweis bei Reverse Charge (§13b); editierbar unter Verrechnung. */
  reverseChargePdfText: string;
}

export interface InvoiceSeriesView {
  code: 'OUTGOING' | 'STORNO' | 'CORRECTION';
  prefix: string;
  nextNumber: number;
  preview: string;
}

export interface BillingSettingsResponse {
  series: {
    re: InvoiceSeriesView;
    st: InvoiceSeriesView;
    ko: InvoiceSeriesView;
  };
  settings: BillingSettings;
}

export const BILLING_SETTINGS_KEY = 'billing_settings';

export const DEFAULT_REVERSE_CHARGE_PDF_TEXT =
  'Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG (Reverse Charge). Die Umsatzsteuer ist vom Leistungsempfänger zu entrichten.';

/** Max. Alter einer VIES-Prüfung in Tagen, bevor RC erneut prüfen muss. */
export const VAT_VALIDATION_MAX_AGE_DAYS = 90;

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  defaultPaymentTermDays: 14,
  paymentTermOptions: [7, 14, 30, 60],
  skonto: {
    percent: 2,
    days: 10,
    pdfHintTemplate:
      'Bei Zahlung innerhalb von {{skontoDays}} Tagen gewähren wir {{skontoPercent}} % Skonto ({{skontoAmount}}). Zahlungsziel ohne Abzug: {{dueDate}}. Rechnungs-Nr. {{invoiceNumber}} – {{companyName}}.',
  },
  reverseChargePdfText: DEFAULT_REVERSE_CHARGE_PDF_TEXT,
  performanceCountries: [
    {
      countryCode: 'DE',
      name: 'Deutschland',
      standardRate: 19,
      reducedRate: 7,
    },
    {
      countryCode: 'LU',
      name: 'Luxemburg',
      standardRate: 17,
      reducedRate: 8,
    },
    {
      countryCode: 'NL',
      name: 'Niederlande',
      standardRate: 21,
      reducedRate: 9,
    },
    {
      countryCode: 'FR',
      name: 'Frankreich',
      standardRate: 20,
      reducedRate: 5.5,
    },
  ],
};

/** Ersetzt Skonto-Platzhalter im PDF-Hinweistext. */
export function applySkontoTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
