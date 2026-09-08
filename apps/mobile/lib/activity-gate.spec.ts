/**
 * Unit-Tests: Tätigkeits-Gate Master / HOURLY_PACKAGE (#36 / #34).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isActivityTrackingRequired } from './activity-gate';

describe('isActivityTrackingRequired (mobile)', () => {
  it('Master → immer true, unabhängig vom billingMode', () => {
    assert.equal(isActivityTrackingRequired(true, null), true);
    assert.equal(isActivityTrackingRequired(true, 'UNIT_BASED'), true);
    assert.equal(isActivityTrackingRequired(true, 'HOURLY_PACKAGE'), true);
  });

  it('Normal + HOURLY_PACKAGE → true', () => {
    assert.equal(isActivityTrackingRequired(false, 'HOURLY_PACKAGE'), true);
  });

  it('Normal + UNIT_BASED / MIXED / null → false', () => {
    assert.equal(isActivityTrackingRequired(false, 'UNIT_BASED'), false);
    assert.equal(isActivityTrackingRequired(false, 'MIXED'), false);
    assert.equal(isActivityTrackingRequired(false, null), false);
    assert.equal(isActivityTrackingRequired(false, undefined), false);
  });
});
