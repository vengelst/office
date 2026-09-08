/**
 * Unit-Tests: No-Show-Reminder Parser und Service-Logik (Auftrag #35).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TimeEntryType, WorkerAvailability } from '@prisma/client';
import {
  DEFAULT_NO_SHOW_ALERT_HOUR,
  DEFAULT_NO_SHOW_ALERT_MINUTE,
  noShowSentKey,
  parseNoShowAlertEnabled,
  parseNoShowAlertHour,
  parseNoShowAlertMinute,
  parseNoShowAlertSentState,
} from '../app-settings/no-show-alert';
import {
  isBerlinWeekend,
  NoShowAlertService,
} from './no-show-alert.service';
import { berlinDateKey } from './break-calc.util';

describe('parseNoShowAlertEnabled', () => {
  it('Default false bei fehlend/ungültig', () => {
    assert.equal(parseNoShowAlertEnabled(null), false);
    assert.equal(parseNoShowAlertEnabled(undefined), false);
    assert.equal(parseNoShowAlertEnabled(''), false);
    assert.equal(parseNoShowAlertEnabled('maybe'), false);
  });

  it('erkennt true/false Varianten', () => {
    assert.equal(parseNoShowAlertEnabled('true'), true);
    assert.equal(parseNoShowAlertEnabled('1'), true);
    assert.equal(parseNoShowAlertEnabled('false'), false);
    assert.equal(parseNoShowAlertEnabled('0'), false);
  });
});

describe('parseNoShowAlertHour/Minute', () => {
  it('Hour Default 10 und Bounds 0–23', () => {
    assert.equal(parseNoShowAlertHour(null), DEFAULT_NO_SHOW_ALERT_HOUR);
    assert.equal(parseNoShowAlertHour('10'), 10);
    assert.equal(parseNoShowAlertHour('0'), 0);
    assert.equal(parseNoShowAlertHour('23'), 23);
    assert.equal(parseNoShowAlertHour('24'), DEFAULT_NO_SHOW_ALERT_HOUR);
    assert.equal(parseNoShowAlertHour('-1'), DEFAULT_NO_SHOW_ALERT_HOUR);
    assert.equal(parseNoShowAlertHour('abc'), DEFAULT_NO_SHOW_ALERT_HOUR);
  });

  it('Minute Default 0 und Bounds 0–59', () => {
    assert.equal(parseNoShowAlertMinute(null), DEFAULT_NO_SHOW_ALERT_MINUTE);
    assert.equal(parseNoShowAlertMinute('0'), 0);
    assert.equal(parseNoShowAlertMinute('59'), 59);
    assert.equal(parseNoShowAlertMinute('60'), DEFAULT_NO_SHOW_ALERT_MINUTE);
    assert.equal(parseNoShowAlertMinute('x'), DEFAULT_NO_SHOW_ALERT_MINUTE);
  });
});

describe('parseNoShowAlertSentState', () => {
  it('parst Dedup-Map und cronRunDate', () => {
    const state = parseNoShowAlertSentState(
      JSON.stringify({
        cronRunDate: '2026-09-08',
        sent: { 'w1|2026-09-08': true },
      }),
    );
    assert.equal(state.cronRunDate, '2026-09-08');
    assert.equal(state.sent['w1|2026-09-08'], true);
  });

  it('ungültig → leer', () => {
    assert.deepEqual(parseNoShowAlertSentState('not-json'), {
      cronRunDate: null,
      sent: {},
    });
  });
});

describe('isBerlinWeekend', () => {
  it('Sa/So true, Mo false (feste UTC-Zeitpunkte)', () => {
    // 2026-09-05 = Samstag, 2026-09-06 = Sonntag, 2026-09-07 = Montag
    assert.equal(isBerlinWeekend(new Date('2026-09-05T12:00:00Z')), true);
    assert.equal(isBerlinWeekend(new Date('2026-09-06T12:00:00Z')), true);
    assert.equal(isBerlinWeekend(new Date('2026-09-07T12:00:00Z')), false);
  });
});

function makeSettings(map: Record<string, string | null>) {
  const store = { ...map };
  return {
    get: async (key: string) => store[key] ?? null,
    set: async (key: string, value: string) => {
      store[key] = value;
    },
    _store: store,
  };
}

type AssignmentRow = {
  workerId: string;
  workerNumber: string;
  firstName: string;
  lastName: string;
  availability: WorkerAvailability;
  projectNumber: string;
  title: string;
  roleName?: string | null;
  projectStatus?: string;
};

function makePrisma(opts: {
  assignments?: AssignmentRow[];
  clockIns?: Array<{ workerId: string }>;
}) {
  return {
    projectAssignment: {
      findMany: async (args: {
        where?: {
          worker?: { availability?: { notIn?: WorkerAvailability[] } };
          project?: { status?: string };
        };
      }) => {
        const excluded = args.where?.worker?.availability?.notIn ?? [];
        return (opts.assignments ?? [])
          .filter((a) => !excluded.includes(a.availability))
          .filter(
            (a) =>
              !args.where?.project?.status ||
              (a.projectStatus ?? 'ACTIVE') === args.where.project.status,
          )
          .map((a) => ({
            roleName: a.roleName ?? null,
            worker: {
              id: a.workerId,
              workerNumber: a.workerNumber,
              firstName: a.firstName,
              lastName: a.lastName,
            },
            project: {
              projectNumber: a.projectNumber,
              title: a.title,
            },
          }));
      },
    },
    timeEntry: {
      findMany: async () =>
        (opts.clockIns ?? []).map((c) => ({
          workerId: c.workerId,
          entryType: TimeEntryType.CLOCK_IN,
        })),
    },
  };
}

/** Montag 2026-09-07 10:05 Europe/Berlin = 08:05 UTC (CEST). */
const MONDAY_AFTER_CHECK = new Date('2026-09-07T08:05:00Z');
/** Samstag 2026-09-05 10:05 Europe/Berlin. */
const SATURDAY_AFTER_CHECK = new Date('2026-09-05T08:05:00Z');
/** Montag vor Check-Zeit 09:00 Berlin = 07:00 UTC. */
const MONDAY_BEFORE_CHECK = new Date('2026-09-07T07:00:00Z');

