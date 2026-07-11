import { Logger } from '@nestjs/common';

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

const DEV_DEFAULTS: CompanyInfo = {
  name: 'Muster Elektrotechnik GmbH',
  address: 'Industriestr. 42, 40625 Düsseldorf',
  phone: '0211 12345678',
  email: 'info@muster-elektro.de',
  taxNumber: 'DE123456789',
  bankName: 'Deutsche Bank',
  bankIban: 'DE89 3704 0044 0532 0130 00',
  bankBic: 'COBADEFFXXX',
};

const COMPANY_KEYS: (keyof CompanyInfo)[] = [
  'name',
  'address',
  'phone',
  'email',
  'taxNumber',
  'bankName',
  'bankIban',
  'bankBic',
];

const ENV_MAP: Record<keyof CompanyInfo, string> = {
  name: 'COMPANY_NAME',
  address: 'COMPANY_ADDRESS',
  phone: 'COMPANY_PHONE',
  email: 'COMPANY_EMAIL',
  taxNumber: 'COMPANY_TAX_NUMBER',
  bankName: 'COMPANY_BANK_NAME',
  bankIban: 'COMPANY_BANK_IBAN',
  bankBic: 'COMPANY_BANK_BIC',
};

/**
 * Lädt Firmendaten aus Umgebungsvariablen.
 * In Produktion: Warnt für jeden fehlenden Wert (Muster-Defaults auf Rechnungen).
 */
export function loadCompanyInfo(): CompanyInfo {
  const logger = new Logger('CompanyConfig');
  const isProduction = process.env.NODE_ENV === 'production';
  const info = { ...DEV_DEFAULTS };

  for (const key of COMPANY_KEYS) {
    const envVal = process.env[ENV_MAP[key]];
    if (envVal) {
      info[key] = envVal;
    } else if (isProduction) {
      logger.warn(
        `${ENV_MAP[key]} nicht gesetzt – Muster-Wert "${DEV_DEFAULTS[key]}" wird verwendet!`,
      );
    }
  }

  return info;
}
