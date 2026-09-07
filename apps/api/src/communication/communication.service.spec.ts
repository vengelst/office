/**
 * Unit-Tests: Contact-Validierung CommunicationService (Fremd-contactId → 400).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CommunicationService } from './communication.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      findFirst: async () => ({ id: 'cust-1' }),
      findMany: async () => [],
    },
    subcontractor: {
      findFirst: async () => ({ id: 'sub-1' }),
      findMany: async () => [],
    },
    worker: {
      findFirst: async () => ({ id: 'w-1' }),
      findMany: async () => [],
    },
    customerContact: {
      findUnique: async () => ({ customerId: 'other-customer' }),
      findMany: async () => [],
    },
    subcontractorContact: {
      findUnique: async () => ({ subcontractorId: 'other-sub' }),
      findMany: async () => [],
    },
    communicationEntry: {
      create: async () => {
        throw new Error('create sollte nicht aufgerufen werden');
      },
      findUnique: async () => null,
      findMany: async () => [],
      count: async () => 0,
      update: async () => null,
      delete: async () => null,
    },
    user: { findMany: async () => [] },
    $transaction: async (ops: unknown) => ops,
    ...overrides,
  };
}

describe('CommunicationService contact validation', () => {
  it('wirft 400 wenn contactId nicht zum Kunden gehört', async () => {
    const service = new CommunicationService(makePrisma() as never);
    await assert.rejects(
      () =>
        service.create(
          {
            entityType: 'CUSTOMER',
            entityId: 'cust-1',
            contactId: 'contact-x',
            type: 'PHONE_CALL',
            content: 'Test',
          } as never,
          'user-1',
        ),
      (err: unknown) => err instanceof BadRequestException,
    );
  });

  it('wirft 400 wenn contactId zum falschen Sub gehört', async () => {
    const service = new CommunicationService(makePrisma() as never);
    await assert.rejects(
      () =>
        service.create(
          {
            entityType: 'SUBCONTRACTOR',
            entityId: 'sub-1',
            contactId: 'sc-1',
            type: 'NOTE',
            content: 'Notiz',
          } as never,
          'user-1',
        ),
      (err: unknown) => err instanceof BadRequestException,
    );
  });
});
