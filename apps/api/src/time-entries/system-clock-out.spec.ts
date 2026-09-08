/**
 * Unit-Tests: systemClockOut / performClockOut (Auftrag #32).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TimeEntryType } from '@prisma/client';
import {
  SYSTEM_AUTO_CLOCK_OUT_DEVICE,
  autoClockOutComment,
} from '../app-settings/auto-clock-out';
import { TimeEntriesService } from './time-entries.service';

describe('TimeEntriesService.systemClockOut', () => {
  it('schließt Pause, setzt sourceDevice, workDocumentedAt bleibt null', async () => {
    const clockInAt = new Date('2026-03-01T06:00:00.000Z');
    const outAt = new Date('2026-03-01T18:00:00.000Z');
    const created: Array<Record<string, unknown>> = [];
    let closedSessionsAt: Date | null = null;
    let segmentEndedAt: Date | null = null;
    let clockedOut = false;

    const prisma = {
      worker: {
        findFirst: async () => ({ id: 'w1', active: true, deletedAt: null }),
      },
      timeEntry: {
        findFirst: async (args: {
          where?: {
            entryType?:
              | TimeEntryType
              | { in?: TimeEntryType[] };
            workDocumentedAt?: null;
          };
        }) => {
          const et = args.where?.entryType;
          // Pending Arbeitsdoku nach Out
          if (
            et === TimeEntryType.CLOCK_OUT ||
            (args.where && 'workDocumentedAt' in (args.where ?? {}))
          ) {
            if (!clockedOut) return null;
            return { id: 'out-1', projectId: 'p1' };
          }
          // getLatestClockEntry
          if (
            et &&
            typeof et === 'object' &&
            'in' in et &&
            Array.isArray(et.in)
          ) {
            if (clockedOut) {
              return {
                id: 'out-1',
                entryType: TimeEntryType.CLOCK_OUT,
                occurredAtClient: outAt,
                projectId: 'p1',
                latitude: null,
                longitude: null,
                project: {
                  id: 'p1',
                  projectNumber: 'P-1',
                  title: 'Baustelle',
                },
              };
            }
            return {
              id: 'in-1',
              entryType: TimeEntryType.CLOCK_IN,
              occurredAtClient: clockInAt,
              projectId: 'p1',
              latitude: null,
              longitude: null,
              project: {
                id: 'p1',
                projectNumber: 'P-1',
                title: 'Baustelle',
              },
            };
          }
          return null;
        },
        findMany: async (args: {
          where?: { entryType?: { in?: TimeEntryType[] } };
        }) => {
          const types = args.where?.entryType?.in ?? [];
          if (
            types.includes(TimeEntryType.BREAK_START) &&
            !clockedOut
          ) {
            return [
              {
                id: 'br-1',
                entryType: TimeEntryType.BREAK_START,
                occurredAtClient: new Date('2026-03-01T12:00:00.000Z'),
                projectId: 'p1',
              },
            ];
          }
          return [];
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          if (data.entryType === TimeEntryType.CLOCK_OUT) {
            clockedOut = true;
          }
          return { id: `created-${created.length}`, ...data };
        },
      },
      timeActivitySegment: {
        findFirst: async () => null,
        updateMany: async ({ data }: { data: { endedAt: Date } }) => {
          segmentEndedAt = data.endedAt;
          return { count: 1 };
        },
      },
      project: {
        findUnique: async () => ({
          id: 'p1',
          workNotesEnabled: true,
          workActivities: [],
        }),
      },
      gpsEvent: { create: async () => ({}) },
    };

    const workItemWorkflow = {
      closeOpenSessionsForWorker: async (_w: string, at: Date) => {
        closedSessionsAt = at;
        return 1;
      },
    };

    const service = new TimeEntriesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      workItemWorkflow as never,
      { ensureForStamp: async () => undefined } as never,
    );

    (
      service as unknown as {
        syncTimesheetsForStamp: () => Promise<void>;
      }
    ).syncTimesheetsForStamp = async () => undefined;

    const result = await service.systemClockOut({
      workerId: 'w1',
      occurredAtClient: outAt,
      comment: autoClockOutComment(12),
      sourceDevice: SYSTEM_AUTO_CLOCK_OUT_DEVICE,
    });

    assert.equal(created.length, 2); // BREAK_END + CLOCK_OUT
    const breakEnd = created.find(
      (c) => c.entryType === TimeEntryType.BREAK_END,
    );
    const clockOut = created.find(
      (c) => c.entryType === TimeEntryType.CLOCK_OUT,
    );
    assert.ok(breakEnd, 'BREAK_END erwartet');
    assert.ok(clockOut, 'CLOCK_OUT erwartet');
    assert.equal(clockOut!.sourceDevice, SYSTEM_AUTO_CLOCK_OUT_DEVICE);
    assert.equal(clockOut!.createdByUserId, null);
    assert.equal(clockOut!.workDocumentedAt, null);
    assert.equal(
      (clockOut!.occurredAtClient as Date).getTime(),
      outAt.getTime(),
    );
    assert.ok(segmentEndedAt);
    assert.ok(closedSessionsAt);
    assert.equal((segmentEndedAt as Date).getTime(), outAt.getTime());
    assert.equal((closedSessionsAt as Date).getTime(), outAt.getTime());
    assert.equal(result.workDocumentationRequired, true);
    assert.ok(result.clockOutTimeEntryId);
    assert.ok(result.pendingWorkDocumentation);
  });
});
