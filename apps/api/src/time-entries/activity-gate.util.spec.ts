/**
 * Unit-Tests: Tätigkeits-Gate Master / HOURLY_PACKAGE (#34).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isActivityTrackingRequired,
  resolveActivityBillingMode,
} from './activity-gate.util';

describe('isActivityTrackingRequired (#34)', () => {
  it('Master → immer true, unabhängig vom billingMode', () => {
    assert.equal(isActivityTrackingRequired(true, null), true);
    assert.equal(isActivityTrackingRequired(true, undefined), true);
    assert.equal(isActivityTrackingRequired(true, 'UNIT_BASED'), true);
    assert.equal(isActivityTrackingRequired(true, 'MIXED'), true);
    assert.equal(isActivityTrackingRequired(true, 'HOURLY_PACKAGE'), true);
  });

  it('Normal + HOURLY_PACKAGE → true', () => {
    assert.equal(isActivityTrackingRequired(false, 'HOURLY_PACKAGE'), true);
  });

  it('Normal + MIXED → true (Stundenanteil)', () => {
    assert.equal(isActivityTrackingRequired(false, 'MIXED'), true);
  });

  it('Normal + UNIT_BASED / null → false', () => {
    assert.equal(isActivityTrackingRequired(false, 'UNIT_BASED'), false);
    assert.equal(isActivityTrackingRequired(false, null), false);
    assert.equal(isActivityTrackingRequired(false, undefined), false);
    assert.equal(isActivityTrackingRequired(false, ''), false);
  });
});
describe('resolveActivityBillingMode', () => {
  it('Status gewinnt wenn eingestempelt', () => {
    assert.equal(
      resolveActivityBillingMode({
        clockedIn: true,
        statusBillingMode: 'HOURLY_PACKAGE',
        assignmentBillingMode: 'UNIT_BASED',
        configBillingMode: 'MIXED',
      }),
      'HOURLY_PACKAGE',
    );
  });

  it('Assignment vor Config wenn nicht eingestempelt', () => {
    assert.equal(
      resolveActivityBillingMode({
        clockedIn: false,
        statusBillingMode: 'HOURLY_PACKAGE',
        assignmentBillingMode: 'UNIT_BASED',
        configBillingMode: 'MIXED',
      }),
      'UNIT_BASED',
    );
  });

  it('Config als Fallback wenn Assignment-billingMode fehlt', () => {
    assert.equal(
      resolveActivityBillingMode({
        clockedIn: false,
        assignmentBillingMode: null,
        configBillingMode: 'HOURLY_PACKAGE',
      }),
      'HOURLY_PACKAGE',
    );
  });

  it('eingestempelt: Status fehlt → Assignment/Config', () => {
    assert.equal(
      resolveActivityBillingMode({
        clockedIn: true,
        statusBillingMode: null,
        assignmentBillingMode: undefined,
        configBillingMode: 'HOURLY_PACKAGE',
      }),
      'HOURLY_PACKAGE',
    );
  });
});
