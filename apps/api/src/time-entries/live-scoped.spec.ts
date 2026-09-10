/**
 * Unit-Tests: scoped Live-Anwesenheit (#37 Phase 1) – kein Datenleck.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { RoleCode, TimeEntryType } from '@prisma/client';
import type { AuthUser } from '@office/types';
import { TimeEntriesService } from './time-entries.service';

const workerActor: AuthUser = {
  id: 'w-self',
  type: 'worker',
  roles: ['WORKER'],
};

const plActor: AuthUser = {
  id: 'u-pl',
  type: 'user',
  roles: [RoleCode.CUSTOMER_PL],
  displayName: 'Kunden-PL',
};

function makeService(prisma: unknown): TimeEntriesService {
  const service = new TimeEntriesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { ensureForStamp: async () => undefined } as never,
  ); // TimesheetGenerationService.ensureForStamp
  (
    service as unknown as {
      getStatus: () => Promise<{ clockedIn: boolean; project: null }>;
    }
  ).getStatus = async () => ({ clockedIn: false, project: null });
  return service;
}

function clockInEntry(opts: {
  id: string;
  workerId: string;
  projectId: string;
  title: string;
}) {
  return {
    id: opts.id,
    entryType: TimeEntryType.CLOCK_IN,
    occurredAtClient: new Date(),
    latitude: null,
    longitude: null,
    worker: {
      id: opts.workerId,
      workerNumber: `M-${opts.workerId}`,
      firstName: 'Max',
      lastName: opts.workerId,
      photoPath: null,
    },
    project: {
      id: opts.projectId,
      projectNumber: `P-${opts.projectId}`,
      title: opts.title,
      customer: { id: `c-${opts.projectId}`, companyName: 'Kunde' },
    },
  };
}

describe('TimeEntriesService.liveScoped (#37)', () => {
  it('WORKER sieht nur zugewiesene Projekte', async () => {
    const prisma = {
      projectAssignment: {
        findMany: async () => [{ projectId: 'p1' }],
      },
      timeEntry: {
        findMany: async () => [
          clockInEntry({
            id: 'e1',
            workerId: 'w1',
            projectId: 'p1',
            title: 'Eigen',
          }),
          clockInEntry({
            id: 'e2',
            workerId: 'w2',
            projectId: 'p2',
            title: 'Fremd',
          }),
        ],
      },
      timeActivitySegment: {
        findMany: async () => [],
      },
    };

    const rows = await makeService(prisma).liveScoped(workerActor);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.project?.id, 'p1');
    assert.equal(rows[0]?.activity, null);
  });

  it('CUSTOMER_PL sieht nur zugeordnete Projekte', async () => {
    const prisma = {
      projectCustomerPlAssignment: {
        findMany: async () => [{ projectId: 'p9' }],
      },
      timeEntry: {
        findMany: async () => [
          clockInEntry({
            id: 'e9',
            workerId: 'w9',
            projectId: 'p9',
            title: 'PL-Projekt',
          }),
          clockInEntry({
            id: 'e8',
            workerId: 'w8',
            projectId: 'p8',
            title: 'Nicht zugeordnet',
          }),
        ],
      },
      timeActivitySegment: {
        findMany: async () => [
          {
            workerId: 'w9',
            endedAt: null,
            startedAt: new Date(),
            activityType: { id: 'a1', code: 'CABLING', name: 'Kabelzug' },
          },
        ],
      },
    };

    const rows = await makeService(prisma).liveScoped(plActor);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.project?.id, 'p9');
    assert.equal(rows[0]?.activity?.name, 'Kabelzug');
  });

  it('projectId außerhalb der Scope-Menge → Forbidden', async () => {
    const prisma = {
      projectAssignment: {
        findMany: async () => [{ projectId: 'p1' }],
      },
      timeEntry: { findMany: async () => [] },
      timeActivitySegment: { findMany: async () => [] },
    };

    await assert.rejects(
      () => makeService(prisma).liveScoped(workerActor, 'p-fremd'),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });
});
