/**
 * Smoke-Tests für E-Rechnung-Hilfen.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapUnitToUnece } from './en16931.mapper';
import { generateXRechnungUbl } from './xrechnung.generator';
import type { En16931Invoice } from './en16931.model';

describe('mapUnitToUnece', () => {
  it('mappt Stunden und Stück', () => {
    assert.equal(mapUnitToUnece('Std'), 'HUR');
    assert.equal(mapUnitToUnece('Stk'), 'C62');
    assert.equal(mapUnitToUnece(undefined), 'C62');
  });
});

describe('generateXRechnungUbl', () => {
  it('enthält Rechnungsnummer und CustomizationID', () => {
    const doc: En16931Invoice = {
      invoiceNumber: 'RE-40000199',
      issueDate: '2026-09-09',
      currency: 'EUR',
      seller: {
        name: 'Test GmbH',
        street: 'Weg 1',
        city: 'Berlin',
        postalCode: '10115',
        countryCode: 'DE',
        vatId: 'DE123456789',
        email: 'a@b.de',
        iban: 'DE89370400440532013000',
      },
      buyer: {
        name: 'Kunde AG',
        street: 'Str. 2',
        city: 'München',
        postalCode: '80331',
        countryCode: 'DE',
        buyerReference: '991-12345-67',
      },
      lines: [
        {
          id: '1',
          name: 'Montage',
          quantity: 2,
          unitCode: 'HUR',
          netUnitPrice: 50,
          netAmount: 100,
          vatPercent: 19,
        },
      ],
      netTotal: 100,
      vatTotal: 19,
      grossTotal: 119,
    };
    const xml = generateXRechnungUbl(doc);
    assert.match(xml, /RE-40000199/);
    assert.match(xml, /xrechnung_3\.0/);
    assert.match(xml, /991-12345-67/);
  });
});
