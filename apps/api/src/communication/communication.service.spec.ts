/**
 * Unit-Tests: Contact-Validierung CommunicationService (Fremd-contactId → 400).
 */

import { BadRequestException } from '@nestjs/common';
import { CommunicationService } from './communication.service';

describe('CommunicationService contact validation', () => {
  const prisma = {
    customer: { findFirst: jest.fn(), findMany: jest.fn() },
    subcontractor: { findFirst: jest.fn(), findMany: jest.fn() },
    worker: { findFirst: jest.fn(), findMany: jest.fn() },
    customerContact: { findUnique: jest.fn(), findMany: jest.fn() },
    subcontractorContact: { findUnique: jest.fn(), findMany: jest.fn() },
    communicationEntry: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new CommunicationService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wirft 400 wenn contactId nicht zum Kunden gehört', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.customerContact.findUnique.mockResolvedValue({
      customerId: 'other-customer',
    });

    await expect(
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
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.communicationEntry.create).not.toHaveBeenCalled();
  });

  it('wirft 400 wenn contactId zum falschen Sub gehört', async () => {
    prisma.subcontractor.findFirst.mockResolvedValue({ id: 'sub-1' });
    prisma.subcontractorContact.findUnique.mockResolvedValue({
      subcontractorId: 'other-sub',
    });

    await expect(
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
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
