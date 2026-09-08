/**
 * Unit-Tests: Timesheet-Status-Konstanten und Worker-/Approve-Helfer (#33).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WeeklyTimesheetStatus } from '@prisma/client';
import {
  APPROVABLE_STATUSES,
  REJECTABLE_STATUSES,
  STAMP_LOCKED_MESSAGE,
  STAMP_LOCKED_STATUSES,
} from './timesheet-shared';

describe('timesheet-shared Status-Mengen (#33)', () => {
  it('APPROVABLE enthält SUBMITTED und WORKER_SIGNED', () => {
    assert.ok(
      APPROVABLE_STATUSES.includes(WeeklyTimesheetStatus.SUBMITTED),
    );
    assert.ok(
      APPROVABLE_STATUSES.includes(WeeklyTimesheetStatus.WORKER_SIGNED),
    );
    assert.equal(APPROVABLE_STATUSES.includes(WeeklyTimesheetStatus.DRAFT), false);
  });

  it('REJECTABLE enthält SUBMITTED und WORKER_SIGNED', () => {
    assert.deepEqual(
      [...REJECTABLE_STATUSES].sort(),
      [
        WeeklyTimesheetStatus.SUBMITTED,
        WeeklyTimesheetStatus.WORKER_SIGNED,
      ].sort(),
    );
  });

  it('STAMP_LOCKED enthält WORKER_SIGNED und Final-Status', () => {
    for (const s of [
      WeeklyTimesheetStatus.WORKER_SIGNED,
      WeeklyTimesheetStatus.SUBMITTED,
      WeeklyTimesheetStatus.APPROVED,
      WeeklyTimesheetStatus.COMPLETED,
      WeeklyTimesheetStatus.LOCKED,
      WeeklyTimesheetStatus.ARCHIVED,
    ]) {
      assert.ok(STAMP_LOCKED_STATUSES.includes(s), s);
    }
    assert.equal(
      STAMP_LOCKED_STATUSES.includes(WeeklyTimesheetStatus.DRAFT),
      false,
    );
  });

  it('STAMP_LOCKED_MESSAGE ist deutsch und verständlich', () => {
    assert.match(STAMP_LOCKED_MESSAGE, /Stundenzettel/);
    assert.match(STAMP_LOCKED_MESSAGE, /Kalenderwoche|Projekt/i);
  });
});
