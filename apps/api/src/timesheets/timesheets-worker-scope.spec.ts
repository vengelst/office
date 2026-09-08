/**
 * Unit-Tests: Worker-Scope auf Timesheets + approve(WORKER_SIGNED) (#33).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  SignerType,
  WeeklyTimesheetStatus,
} from '@prisma/client';
import type { AuthUser } from '@office/types';
import { TimesheetsService } from './timesheets.service';
import { TimesheetWorkflowService } from './timesheet-workflow.service';

const workerUser: AuthUser = {
  id: 'worker-1',
  type: 'worker',
  roles: ['WORKER'],
  displayName: 'Max Mustermann',
};

const otherWorker: AuthUser = {
  id: 'worker-2',
  type: 'worker',
  roles: ['WORKER'],
};

const officeUser: AuthUser = {
  id: 'user-1',
  type: 'user',
  roles: ['OFFICE'],
};

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    workerId: 'worker-1',
    projectId: 'project-1',
    status: WeeklyTimesheetStatus.DRAFT,
    weekYear: 2026,
    weekNumber: 10,
    signatures: [],
    days: [],
    worker: {
      id: 'worker-1',
      firstName: 'Max',
      lastName: 'Mustermann',
    },
    project: {
      id: 'project-1',
      projectNumber: 'P-1',
      title: 'Testprojekt',
    },
    ...overrides,
  };
}

describe('TimesheetsService Worker-Scope (#33)', () => {
  it('findAll filtert Worker hart auf eigene workerId', async () => {
    let capturedWhere: Record<string, unknown> | undefined;
    const prisma = {
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
      weeklyTimesheet: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    };

    const service = new TimesheetsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.findAll(
      { workerId: 'foreign-worker', page: 1, limit: 25 },
      workerUser,
    );

    assert.equal(capturedWhere?.workerId, 'worker-1');
  });

  it('findOneForUser: eigener Sheet OK, fremder Forbidden', async () => {
    const prisma = {
      weeklyTimesheet: {
        findUnique: async () => sheet(),
      },
    };
    const service = new TimesheetsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const own = await service.findOneForUser('sheet-1', workerUser);
    assert.equal(own.id, 'sheet-1');

    await assert.rejects(
      () => service.findOneForUser('sheet-1', otherWorker),
      (err: unknown) => err instanceof ForbiddenException,
    );
  });

  it('signForUser: Worker nur signerType WORKER', async () => {
    let signed = false;
    const prisma = {
      weeklyTimesheet: {
        findUnique: async () => sheet(),
      },
    };
    const workflow = {
      sign: async () => {
        signed = true;
        return sheet({ status: WeeklyTimesheetStatus.WORKER_SIGNED });
      },
    };
    const service = new TimesheetsService(
      prisma as never,
      {} as never,
      {} as never,
      workflow as never,
    );

    await assert.rejects(
      () =>
        service.signForUser(
          'sheet-1',
          {
            signerType: SignerType.CUSTOMER,
            signerName: 'X',
            signatureBase64: 'aGVsbG8=',
          },
          workerUser,
          { ipAddress: '127.0.0.1' },
        ),
      (err: unknown) => err instanceof ForbiddenException,
    );

    await service.signForUser(
      'sheet-1',
      {
        signerType: SignerType.WORKER,
        signerName: 'Max Mustermann',
        signatureBase64: 'aGVsbG8=',
      },
      workerUser,
      { ipAddress: '127.0.0.1' },
    );
    assert.equal(signed, true);
  });

  it('Office-Proxy-Signatur bleibt erlaubt', async () => {
    let signed = false;
    const prisma = {
      weeklyTimesheet: {
        findUnique: async () => sheet(),
      },
    };
    const service = new TimesheetsService(
      prisma as never,
      { findCustomerPlProjectIds: async () => null } as never,
      {} as never,
      {
        sign: async () => {
          signed = true;
          return sheet({ status: WeeklyTimesheetStatus.WORKER_SIGNED });
        },
      } as never,
    );

    await service.signForUser(
      'sheet-1',
      {
        signerType: SignerType.WORKER,
        signerName: 'Büro für Max',
        signatureBase64: 'aGVsbG8=',
      },
      officeUser,
      { ipAddress: '127.0.0.1' },
    );
    assert.equal(signed, true);
  });
});

describe('TimesheetWorkflowService.approve WORKER_SIGNED (#33)', () => {
  it('genehmigt WORKER_SIGNED → APPROVED', async () => {
    let updatedStatus: WeeklyTimesheetStatus | undefined;
    let call = 0;
    const prisma = {
      weeklyTimesheet: {
        findUnique: async () => {
          call += 1;
          if (call === 1) {
            return sheet({ status: WeeklyTimesheetStatus.WORKER_SIGNED });
          }
          return sheet({ status: WeeklyTimesheetStatus.APPROVED });
        },
        update: async ({
          data,
        }: {
          data: { status: WeeklyTimesheetStatus };
        }) => {
          updatedStatus = data.status;
          return sheet({ status: data.status });
        },
      },
    };

    const workflow = new TimesheetWorkflowService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    (
      workflow as unknown as {
        exportTimesheetPdf: () => Promise<void>;
      }
    ).exportTimesheetPdf = async () => undefined;

    const result = await workflow.approve('sheet-1', 'user-1');
    assert.equal(updatedStatus, WeeklyTimesheetStatus.APPROVED);
    assert.equal(result.status, WeeklyTimesheetStatus.APPROVED);
  });

  it('lehnt DRAFT ab', async () => {
    const prisma = {
      weeklyTimesheet: {
        findUnique: async () => sheet({ status: WeeklyTimesheetStatus.DRAFT }),
      },
    };
    const workflow = new TimesheetWorkflowService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await assert.rejects(
      () => workflow.approve('sheet-1', 'user-1'),
      (err: unknown) => err instanceof ConflictException,
    );
  });
});
