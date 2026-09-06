/**
 * EU-VIES USt-IdNr.-Prüfung (REST) mit Timeout und graceful Fehlerbehandlung.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

const VIES_URL =
  'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';
const VIES_TIMEOUT_MS = 12_000;

/** EU-Mitgliedstaaten (ISO-3166-1 alpha-2) inkl. XI (Nordirland). */
const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'XI',
]);

export interface ViesCheckResult {
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  name: string | null;
  requestIdentifier: string | null;
  requestDate: string | null;
}

@Injectable()
export class ViesService {
  private readonly logger = new Logger(ViesService.name);

  /**
   * Parst USt-IdNr. in Ländercode + Nummer (ohne Prefix).
   * Akzeptiert z. B. "DE123456789" oder "DE 123 456 789".
   */
  parseVatId(raw: string): { countryCode: string; vatNumber: string } {
    const cleaned = raw.replace(/[\s.\-]/g, '').toUpperCase();
    if (cleaned.length < 4) {
      throw new BadRequestException('USt-IdNr. ist zu kurz');
    }
    const countryCode = cleaned.slice(0, 2);
    const vatNumber = cleaned.slice(2);
    if (!/^[A-Z]{2}$/.test(countryCode) || !vatNumber) {
      throw new BadRequestException(
        'USt-IdNr. muss mit dem Ländercode beginnen (z. B. DE123456789)',
      );
    }
    if (!EU_COUNTRY_CODES.has(countryCode === 'GR' ? 'EL' : countryCode)) {
      throw new BadRequestException(
        `Ländercode ${countryCode} ist kein EU-Mitgliedstaat (VIES)`,
      );
    }
    return {
      countryCode: countryCode === 'GR' ? 'EL' : countryCode,
      vatNumber,
    };
  }

  /** Prüft eine USt-IdNr. über die offizielle VIES-REST-API. */
  async checkVat(rawVatId: string): Promise<ViesCheckResult> {
    const { countryCode, vatNumber } = this.parseVatId(rawVatId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS);
    try {
      const res = await fetch(VIES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ countryCode, vatNumber }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`VIES HTTP ${res.status}`);
        throw new BadRequestException(
          `VIES-Prüfung fehlgeschlagen (HTTP ${res.status}). Bitte später erneut versuchen.`,
        );
      }
      const data = (await res.json()) as {
        valid?: boolean;
        name?: string;
        requestIdentifier?: string;
        requestDate?: string;
        userError?: string;
        errorWrappers?: Array<{ error?: string }>;
      };
      if (data.userError || data.errorWrappers?.length) {
        const msg =
          data.userError ||
          data.errorWrappers?.map((e) => e.error).filter(Boolean).join(', ') ||
          'VIES-Fehler';
        throw new BadRequestException(`VIES: ${msg}`);
      }
      const name =
        data.name && data.name !== '---' && data.name.trim()
          ? data.name.trim()
          : null;
      return {
        valid: Boolean(data.valid),
        countryCode,
        vatNumber,
        name,
        requestIdentifier: data.requestIdentifier?.trim() || null,
        requestDate: data.requestDate ?? null,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if ((err as Error)?.name === 'AbortError') {
        throw new BadRequestException(
          'VIES-Zeitüberschreitung. Bitte später erneut prüfen.',
        );
      }
      this.logger.warn(`VIES Fehler: ${(err as Error).message}`);
      throw new BadRequestException(
        'VIES ist derzeit nicht erreichbar. Bitte später erneut versuchen.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
