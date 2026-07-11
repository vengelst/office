import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

/**
 * Lädt Firmendaten: zuerst aus der DB (AppSettings), dann aus ENV, zuletzt Dev-Defaults.
 */
export async function loadCompanyInfoFromDb(
  prisma: PrismaService,
): Promise<CompanyInfo> {
  const logger = new Logger('CompanyConfig');

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'company_info' },
    });

    if (setting) {
      const db = JSON.parse(setting.value);
      const addr = [
        db.addressLine1,
        [db.postalCode, db.city].filter(Boolean).join(' '),
        db.country,
      ]
        .filter((p: string) => p && p.trim())
        .join(', ');

      return {
        name: db.name || process.env.COMPANY_NAME || DEV_DEFAULTS.name,
        address: addr || process.env.COMPANY_ADDRESS || DEV_DEFAULTS.address,
        phone: db.phone || process.env.COMPANY_PHONE || DEV_DEFAULTS.phone,
        email: db.email || process.env.COMPANY_EMAIL || DEV_DEFAULTS.email,
        taxNumber:
          db.taxNumber ||
          db.vatId ||
          process.env.COMPANY_TAX_NUMBER ||
          DEV_DEFAULTS.taxNumber,
        bankName:
          db.bankName ||
          process.env.COMPANY_BANK_NAME ||
          DEV_DEFAULTS.bankName,
        bankIban:
          db.bankIban ||
          process.env.COMPANY_BANK_IBAN ||
          DEV_DEFAULTS.bankIban,
        bankBic:
          db.bankBic || process.env.COMPANY_BANK_BIC || DEV_DEFAULTS.bankBic,
      };
    }
  } catch (err) {
    logger.warn(`Firmeninfo aus DB laden fehlgeschlagen: ${(err as Error).message}`);
  }

  return loadCompanyInfo();
}

/**
 * Fallback: Lädt Firmendaten nur aus Umgebungsvariablen.
 */
export function loadCompanyInfo(): CompanyInfo {
  const logger = new Logger('CompanyConfig');
  const isProduction = process.env.NODE_ENV === 'production';

  const info: CompanyInfo = {
    name: process.env.COMPANY_NAME || DEV_DEFAULTS.name,
    address: process.env.COMPANY_ADDRESS || DEV_DEFAULTS.address,
    phone: process.env.COMPANY_PHONE || DEV_DEFAULTS.phone,
    email: process.env.COMPANY_EMAIL || DEV_DEFAULTS.email,
    taxNumber: process.env.COMPANY_TAX_NUMBER || DEV_DEFAULTS.taxNumber,
    bankName: process.env.COMPANY_BANK_NAME || DEV_DEFAULTS.bankName,
    bankIban: process.env.COMPANY_BANK_IBAN || DEV_DEFAULTS.bankIban,
    bankBic: process.env.COMPANY_BANK_BIC || DEV_DEFAULTS.bankBic,
  };

  if (isProduction && info.name === DEV_DEFAULTS.name) {
    logger.warn(
      'COMPANY_NAME nicht gesetzt – Muster-Daten werden auf Rechnungen verwendet!',
    );
  }

  return info;
}
