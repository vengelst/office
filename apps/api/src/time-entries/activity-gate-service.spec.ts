/**
 * Unit-Tests: clockIn / switchActivity Tätigkeits-Gate (#34).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TimeEntryType } from '@prisma/client';
import type { AuthUser } from '@office/types';
import { TimeEntriesService } from './time-entries.service';

const actor: AuthUser = {
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

function basePrisma(overrides: Record<string, unknown> = {}) {
  return {
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
      findFirst: async () => ({ id: 'p1', billingMode: 'HOURLY_PACKAGE' }),
    },
    projectAssignment: {
      findFirst: async () => ({ id: 'a1' }),
    },
    weeklyTimesheet: {
      findFirst: async () => null,
    },
    activityType: {
      findFirst: async () => ({ id: 'act1' }),
    },
    timeEntry: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'te1',
        ...args.data,
      }),
    },
    timeActivitySegment: {
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'seg1',
        ...args.data,
      }),
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    gpsEvent: {
      create: async () => ({}),
    },
    ...overrides,
  };
}

describe('TimeEntriesService activity gate (#34)', () => {
  it('clockIn Normal + HOURLY ohne activityTypeId → 400', async () => {
    const service = makeService(basePrisma());
    await assert.rejects(
      () =>
        service.clockIn(
          {
            workerId: 'w1',
            projectId: 'p1',
            occurredAtClient: '2026-09-08T08:00:00.000Z',
          },
          actor,
        ),
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.match(String((err as BadRequestException).message), /Pflicht/);
        return true;
      },
    );
  });

  it('clockIn Normal + HOURLY mit Tätigkeit → Segment angelegt', async () => {
    let segmentCreated: Record<string, unknown> | null = null;
    const prisma = basePrisma({
      timeActivitySegment: {
        create: async (args: { data: Record<string, unknown> }) => {
          segmentCreated = args.data;
          return { id: 'seg1', ...args.data };
        },
        findFirst: async () => null,
        updateMany: async () => ({ count: 0 }),
      },
    });
    const service = makeService(prisma);
    await service.clockIn(
      {
        workerId: 'w1',
        projectId: 'p1',
        activityTypeId: 'act1',
        occurredAtClient: '2026-09-08T08:00:00.000Z',
      },
      actor,
    );
    assert.ok(segmentCreated);
    assert.equal(
      (segmentCreated as Record<string, unknown>).activityTypeId,
      'act1',
    );
    assert.equal(
      (segmentCreated as Record<string, unknown>).workerId,
      'w1',
    );
    assert.equal(
      (segmentCreated as Record<string, unknown>).projectId,
      'p1',
    );
  });

  it('clockIn Normal + UNIT_BASED ohne Tätigkeit → ok, kein Segment', async () => {
    let segmentCalls = 0;
    const prisma = basePrisma({
      project: {
        findFirst: async () => ({ id: 'p1', billingMode: 'UNIT_BASED' }),
      },
      timeActivitySegment: {
        create: async () => {
          segmentCalls += 1;
          return { id: 'seg1' };
        },
        findFirst: async () => null,
        updateMany: async () => ({ count: 0 }),
      },
    });
    const service = makeService(prisma);
    await service.clockIn(
      {
        workerId: 'w1',
        projectId: 'p1',
        occurredAtClient: '2026-09-08T08:00:00.000Z',
      },
      actor,
    );
    assert.equal(segmentCalls, 0);
  });

  it('clockIn Master + MIXED ohne Tätigkeit → 400', async () => {
    const prisma = basePrisma({
      worker: {
        findFirst: async () => ({
          id: 'w1',
          active: true,
          deletedAt: null,
          masterEngineer: true,
        }),
        findUnique: async () => ({ masterEngineer: true }),
      },
      project: {
        findFirst: async () => ({ id: 'p1', billingMode: 'MIXED' }),
      },
    });
    const service = makeService(prisma);
    await assert.rejects(
      () =>
        service.clockIn(
          {
            workerId: 'w1',
            projectId: 'p1',
            occurredAtClient: '2026-09-08T08:00:00.000Z',
          },
          actor,
        ),
      BadRequestException,
    );
  });

  it('switchActivity Normal + UNIT_BASED → Forbidden', async () => {
    const prisma = basePrisma({
      project: {
        findFirst: async () => ({ id: 'p1', billingMode: 'UNIT_BASED' }),
      },
      timeEntry: {
        findFirst: async () => ({
          id: 'te-open',
          entryType: TimeEntryType.CLOCK_IN,
          occurredAtClient: new Date('2026-09-08T08:00:00.000Z'),
          projectId: 'p1',
          latitude: null,
          longitude: null,
          project: {
            id: 'p1',
            projectNumber: 'P-1',
            title: 'Test',
            billingMode: 'UNIT_BASED',
          },
        }),
        create: async () => {
          throw new Error('nicht erwartet');
        },
      },
    });
    const service = makeService(prisma);
    await assert.rejects(
      () =>
        service.switchActivity(
          { workerId: 'w1', activityTypeId: 'act2' },
          actor,
        ),
      ForbiddenException,
    );
  });

  it('switchActivity Normal + HOURLY → Segment wechseln', async () => {
    let closed = false;
    let created: Record<string, unknown> | null = null;
    const prisma = basePrisma({
      timeEntry: {
        findFirst: async () => ({
          id: 'te-open',
          entryType: TimeEntryType.CLOCK_IN,
          occurredAtClient: new Date('2026-09-08T08:00:00.000Z'),
          projectId: 'p1',
          latitude: null,
          longitude: null,
          project: {
            id: 'p1',
            projectNumber: 'P-1',
            title: 'Test',
            billingMode: 'HOURLY_PACKAGE',
          },
        }),
        create: async () => {
          throw new Error('nicht erwartet');
        },
      },
      timeActivitySegment: {
        findFirst: async () => ({
          id: 'seg-old',
          activityTypeId: 'act1',
          endedAt: null,
        }),
        updateMany: async () => {
          closed = true;
          return { count: 1 };
        },
        create: async (args: { data: Record<string, unknown> }) => {
          created = args.data;
          return { id: 'seg-new', ...args.data };
        },
      },
    });
    const service = makeService(prisma);
    (
      service as unknown as {
        getStatus: () => Promise<{ clockedIn: boolean }>;
      }
    ).getStatus = async () => ({ clockedIn: true });

    await service.switchActivity(
      { workerId: 'w1', activityTypeId: 'act2' },
      actor,
    );
    assert.equal(closed, true);
    assert.ok(created);
    assert.equal(
      (created as Record<string, unknown>).activityTypeId,
      'act2',
    );
  });

  it('switchActivity Normal + MIXED → Forbidden', async () => {
    const prisma = basePrisma({
      project: {
        findFirst: async () => ({ id: 'p1', billingMode: 'MIXED' }),
      },
      timeEntry: {
        findFirst: async () => ({
          id: 'te-open',
          entryType: TimeEntryType.CLOCK_IN,
          occurredAtClient: new Date('2026-09-08T08:00:00.000Z'),
          projectId: 'p1',
          latitude: null,
          longitude: null,
          project: {
            id: 'p1',
            projectNumber: 'P-1',
            title: 'Test',
            billingMode: 'MIXED',
          },
        }),
        create: async () => {
          throw new Error('nicht erwartet');
        },
      },
    });
    const service = makeService(prisma);
    await assert.rejects(
      () =>
        service.switchActivity(
          { workerId: 'w1', activityTypeId: 'act2' },
          actor,
        ),
      ForbiddenException,
    );
  });
});
