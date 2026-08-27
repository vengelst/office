/**
 * Tests: NOT_FOUND darf keine KI-Adressfelder übernehmen.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasVerifiablePartial,
  mergeEnrichmentIntoBranch,
  normalizeEnrichmentStatus,
} from './branch-merge.util';
import type { AiImportBranchDraft } from './types';

function baseBranch(
  overrides: Partial<AiImportBranchDraft> = {},
): AiImportBranchDraft {
  return {
    include: true,
    key: 'ics-frankfurt',
    name: 'SPIE ICS – Frankfurt',
    enrichmentStatus: 'SKIPPED',
    ...overrides,
  };
}

describe('mergeEnrichmentIntoBranch', () => {
  it('verwirft Adressfelder bei status NOT_FOUND trotz LLM-Fantasie', () => {
    const branch = baseBranch({ city: 'Frankfurt' });
    const { branch: merged, warnings } = mergeEnrichmentIntoBranch(
      branch,
      {
        status: 'NOT_FOUND',
        addressLine1: 'Fantasie-Straße 99',
        postalCode: '60311',
        city: 'Frankfurt am Main',
        phone: '+49 69 000',
        email: 'fake@example.com',
        mapsUrl: 'https://maps.example/x',
      },
      ['https://example.com/kontakt'],
    );

    assert.equal(merged.enrichmentStatus, 'NOT_FOUND');
    assert.equal(merged.addressLine1, undefined);
    assert.equal(merged.postalCode, undefined);
    assert.equal(merged.phone, undefined);
    assert.equal(merged.email, undefined);
    assert.equal(merged.mapsUrl, undefined);
    // Draft-Stadt aus Quelle bleibt
    assert.equal(merged.city, 'Frankfurt');
    assert.ok(
      warnings.some((w) => w.includes('trotz NOT_FOUND')),
      `expected discard warning, got: ${warnings.join('; ')}`,
    );
  });

  it('übernimmt nur nicht-leere Felder bei FOUND', () => {
    const branch = baseBranch({ city: 'Frankfurt', notes: 'aus Liste' });
    const { branch: merged } = mergeEnrichmentIntoBranch(
      branch,
      {
        status: 'FOUND',
        addressLine1: 'Mainzer Landstraße 1',
        postalCode: '60329',
        city: 'Frankfurt',
        phone: '+49 69 123',
        email: '',
        mapsUrl: 'N/A',
      },
      ['https://example.com'],
    );

    assert.equal(merged.enrichmentStatus, 'FOUND');
    assert.equal(merged.addressLine1, 'Mainzer Landstraße 1');
    assert.equal(merged.postalCode, '60329');
    assert.equal(merged.phone, '+49 69 123');
    assert.equal(merged.email, undefined);
    assert.equal(merged.mapsUrl, undefined);
    assert.ok(merged.notes?.includes('aus Liste'));
  });

  it('stuft PARTIAL ohne verifizierbaren Teil auf NOT_FOUND herab', () => {
    assert.equal(
      normalizeEnrichmentStatus({
        status: 'PARTIAL',
        city: '  ',
        notes: 'irgendwas',
      }),
      'NOT_FOUND',
    );
    assert.equal(hasVerifiablePartial({ addressLine1: 'X-Weg 1' }), true);
    assert.equal(
      hasVerifiablePartial({ postalCode: '60311', city: 'Frankfurt' }),
      true,
    );
  });
});
