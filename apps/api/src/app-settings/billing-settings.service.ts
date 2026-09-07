/**
 * Service für Verrechnung-Settings und RE/ST/KO-Nummernkreise.
 */

import {
  BadRequestException,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { InvoiceSeriesCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsService } from './app-settings.service';
import {
  BILLING_SETTINGS_KEY,
  BillingSettings,
  BillingSettingsResponse,
  DEFAULT_BILLING_SETTINGS,
  InvoiceSeriesView,
  PerformanceCountry,
  SkontoSettings,
} from './billing-settings.types';

const PREFIX_RE = /^[A-Za-z0-9]{1,8}$/;

const SERIES_DEFAULTS: Array<{
  code: InvoiceSeriesCode;
  prefix: string;
  nextNumber: number;
}> = [
  { code: InvoiceSeriesCode.OUTGOING, prefix: 'RE', nextNumber: 40000113 },
  { code: InvoiceSeriesCode.STORNO, prefix: 'ST', nextNumber: 40000001 },
  { code: InvoiceSeriesCode.CORRECTION, prefix: 'KO', nextNumber: 40000001 },
];

@Injectable()
export class BillingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettings: AppSettingsService,
  ) {}

  /** Liefert Nummernkreise + Verrechnung-Defaults. */
  async get(): Promise<BillingSettingsResponse> {
    const [settings, seriesRows] = await Promise.all([
      this.loadSettings(),
      this.ensureSeriesRows(),
    ]);
    const re = seriesRows.find((s) => s.code === InvoiceSeriesCode.OUTGOING)!;
    const st = seriesRows.find((s) => s.code === InvoiceSeriesCode.STORNO)!;
    const ko = seriesRows.find((s) => s.code === InvoiceSeriesCode.CORRECTION)!;
    return {
      series: {
        re: toSeriesView(re),
        st: toSeriesView(st),
        ko: toSeriesView(ko),
      },
      settings,
    };
  }

  /** Speichert Settings + Nummernkreise (Schreiben: SUPERADMIN). */
  async update(input: {
    series?: {
      re?: { prefix?: string; nextNumber?: number };
      st?: { prefix?: string; nextNumber?: number };
      ko?: { prefix?: string; nextNumber?: number };
    };
    settings?: Partial<BillingSettings>;
  }): Promise<BillingSettingsResponse> {
    if (input.series?.re) {
      await this.updateSeries(InvoiceSeriesCode.OUTGOING, input.series.re);
    }
    if (input.series?.st) {
      await this.updateSeries(InvoiceSeriesCode.STORNO, input.series.st);
    }
    if (input.series?.ko) {
      await this.updateSeries(InvoiceSeriesCode.CORRECTION, input.series.ko);
    }
    if (input.settings) {
      const current = await this.loadSettings();
      const merged = mergeSettings(current, input.settings);
      validateSettings(merged);
      await this.appSettings.set(
        BILLING_SETTINGS_KEY,
        JSON.stringify(merged),
      );
    }
    return this.get();
  }

  /** Liest Verrechnung-Settings (ohne Series). */
  async getSettingsOnly(): Promise<BillingSettings> {
    return this.loadSettings();
  }

  /**
   * Vergibt die nächste Geschäftsnummer transaktional und erhöht den Zähler.
   * Bei Unique-Konflikt Retry (max. 5).
   */
  async allocateNumber(
    code: InvoiceSeriesCode,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const rows = await tx.$queryRaw<
          Array<{ id: string; prefix: string; nextNumber: number }>
        >`
          SELECT id, prefix, "nextNumber"
          FROM "InvoiceNumberSeries"
          WHERE code = ${code}::"InvoiceSeriesCode"
          FOR UPDATE
        `;
        const row = rows[0];
        if (!row) {
          throw new ConflictException(
            `Nummernkreis ${code} nicht konfiguriert`,
          );
        }
        const invoiceNumber = `${row.prefix}-${row.nextNumber}`;
        const existing = await tx.invoice.findUnique({
          where: { invoiceNumber },
          select: { id: true },
        });
        if (existing) {
          await tx.invoiceNumberSeries.update({
            where: { code },
            data: { nextNumber: row.nextNumber + 1 },
          });
          continue;
        }
        await tx.invoiceNumberSeries.update({
          where: { code },
          data: { nextNumber: row.nextNumber + 1 },
        });
        return invoiceNumber;
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictException('Nummernvergabe fehlgeschlagen');
  }

  /** Vorschau der nächsten Nummer ohne Verbrauch. */
  async previewNext(code: InvoiceSeriesCode): Promise<string> {
    await this.ensureSeriesRows();
    const row = await this.prisma.invoiceNumberSeries.findUnique({
      where: { code },
    });
    if (!row) {
      throw new ConflictException(`Nummernkreis ${code} nicht konfiguriert`);
    }
    return `${row.prefix}-${row.nextNumber}`;
  }

  private async loadSettings(): Promise<BillingSettings> {
    const raw = await this.appSettings.get(BILLING_SETTINGS_KEY);
    if (!raw) {
      await this.appSettings.set(
        BILLING_SETTINGS_KEY,
        JSON.stringify(DEFAULT_BILLING_SETTINGS),
      );
      return structuredClone(DEFAULT_BILLING_SETTINGS);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<BillingSettings>;
      return mergeSettings(DEFAULT_BILLING_SETTINGS, parsed);
    } catch {
      return structuredClone(DEFAULT_BILLING_SETTINGS);
    }
  }

  private async ensureSeriesRows() {
    const existing = await this.prisma.invoiceNumberSeries.findMany();
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const def of SERIES_DEFAULTS) {
      if (!existing.some((e) => e.code === def.code)) {
        ops.push(
          this.prisma.invoiceNumberSeries.create({
            data: {
              code: def.code,
              prefix: def.prefix,
              nextNumber: def.nextNumber,
            },
          }),
        );
      }
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.prisma.invoiceNumberSeries.findMany();
  }

  private async updateSeries(
    code: InvoiceSeriesCode,
    patch: { prefix?: string; nextNumber?: number },
  ): Promise<void> {
    await this.ensureSeriesRows();
    const current = await this.prisma.invoiceNumberSeries.findUnique({
      where: { code },
    });
    if (!current) {
      throw new ConflictException(`Nummernkreis ${code} nicht konfiguriert`);
    }

    const prefix =
      patch.prefix !== undefined
        ? patch.prefix.trim().toUpperCase()
        : current.prefix;
    if (!PREFIX_RE.test(prefix)) {
      throw new BadRequestException(
        'Prefix muss 1–8 alphanumerische Zeichen haben',
      );
    }

    const nextNumber =
      patch.nextNumber !== undefined ? patch.nextNumber : current.nextNumber;
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      throw new BadRequestException('Nächste Nummer muss eine ganze Zahl ≥ 1 sein');
    }

    const candidate = `${prefix}-${nextNumber}`;
    const clash = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException(
        `Nummer ${candidate} ist bereits vergeben – bitte höhere nächste Nummer wählen`,
      );
    }

    const withPrefix = await this.prisma.invoice.findMany({
      where: {
        invoiceNumber: { startsWith: `${prefix}-` },
      },
      select: { invoiceNumber: true },
    });
    let maxUsed = 0;
    for (const inv of withPrefix) {
      if (!inv.invoiceNumber) continue;
      const suffix = inv.invoiceNumber.slice(prefix.length + 1);
      const n = Number.parseInt(suffix, 10);
      if (!Number.isNaN(n) && n > maxUsed) maxUsed = n;
    }
    if (maxUsed > 0 && nextNumber <= maxUsed) {
      throw new BadRequestException(
        `Nächste Nummer muss größer als die höchste vergebene Nummer (${prefix}-${maxUsed}) sein`,
      );
    }

    await this.prisma.invoiceNumberSeries.update({
      where: { code },
      data: { prefix, nextNumber },
    });
  }
}

