/**
 * Pflicht-Tests #29: Invarianten ST/KO (reine Ableitungslogik).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { round2 } from './invoice-shared';

/** Restbetrag nach finalisierten KOs (KO-Totals negativ). */
function remainingGross(
  reTotal: number,
  finalizedKoTotals: number[],
): number {
  const used = round2(
    finalizedKoTotals.reduce((s, t) => s + Math.abs(t), 0),
  );
  return round2(reTotal - used);
}

type Related = { invoiceType: 'STORNO' | 'CORRECTION' };

function canCreateStorno(related: Related[]): boolean {
  return !related.some(
    (r) => r.invoiceType === 'STORNO' || r.invoiceType === 'CORRECTION',
  );
}

function canCreateCorrection(related: Related[]): boolean {
  return !related.some((r) => r.invoiceType === 'STORNO');
}

describe('KO-Restbetrag-Invariante', () => {
  it('Summe |KO| ≤ RE-Brutto', () => {
    assert.equal(remainingGross(119, [-50]), 69);
    assert.equal(remainingGross(119, [-50, -60]), 9);
    assert.ok(remainingGross(119, [-50, -70]) < 0);
  });

  it('KO über Restbetrag hinaus erkennen', () => {
    const remaining = remainingGross(119, [-100]);
    const nextAbs = 30;
    assert.ok(round2(remaining - nextAbs) < 0);
  });
});

describe('ST/KO-Invarianten (fachlich)', () => {
  it('zweites ST / ST nach KO / KO nach ST blockieren', () => {
    assert.equal(canCreateStorno([]), true);
    assert.equal(canCreateStorno([{ invoiceType: 'STORNO' }]), false);
    assert.equal(canCreateStorno([{ invoiceType: 'CORRECTION' }]), false);
    assert.equal(canCreateCorrection([{ invoiceType: 'STORNO' }]), false);
    assert.equal(canCreateCorrection([{ invoiceType: 'CORRECTION' }]), true);
  });
});
