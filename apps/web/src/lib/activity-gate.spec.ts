/**
 * Unit-Tests: Tätigkeits-Gate + billingMode-Auflösung (#34).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isActivityTrackingRequired,
  resolveActivityBillingMode,
} from './activity-gate';

describe('isActivityTrackingRequired (#34)', () => {
  it('Master → immer true', () => {
    assert.equal(isActivityTrackingRequired(true, null), true);
    assert.equal(isActivityTrackingRequired(true, 'UNIT_BASED'), true);
  });

  it('Normal + HOURLY_PACKAGE → true', () => {
    assert.equal(isActivityTrackingRequired(false, 'HOURLY_PACKAGE'), true);
  });

  it('Normal + andere → false', () => {
    assert.equal(isActivityTrackingRequired(false, 'UNIT_BASED'), false);
    assert.equal(isActivityTrackingRequired(false, null), false);
  });
});

describe('resolveActivityBillingMode', () => {
  it('nutzt Status wenn eingestempelt', () => {
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

  it('fällt auf Assignment zurück wenn nicht eingestempelt', () => {
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

  it('fällt auf Kiosk-Config zurück wenn Assignment-billingMode fehlt', () => {
    assert.equal(
      resolveActivityBillingMode({
        clockedIn: false,
        assignmentBillingMode: null,
        configBillingMode: 'HOURLY_PACKAGE',
      }),
      'HOURLY_PACKAGE',
    );
  });

  it('null wenn nichts vorhanden', () => {
    assert.equal(resolveActivityBillingMode({ clockedIn: false }), null);
  });
});