function toSeriesView(row: {
  code: InvoiceSeriesCode;
  prefix: string;
  nextNumber: number;
}): InvoiceSeriesView {
  return {
    code: row.code,
    prefix: row.prefix,
    nextNumber: row.nextNumber,
    preview: `${row.prefix}-${row.nextNumber}`,
  };
}

function mergeSettings(
  base: BillingSettings,
  patch: Partial<BillingSettings>,
): BillingSettings {
  const skonto: SkontoSettings = {
    ...base.skonto,
    ...(patch.skonto ?? {}),
  };
  const performanceCountries: PerformanceCountry[] =
    patch.performanceCountries ?? base.performanceCountries;
  return {
    defaultPaymentTermDays:
      patch.defaultPaymentTermDays ?? base.defaultPaymentTermDays,
    paymentTermOptions: patch.paymentTermOptions ?? base.paymentTermOptions,
    skonto,
    performanceCountries,
    reverseChargePdfText:
      patch.reverseChargePdfText !== undefined
        ? patch.reverseChargePdfText
        : base.reverseChargePdfText,
  };
}

function validateSettings(settings: BillingSettings): void {
  if (
    !Number.isInteger(settings.defaultPaymentTermDays) ||
    settings.defaultPaymentTermDays < 0
  ) {
    throw new BadRequestException('Ungültiges Standard-Zahlungsziel');
  }
  if (
    !Array.isArray(settings.paymentTermOptions) ||
    settings.paymentTermOptions.some((d) => !Number.isInteger(d) || d < 0)
  ) {
    throw new BadRequestException('Ungültige Zahlungsziel-Vorlagen');
  }
  if (
    settings.skonto.percent != null &&
    (settings.skonto.percent < 0 || settings.skonto.percent > 100)
  ) {
    throw new BadRequestException('Skonto-% muss zwischen 0 und 100 liegen');
  }
  if (settings.skonto.days != null && settings.skonto.days < 0) {
    throw new BadRequestException('Skonto-Tage müssen ≥ 0 sein');
  }
  for (const c of settings.performanceCountries) {
    if (!c.countryCode || !c.name) {
      throw new BadRequestException('Leistungsort-Land unvollständig');
    }
    if (c.standardRate < 0 || c.reducedRate < 0) {
      throw new BadRequestException('MwSt-Sätze müssen ≥ 0 sein');
    }
  }
  if (
    typeof settings.reverseChargePdfText !== 'string' ||
    !settings.reverseChargePdfText.trim()
  ) {
    throw new BadRequestException('Reverse-Charge-PDF-Text darf nicht leer sein');
  }
}
