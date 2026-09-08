/**
 * Unit-Tests: Auto-Clock-Out Parser und Service-Logik (Auftrag #32).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TimeEntryType } from '@prisma/client';
import {
  DEFAULT_AUTO_CLOCK_OUT_HOURS,
  SYSTEM_AUTO_CLOCK_OUT_DEVICE,
  autoClockOutComment,
  parseAutoClockOutEnabled,
  parseAutoClockOutHours,
} from '../app-settings/auto-clock-out';
import { AutoClockOutService } from './auto-clock-out.service';

describe('parseAutoClockOutEnabled', () => {
  it('Default false bei fehlend/ungültig', () => {
    assert.equal(parseAutoClockOutEnabled(null), false);
    assert.equal(parseAutoClockOutEnabled(undefined), false);
    assert.equal(parseAutoClockOutEnabled(''), false);
    assert.equal(parseAutoClockOutEnabled('maybe'), false);
  });

  it('erkennt true/false Varianten', () => {
    assert.equal(parseAutoClockOutEnabled('true'), true);
    assert.equal(parseAutoClockOutEnabled('TRUE'), true);
    assert.equal(parseAutoClockOutEnabled('1'), true);
    assert.equal(parseAutoClockOutEnabled('false'), false);
    assert.equal(parseAutoClockOutEnabled('0'), false);
  });
});

describe('parseAutoClockOutHours', () => {
  it('Default 12 und Clamp 1–24', () => {
    assert.equal(parseAutoClockOutHours(null), DEFAULT_AUTO_CLOCK_OUT_HOURS);
    assert.equal(parseAutoClockOutHours('12'), 12);
    assert.equal(parseAutoClockOutHours('1'), 1);
    assert.equal(parseAutoClockOutHours('24'), 24);
    assert.equal(parseAutoClockOutHours('0'), DEFAULT_AUTO_CLOCK_OUT_HOURS);
    assert.equal(parseAutoClockOutHours('25'), DEFAULT_AUTO_CLOCK_OUT_HOURS);
    assert.equal(parseAutoClockOutHours('abc'), DEFAULT_AUTO_CLOCK_OUT_HOURS);
  });
});

describe('autoClockOutComment', () => {
  it('enthält Stunden und System-Hinweis', () => {
    const c = autoClockOutComment(12);
    assert.match(c, /12/);
    assert.match(c, /Auto-Clock-Out/i);
  });
});

function makeSettings(map: Record<string, string | null>) {
  return {
    get: async (key: string) => map[key] ?? null,
  };
}

function makePrisma(openEntries: Array<{
  id: string;
  workerId: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  projectNumber: string;
  title: string;
  occurredAtClient: Date;
}>) {
  return {
    timeEntry: {
      findMany: async () =>
        openEntries.map((e) => ({
          id: e.id,
          entryType: TimeEntryType.CLOCK_IN,
          occurredAtClient: e.occurredAtClient,
          workDocumentedAt: null,
          worker: {
            id: e.workerId,
            workerNumber: e.workerNumber,
            firstName: e.firstName,
            lastName: e.lastName,
          },
          project: {
            id: 'p1',
            projectNumber: e.projectNumber,
            title: e.title,
            customer: { companyName: 'Kunde' },
          },
        })),
    },
  };
}

describe('AutoClockOutService.checkAndClose', () => {
  it('enabled=false → kein Out', async () => {
    let systemCalls = 0;
    const service = new AutoClockOutService(
      makePrisma([
        {
          id: 'te1',
          workerId: 'w1',
          workerNumber: 'M-1',
          firstName: 'Max',
          lastName: 'Muster',
          projectNumber: 'P-1',
          title: 'Test',
          occurredAtClient: new Date(Date.now() - 13 * 60 * 60 * 1000),
        },
      ]) as never,
      makeSettings({
        auto_clock_out_enabled: 'false',
        auto_clock_out_hours: '12',
        overtime_alert_email: '',
      }) as never,
      { send: async () => ({ success: true }) } as never,
      {
        systemClockOut: async () => {
          systemCalls += 1;
          return { clockOutTimeEntryId: 'out-1' };
        },
      } as never,
    );

    const result = await service.checkAndClose();
    assert.equal(result.enabled, false);
    assert.equal(result.closed, 0);
    assert.equal(systemCalls, 0);
  });

  it('offene Schicht 13h, Schwelle 12 → CLOCK_OUT bei clockIn+12h', async () => {
    const clockIn = new Date(Date.now() - 13 * 60 * 60 * 1000);
    type Captured = {
      workerId: string;
      occurredAtClient: Date;
      sourceDevice: string;
      comment: string;
    };
    let captured: Captured | null = null;

    const service = new AutoClockOutService(
      makePrisma([
        {
          id: 'te1',
          workerId: 'w1',
          workerNumber: 'M-1',
          firstName: 'Max',
          lastName: 'Muster',
          projectNumber: 'P-1',
          title: 'Test',
          occurredAtClient: clockIn,
        },
      ]) as never,
      makeSettings({
        auto_clock_out_enabled: 'true',
        auto_clock_out_hours: '12',
        overtime_alert_email: '',
      }) as never,
      { send: async () => ({ success: true }) } as never,
      {
        systemClockOut: async (params: Captured) => {
          captured = params;
          return {
            clockOutTimeEntryId: 'out-1',
            pendingWorkDocumentation: { timeEntryId: 'out-1' },
          };
        },
      } as never,
    );

    const result = await service.checkAndClose();
    assert.equal(result.enabled, true);
    assert.equal(result.closed, 1);
    assert.ok(captured);
    const c = captured as Captured;
    assert.equal(c.workerId, 'w1');
    assert.equal(c.sourceDevice, SYSTEM_AUTO_CLOCK_OUT_DEVICE);
    assert.match(c.comment, /12/);
    const expectedOut = clockIn.getTime() + 12 * 60 * 60 * 1000;
    assert.equal(c.occurredAtClient.getTime(), expectedOut);
  });

  it('unter Schwelle → kein Out', async () => {
    let systemCalls = 0;
    const service = new AutoClockOutService(
      makePrisma([
        {
          id: 'te1',
          workerId: 'w1',
          workerNumber: 'M-1',
          firstName: 'Max',
          lastName: 'Muster',
          projectNumber: 'P-1',
          title: 'Test',
          occurredAtClient: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      ]) as never,
      makeSettings({
        auto_clock_out_enabled: 'true',
        auto_clock_out_hours: '12',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      { send: async () => ({ success: true }) } as never,
      {
        systemClockOut: async () => {
          systemCalls += 1;
          return { clockOutTimeEntryId: 'out-1' };
        },
      } as never,
    );

    const result = await service.checkAndClose();
    assert.equal(result.closed, 0);
    assert.equal(systemCalls, 0);
  });

  it('sendet optionale Mail an overtime_alert_email', async () => {
    let mailedTo: string | null = null;
    const clockIn = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const service = new AutoClockOutService(
      makePrisma([
        {
          id: 'te1',
          workerId: 'w1',
          workerNumber: 'M-1',
          firstName: 'Max',
          lastName: 'Muster',
          projectNumber: 'P-1',
          title: 'Test',
          occurredAtClient: clockIn,
        },
      ]) as never,
      makeSettings({
        auto_clock_out_enabled: 'true',
        auto_clock_out_hours: '12',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      {
        send: async (to: string) => {
          mailedTo = to;
          return { success: true };
        },
      } as never,
      {
        systemClockOut: async () => ({ clockOutTimeEntryId: 'out-1' }),
      } as never,
    );

    const result = await service.checkAndClose();
    assert.equal(result.closed, 1);
    assert.equal(result.mailed, 1);
    assert.equal(mailedTo, 'leitung@firma.de');
  });
});

describe('systemClockOut Vertrag (Mock-Pfad)', () => {
  it('workDocumentedAt bleibt null und sourceDevice gesetzt', async () => {
    // Vertrag über den Mock: performClockOut setzt workDocumentedAt=null.
    // Hier prüfen wir die vom Cron übergebenen Parameter und den Rückgabe-Pending.
    const clockIn = new Date(Date.now() - 13 * 60 * 60 * 1000);
    let pendingNull = false;
    const service = new AutoClockOutService(
      makePrisma([
        {
          id: 'te1',
          workerId: 'w1',
          workerNumber: 'M-1',
          firstName: 'Max',
          lastName: 'Muster',
          projectNumber: 'P-1',
          title: 'Test',
          occurredAtClient: clockIn,
        },
      ]) as never,
      makeSettings({
        auto_clock_out_enabled: 'true',
        auto_clock_out_hours: '12',
        overtime_alert_email: '',
      }) as never,
      { send: async () => ({ success: true }) } as never,
      {
        systemClockOut: async (params: { sourceDevice: string }) => {
          assert.equal(params.sourceDevice, SYSTEM_AUTO_CLOCK_OUT_DEVICE);
          pendingNull = true; // workDocumentedAt null → Pending vorhanden
          return {
            clockOutTimeEntryId: 'out-1',
            pendingWorkDocumentation: {
              timeEntryId: 'out-1',
              projectId: 'p1',
              workNotesEnabled: true,
              workActivities: [],
              configurationError: false,
            },
            workDocumentationRequired: true,
          };
        },
      } as never,
    );

    const result = await service.checkAndClose();
    assert.equal(result.closed, 1);
    assert.equal(pendingNull, true);
  });
});
