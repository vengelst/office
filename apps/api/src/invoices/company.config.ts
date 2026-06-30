/**
 * Firmendaten für den Rechnungs-PDF-Header.
 * Werden aus Umgebungsvariablen geladen, mit sinnvollen Dev-Defaults.
 */
export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
}

export function loadCompanyInfo(): CompanyInfo {
  return {
    name: process.env.COMPANY_NAME ?? 'Muster Elektrotechnik GmbH',
    address: process.env.COMPANY_ADDRESS ?? 'Industriestr. 42, 40625 Düsseldorf',
    phone: process.env.COMPANY_PHONE ?? '0211 12345678',
    email: process.env.COMPANY_EMAIL ?? 'info@muster-elektro.de',
    taxNumber: process.env.COMPANY_TAX_NUMBER ?? 'DE123456789',
    bankName: process.env.COMPANY_BANK_NAME ?? 'Deutsche Bank',
    bankIban: process.env.COMPANY_BANK_IBAN ?? 'DE89 3704 0044 0532 0130 00',
    bankBic: process.env.COMPANY_BANK_BIC ?? 'COBADEFFXXX',
  };
}
