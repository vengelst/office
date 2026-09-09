/**
 * Smoke-Tests für EN-16931-Mapper und XRechnung-Generator.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InvoiceTaxKind, InvoiceType } from '@prisma/client';
import { mapInvoiceToEn16931 } from './en16931.mapper';
import { generateXRechnungXml } from './xrechnung.generator';
import { generateCiiXml } from './zugferd.generator';
import { mapUnitCode } from './unit-code.map';

describe('mapUnitCode', () => {
  it('mappt Std und Stück', () => {
    assert.equal(mapUnitCode('Std'), 'HUR');
    assert.equal(mapUnitCode('Stk'), 'C62');
    assert.equal(mapUnitCode(null), 'C62');
  });
});

describe('en16931 mapper + xrechnung', () => {
  const company = {
    name: 'Muster GmbH',
    address: 'Industriestr. 1, 40625 Düsseldorf, DE',
    phone: '0211 123',
    email: 'info@muster.de',
    taxNumber: '123/456',
    vatId: 'DE123456789',
    vatIdsByCountry: { DE: 'DE123456789' },
    bankName: 'Bank',
    bankIban: 'DE89370400440532013000',
    bankBic: 'COBADEFFXXX',
    addressLine1: 'Industriestr. 1',
    postalCode: '40625',
    city: 'Düsseldorf',
    country: 'DE',
    electronicAddress: 'info@muster.de',
  };

  const invoice = {
    invoiceNumber: 'RE-40000113',
    invoiceType: InvoiceType.OUTGOING,
    issueDate: new Date('2026-09-01'),
    dueDate: new Date('2026-09-15'),
    periodFrom: new Date('2026-08-01'),
    periodTo: new Date('2026-08-31'),
    taxKind: InvoiceTaxKind.STANDARD,
    taxRate: 19,
    subtotal: 100,
    taxAmount: 19,
    total: 119,
    notes: null,
    taxBreakdown: [{ rate: 19, net: 100, tax: 19, gross: 119 }],
    paidAmount: null,
    creditedInvoice: null,
    lines: [
      {
        id: 'l1',
        position: 1,
        description: 'Montagearbeiten',
        quantity: 10,
        unit: 'Std',
        unitPrice: 10,
        total: 100,
        taxRate: 19,
      },
    ],
    customer: {
      companyName: 'Kunde AG',
      vatId: 'DE987654321',
      taxNumber: null,
      addressLine1: 'Hauptstr. 5',
      addressLine2: null,
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
      leitwegId: '991-12345-67',
      emails: [
        { email: 'rechnung@kunde.de', emailType: 'BILLING', isPrimary: true },
      ],
      contacts: [],
    },
  };

  it('mappt Rechnungsnummer und Leitweg-ID', () => {
    const model = mapInvoiceToEn16931(invoice, company);
    assert.equal(model.invoiceNumber, 'RE-40000113');
    assert.equal(model.buyerReference, '991-12345-67');
    assert.equal(model.seller.vatId, 'DE123456789');
  });

  it('XRechnung XML enthält Rechnungsnummer', () => {
    const model = mapInvoiceToEn16931(invoice, company);
    const xml = generateXRechnungXml(model);
    assert.match(xml, /<cbc:ID>RE-40000113<\/cbc:ID>/);
    assert.match(xml, /BuyerReference/);
    assert.match(xml, /991-12345-67/);
  });

  it('CII XML enthält Rechnungsnummer', () => {
    const model = mapInvoiceToEn16931(invoice, company);
    const xml = generateCiiXml(model);
    assert.match(xml, /<ram:ID>RE-40000113<\/ram:ID>/);
  });
});
