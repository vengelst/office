/**
 * Tests: Commit in $transaction – bei Fehler kein Cache-Delete / Rollback-Verhalten.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiImportService } from './ai-import.service';
import type { AiImportCommitRequest } from './types';

function buildCommitDto(
  overrides: Partial<AiImportCommitRequest> = {},
): AiImportCommitRequest {
  return {
    previewId: 'preview-1',
    mode: 'ONE_CUSTOMER_MANY_CONTACTS',
    sourceFilename: 'test.pdf',
    customerDraft: { companyName: 'SPIE Test GmbH' },
    branches: [
      {
        include: true,
        key: 'frankfurt',
        name: 'SPIE – Frankfurt',
        enrichmentStatus: 'SKIPPED',
      },
    ],
    contacts: [
      {
        include: true,
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com',
        kind: 'PERSON',
      },
      {
        include: true,
        firstName: '',
        lastName: '',
        email: 'nl-nordbayern@spie.com',
        kind: 'COMPANY_EMAIL',
      },
    ],
    companyEmails: [],
    ...overrides,
  };
}

describe('AiImportService.commit transaction + COMPANY_EMAIL', () => {
  it('rollt zurück und löscht Cache nicht, wenn Contact-Create fehlschlägt', async () => {
    const ops: string[] = [];
    let cacheDeleted = false;

    const tx = {
      customer: {
        findFirst: async () => null,
        create: async (args: { data: { customerNumber: string } }) => {
          ops.push('customer');
          return {
            id: 'cust-1',
            customerNumber: args.data.customerNumber || 'K-2026-0001',
          };
        },
      },
      customerBranch: {
        findMany: async () => [],
        create: async () => {
          ops.push('branch');
          return { id: 'br-1' };
        },
      },
      customerContact: {
        create: async () => {
          ops.push('contact');
          throw new Error('simulated fail after first contact');
        },
      },
      customerEmail: {
        create: async () => {
          ops.push('email');
          return { id: 'em-1' };
        },
      },
    };

    const prisma = {
      $transaction: async (
        fn: (t: typeof tx) => Promise<unknown>,
        _opts?: unknown,
      ) => {
        // Simuliert interactive transaction: Fehler propagieren = Rollback
        return fn(tx);
      },
    };

    const ai = { assertReady: async () => undefined };
    const extract = {};
    const enrichment = {};

    const service = new AiImportService(
      prisma as never,
      ai as never,
      extract as never,
      enrichment as never,
    );

    // Cache setzen und delete tracken
    const cache = (
      service as unknown as {
        cache: {
          set: (id: string, p: unknown, f: string) => void;
          delete: (id: string) => void;
          get: (id: string) => unknown;
        };
      }
    ).cache;
    cache.set(
      'preview-1',
      {
        suggestedMode: 'ONE_CUSTOMER_MANY_CONTACTS',
        branches: [],
        contacts: [],
        warnings: [],
      },
      'test.pdf',
    );
    const origDelete = cache.delete.bind(cache);
    cache.delete = (id: string) => {
      cacheDeleted = true;
      origDelete(id);
    };

    await assert.rejects(
      () => service.commit(buildCommitDto(), 'user-1'),
      /simulated fail/,
    );

    assert.equal(cacheDeleted, false, 'Cache darf bei Fehler nicht gelöscht werden');
    assert.ok(ops.includes('customer'), 'Kunde wurde in TX angelegt');
    assert.ok(ops.includes('branch'), 'Branch wurde in TX angelegt');
    assert.ok(ops.includes('contact'), 'Contact-Create wurde versucht');
    // E-Mails kommen nach Contacts → bei Fail davor nicht geschrieben
    assert.equal(ops.includes('email'), false);
  });

  it('legt COMPANY_EMAIL als CustomerEmail an, nicht als Contact', async () => {
    const contactCreates: unknown[] = [];
    const emailCreates: unknown[] = [];

    const tx = {
      customer: {
        findFirst: async () => null,
        create: async (args: { data: { customerNumber: string } }) => ({
          id: 'cust-1',
          customerNumber: args.data.customerNumber || 'K-2026-0002',
        }),
      },
      customerBranch: {
        findMany: async () => [],
        create: async () => ({ id: 'br-1' }),
      },
      customerContact: {
        create: async (args: unknown) => {
          contactCreates.push(args);
          return { id: `ct-${contactCreates.length}` };
        },
      },
      customerEmail: {
        create: async (args: unknown) => {
          emailCreates.push(args);
          return { id: `em-${emailCreates.length}` };
        },
      },
    };

    const prisma = {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };

    const service = new AiImportService(
      prisma as never,
      { assertReady: async () => undefined } as never,
      {} as never,
      {} as never,
    );

    const result = await service.commit(
      buildCommitDto({
        contacts: [
          {
            include: true,
            firstName: 'Udo',
            lastName: 'Oerther',
            email: 'udo.oerther@spie.com',
            kind: 'PERSON',
          },
          {
            include: true,
            firstName: '-',
            lastName: '-',
            email: 'nl-nordbayern@spie.com',
            kind: 'COMPANY_EMAIL',
          },
          {
            include: true,
            firstName: '',
            lastName: '',
            email: 'office-austria@spie.com',
            // Heuristik ohne kind
          },
        ],
        companyEmails: [
          { include: true, email: 'nl-nordbayern@spie.com', label: 'NL' },
        ],
      }),
      'user-1',
    );

    assert.equal(contactCreates.length, 1);
    assert.equal(result.createdContacts, 1);
    assert.equal(result.createdEmails, 2); // nl-nordbayern + office-austria (deduped)
    const emails = emailCreates.map(
      (e) => (e as { data: { email: string } }).data.email,
    );
    assert.ok(emails.includes('nl-nordbayern@spie.com'));
    assert.ok(emails.includes('office-austria@spie.com'));
    assert.equal(
      emails.filter((e) => e === 'nl-nordbayern@spie.com').length,
      1,
    );
  });
});
