/**
 * Unit-Tests: Stempel-Sperre nach WORKER_SIGNED (#33).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { TimeEntryType, WeeklyTimesheetStatus } from '@prisma/client';
import type { AuthUser } from '@office/types';
import { STAMP_LOCKED_MESSAGE } from '../timesheets/timesheet-shared';
import { TimeEntriesService } from './time-entries.service';

const worker: AuthUser = {
  id: 'w1',
  type: 'worker',
  roles: ['WORKER'],
};

function makeService(prisma: unknown) {
  const service = new TimeEntriesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { ensureForStamp: async () => undefined } as never,
  );
  (
    service as unknown as {
      getStatus: () => Promise<{ clockedIn: boolean; project: null }>;
    }
  ).getStatus = async () => ({ clockedIn: false, project: null });
  (
    service as unknown as {
      syncTimesheetsForStamp: () => Promise<void>;
    }
  ).syncTimesheetsForStamp = async () => undefined;
  (
    service as unknown as {
      maybeRecordGps: () => Promise<void>;
    }
  ).maybeRecordGps = async () => undefined;
  return service;
}

describe('TimeEntriesService Stempel-Sperre (#33)', () => {
  it('clockIn nach WORKER_SIGNED derselben Projekt-KW → Conflict mit DE-Text', async () => {
    const prisma = {
      worker: {
        findFirst: async () => ({
          id: 'w1',
          active: true,
          deletedAt: null,
          masterEngineer: false,
        }),
        findUnique: async () => ({ masterEngineer: false }),
      },
      project: {
        findFirst: async () => ({ id: 'p1' }),
      },
      projectAssignment: {
        findFirst: async () => ({ id: 'a1' }),
      },
      timeEntry: {
        findFirst: async () => null,
        create: async () => {
          throw new Error('create sollte nicht erreicht werden');
        },
      },
      weeklyTimesheet: {
        findFirst: async (args: {
          where: {
            status?: { in?: WeeklyTimesheetStatus[] };
            projectId?: string;
          };
        }) => {
          assert.equal(args.where.projectId, 'p1');
          assert.ok(
            args.where.status?.in?.includes(
              WeeklyTimesheetStatus.WORKER_SIGNED,
            ),
          );
          return { id: 'sheet-locked' };
        },
      },
    };

    const service = makeService(prisma);

    await assert.rejects(
      () =>
        service.clockIn(
          {
            workerId: 'w1',
            projectId: 'p1',
            occurredAtClient: '2026-03-03T08:00:00.000Z',
          },
          worker,
        ),
      (err: unknown) => {
        assert.ok(err instanceof ConflictException);
        assert.equal(
          (err as ConflictException).message,
          STAMP_LOCKED_MESSAGE,
        );
        return true;
      },
    );
  });

  it('clockIn bei freiem Sheet (kein Lock) erlaubt', async () => {
    let created = false;
    const prisma = {
      worker: {
        findFirst: async () => ({
          id: 'w1',
          active: true,
          deletedAt: null,
          masterEngineer: false,
        }),
        findUnique: async () => ({ masterEngineer: false }),
      },
      project: {
        findFirst: async () => ({ id: 'p1' }),
      },
      projectAssignment: {
        findFirst: async () => ({ id: 'a1' }),
      },
      timeEntry: {
        findFirst: async () => null,
        create: async ({ data }: { data: { entryType: TimeEntryType } }) => {
          created = true;
          assert.equal(data.entryType, TimeEntryType.CLOCK_IN);
          return { id: 'e1', ...data };
        },
      },
      weeklyTimesheet: {
        findFirst: async () => null,
      },
    };

    const service = makeService(prisma);
    await service.clockIn(
      {
        workerId: 'w1',
        projectId: 'p1',
        occurredAtClient: '2026-03-03T08:00:00.000Z',
      },
      worker,
    );
    assert.equal(created, true);
  });
});
