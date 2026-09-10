/**
 * Ortslabel aus Nominatim-Address-Teilen (Foto-Stempel).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPlaceLabelFromAddress } from './geocode.service';

describe('formatPlaceLabelFromAddress', () => {
  it('Straße + Hausnummer + PLZ + Stadt', () => {
    assert.equal(
      formatPlaceLabelFromAddress({
        road: 'Marienplatz',
        house_number: '1',
        postcode: '80331',
        city: 'München',
      }),
      'Marienplatz 1, 80331 München',
    );
  });

  it('nur Ort wenn keine Straße', () => {
    assert.equal(
      formatPlaceLabelFromAddress({
        postcode: '80331',
        city: 'München',
      }),
      '80331 München',
    );
  });

  it('village statt city', () => {
    assert.equal(
      formatPlaceLabelFromAddress({
        road: 'Dorfstraße',
        house_number: '3',
        village: 'Oberdorf',
      }),
      'Dorfstraße 3, Oberdorf',
    );
  });

  it('leer → null; display_name als Fallback', () => {
    assert.equal(formatPlaceLabelFromAddress({}), null);
    assert.equal(
      formatPlaceLabelFromAddress(undefined, 'Irgendwo, Deutschland'),
      'Irgendwo, Deutschland',
    );
  });
});
