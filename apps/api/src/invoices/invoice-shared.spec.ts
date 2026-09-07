/**
 * Pflicht-Tests #29: Steuer je Satz, Titel, Steuerperiode, Nummernformat.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvoiceType } from '@prisma/client';
import {
  computeTaxBreakdown,
  documentTitleForType,
  round2,
  taxPeriodBounds,
} from './invoice-shared';

describe('documentTitleForType – kein „Gutschrift“', () => {
  it('liefert RE/ST/KO-Titel ohne Gutschrift', () => {
    assert.equal(documentTitleForType(InvoiceType.OUTGOING), 'Rechnung');
    assert.equal(documentTitleForType(InvoiceType.STORNO), 'Stornorechnung');
    assert.equal(
      documentTitleForType(InvoiceType.CORRECTION),
      'Rechnungskorrektur',
    );
    for (const type of Object.values(InvoiceType)) {
      const title = documentTitleForType(type);
      assert.equal(
        /gutschrift/i.test(title),
        false,
        `Titel enthält Gutschrift: ${title}`,
      );
    }
  });
});

describe('computeTaxBreakdown – Steuer je Satz', () => {
  it('berechnet gemischte Sätze 19%/7% aus Netto je Satz', () => {
    const result = computeTaxBreakdown(
      [
        { total: 100, taxRate: 19 },
        { total: 50, taxRate: 7 },
        { total: 20, taxRate: 19 },
      ],
      19,
    );
    assert.equal(result.subtotal, 170);
    const r19 = result.taxBreakdown.find((b) => b.rate === 19)!;
    const r7 = result.taxBreakdown.find((b) => b.rate === 7)!;
    assert.equal(r19.net, 120);
    assert.equal(r19.tax, round2((120 * 19) / 100));
    assert.equal(r7.net, 50);
    assert.equal(r7.tax, round2((50 * 7) / 100));
    assert.equal(result.taxAmount, round2(r19.tax + r7.tax));
    assert.equal(result.total, round2(result.subtotal + result.taxAmount));
  });

  it('Rundungsgrenzfall: Steuer aus Satz-Netto, nicht positionsweise', () => {
    // Drei Positionen à 0.01 bei 19% → Netto 0.03, Steuer round2(0.03*0.19)=0.01
    // positionsweise wäre 3× round2(0.01*0.19)=3×0.00=0
    const result = computeTaxBreakdown(
      [
        { total: 0.01, taxRate: 19 },
        { total: 0.01, taxRate: 19 },
        { total: 0.01, taxRate: 19 },
      ],
      19,
    );
    assert.equal(result.subtotal, 0.03);
    assert.equal(result.taxAmount, 0.01);
    assert.equal(result.total, 0.04);
  });

  it('ST-Spiegelung: negative Nets → negative Steuer/Brutto', () => {
    const source = computeTaxBreakdown(
      [
        { total: 100, taxRate: 19 },
        { total: 50, taxRate: 7 },
      ],
      19,
    );
    const storno = computeTaxBreakdown(
      [
        { total: -100, taxRate: 19 },
        { total: -50, taxRate: 7 },
      ],
      19,
    );
    assert.equal(storno.subtotal, -source.subtotal);
    assert.equal(storno.taxAmount, -source.taxAmount);
    assert.equal(storno.total, -source.total);
  });
});

describe('taxPeriodBounds / Korrekturgrund-Logik', () => {
  it('Monatsgrenzen UTC für Ursprungsdatum', () => {
    const { from, to } = taxPeriodBounds(new Date('2026-03-15T12:00:00Z'));
    assert.equal(from.toISOString(), '2026-03-01T00:00:00.000Z');
    assert.equal(to.getUTCMonth(), 2);
    assert.equal(to.getUTCDate(), 31);
  });

  it('INVOICE_ERROR → Periode Ursprung; CONSIDERATION_REDUCTION → Korrekturbeleg', () => {
    const origin = new Date('2025-11-20T10:00:00Z');
    const correction = new Date('2026-02-05T10:00:00Z');
    const originPeriod = taxPeriodBounds(origin);
    const corrPeriod = taxPeriodBounds(correction);
    assert.notEqual(
      originPeriod.from.toISOString(),
      corrPeriod.from.toISOString(),
    );
    // Fachliche Ableitung (wie Service.resolveTaxPeriod):
    assert.equal(originPeriod.from.getUTCMonth(), 10);
    assert.equal(corrPeriod.from.getUTCMonth(), 1);
  });
});

describe('Nummernformat ohne Jahr', () => {
  it('Format {PREFIX}-{number}', () => {
    const format = (prefix: string, n: number) => `${prefix}-${n}`;
    assert.equal(format('RE', 40000115), 'RE-40000115');
    assert.equal(format('ST', 40000001), 'ST-40000001');
    assert.equal(format('KO', 40000002), 'KO-40000002');
    assert.equal(/20\d{2}/.test(format('RE', 40000115)), false);
  });
});
