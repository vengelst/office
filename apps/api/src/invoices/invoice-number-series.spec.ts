/**
 * Pflicht-Tests #29: atomare Nummernvergabe (Integration, überspringt ohne DB).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvoiceSeriesCode, PrismaClient } from '@prisma/client';
import { BillingSettingsService } from '../app-settings/billing-settings.service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe('allocateNumber – atomare Nebenläufigkeit', { skip: !hasDb }, () => {
  it('parallele Vergabe erzeugt eindeutige Nummern', async () => {
    const prisma = new PrismaClient();
    // AppSettingsService-Mock: nur Series relevant
    const appSettings = {
      get: async () => null,
      set: async () => undefined,
    };
    const billing = new BillingSettingsService(
      prisma as never,
      appSettings as never,
    );

    // Sicherstellen dass Serien existieren
    await billing.get();

    const series = await prisma.invoiceNumberSeries.findUnique({
      where: { code: InvoiceSeriesCode.OUTGOING },
    });
    assert.ok(series);

    const start = series!.nextNumber;
    const n = 25;
    const numbers = await Promise.all(
      Array.from({ length: n }, () =>
        prisma.$transaction((tx) =>
          billing.allocateNumber(InvoiceSeriesCode.OUTGOING, tx),
        ),
      ),
    );

    const unique = new Set(numbers);
    assert.equal(unique.size, n, `erwartet ${n} eindeutige Nummern, got ${[...unique].join(',')}`);
    const sorted = [...numbers].sort((a, b) => {
      const na = Number(a.split('-')[1]);
      const nb = Number(b.split('-')[1]);
      return na - nb;
    });
    for (let i = 0; i < n; i++) {
      assert.equal(sorted[i], `${series!.prefix}-${start + i}`);
    }

    // Zähler zurücksetzen damit Seed/Dev nicht springt
    await prisma.invoiceNumberSeries.update({
      where: { code: InvoiceSeriesCode.OUTGOING },
      data: { nextNumber: start },
    });
    await prisma.$disconnect();
  });
});