const baseAssignment: AssignmentRow = {
  workerId: 'w1',
  workerNumber: 'M-1',
  firstName: 'Max',
  lastName: 'Muster',
  availability: WorkerAvailability.ON_PROJECT,
  projectNumber: 'P-1',
  title: 'Baustelle',
  roleName: 'Monteur',
};

describe('NoShowAlertService.checkAndNotify', () => {
  it('enabled=false (cron) → kein Mail', async () => {
    let mails = 0;
    const settings = makeSettings({
      no_show_alert_enabled: 'false',
      no_show_alert_hour: '10',
      no_show_alert_minute: '0',
      overtime_alert_email: 'leitung@firma.de',
      no_show_alert_sent: null,
    });
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      settings as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.skippedDisabled, true);
    assert.equal(result.sent, 0);
    assert.equal(mails, 0);
  });

  it('Wochenende (cron) → skip', async () => {
    let mails = 0;
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: SATURDAY_AFTER_CHECK,
    });
    assert.equal(result.skippedWeekend, true);
    assert.equal(result.weekend, true);
    assert.equal(result.sent, 0);
    assert.equal(mails, 0);
  });

  it('vor Check-Zeit (cron) → skip', async () => {
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      { send: async () => ({ success: true }) } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_BEFORE_CHECK,
    });
    assert.equal(result.skippedBeforeTime, true);
    assert.equal(result.sent, 0);
  });

  it('Mo nach Check: No-Show → Sammel-Mail', async () => {
    let mails = 0;
    let subject = '';
    const settings = makeSettings({
      no_show_alert_enabled: 'true',
      no_show_alert_hour: '10',
      no_show_alert_minute: '0',
      overtime_alert_email: 'leitung@firma.de',
      no_show_alert_sent: null,
    });
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment], clockIns: [] }) as never,
      settings as never,
      {
        send: async (_to: string, s: string) => {
          mails += 1;
          subject = s;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.checked, 1);
    assert.equal(result.missing, 1);
    assert.equal(result.sent, 1);
    assert.equal(mails, 1);
    assert.match(subject, /Keine Einstempelung/);
    const stored = parseNoShowAlertSentState(
      settings._store.no_show_alert_sent ?? null,
    );
    const dateKey = berlinDateKey(MONDAY_AFTER_CHECK);
    assert.equal(stored.cronRunDate, dateKey);
    assert.equal(stored.sent[noShowSentKey('w1', dateKey)], true);
  });

  it('Worker mit CLOCK_IN heute → nicht in Mail', async () => {
    let mails = 0;
    const service = new NoShowAlertService(
      makePrisma({
        assignments: [baseAssignment],
        clockIns: [{ workerId: 'w1' }],
      }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.checked, 1);
    assert.equal(result.missing, 0);
    assert.equal(result.sent, 0);
    assert.equal(mails, 0);
  });

  it('Dedup: zweiter Cron am selben Tag → keine Doppel-Mail', async () => {
    let mails = 0;
    const dateKey = berlinDateKey(MONDAY_AFTER_CHECK);
    const settings = makeSettings({
      no_show_alert_enabled: 'true',
      no_show_alert_hour: '10',
      no_show_alert_minute: '0',
      overtime_alert_email: 'leitung@firma.de',
      no_show_alert_sent: JSON.stringify({
        cronRunDate: dateKey,
        sent: { [noShowSentKey('w1', dateKey)]: true },
      }),
    });
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      settings as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.skippedAlreadyRan, true);
    assert.equal(result.sent, 0);
    assert.equal(mails, 0);
  });

  it('SICK/VACATION/UNAVAILABLE werden ausgeschlossen', async () => {
    const service = new NoShowAlertService(
      makePrisma({
        assignments: [
          { ...baseAssignment, workerId: 'w-sick', availability: WorkerAvailability.SICK },
          {
            ...baseAssignment,
            workerId: 'w-vac',
            availability: WorkerAvailability.VACATION,
          },
          {
            ...baseAssignment,
            workerId: 'w-un',
            availability: WorkerAvailability.UNAVAILABLE,
          },
          {
            ...baseAssignment,
            workerId: 'w-ok',
            availability: WorkerAvailability.AVAILABLE,
          },
        ],
      }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      { send: async () => ({ success: true }) } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.checked, 1);
    assert.equal(result.missing, 1);
    assert.equal(result.sent, 1);
  });

  it('Nicht-ACTIVE-Projekt wird gefiltert', async () => {
    const service = new NoShowAlertService(
      makePrisma({
        assignments: [
          {
            ...baseAssignment,
            projectStatus: 'PAUSED',
          },
        ],
      }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      { send: async () => ({ success: true }) } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.checked, 0);
    assert.equal(result.sent, 0);
  });

  it('Manuell am Wochenende prüft trotzdem (mit Enabled)', async () => {
    let mails = 0;
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: 'leitung@firma.de',
      }) as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'manual',
      now: SATURDAY_AFTER_CHECK,
    });
    assert.equal(result.weekend, true);
    assert.equal(result.skippedWeekend, false);
    assert.equal(result.checked, 1);
    assert.equal(result.missing, 1);
    assert.equal(result.sent, 1);
    assert.equal(mails, 1);
  });

  it('ohne E-Mail → kein Versand', async () => {
    let mails = 0;
    const service = new NoShowAlertService(
      makePrisma({ assignments: [baseAssignment] }) as never,
      makeSettings({
        no_show_alert_enabled: 'true',
        no_show_alert_hour: '10',
        no_show_alert_minute: '0',
        overtime_alert_email: '',
      }) as never,
      {
        send: async () => {
          mails += 1;
          return { success: true };
        },
      } as never,
    );
    const result = await service.checkAndNotify({
      source: 'cron',
      now: MONDAY_AFTER_CHECK,
    });
    assert.equal(result.skippedNoEmail, true);
    assert.equal(mails, 0);
  });
});
