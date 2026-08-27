/**
 * Tests: COMPANY_EMAIL-Heuristik und Dedup.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCollectiveEmailAddress,
  isCompanyEmailContact,
  splitAndDedupCompanyEmails,
} from './company-email.util';

describe('company-email util', () => {
  it('erkennt Sammeladressen per Heuristik', () => {
    assert.equal(isCollectiveEmailAddress('nl-nordbayern@spie.com'), true);
    assert.equal(isCollectiveEmailAddress('office-austria@spie.com'), true);
    assert.equal(isCollectiveEmailAddress('info@spie.com'), true);
    assert.equal(isCollectiveEmailAddress('customer.care@spie.com'), true);
    assert.equal(isCollectiveEmailAddress('udo.oerther@spie.com'), false);
  });

  it('respektiert kind COMPANY_EMAIL', () => {
    assert.equal(
      isCompanyEmailContact({
        kind: 'COMPANY_EMAIL',
        email: 'person-looking@spie.com',
        firstName: '',
        lastName: '',
      }),
      true,
    );
  });

  it('verschiebt Sammelkontakte nach companyEmails und dedupliziert', () => {
    const { contacts, companyEmails, movedCount } = splitAndDedupCompanyEmails(
      [
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
          role: 'NL Nordbayern',
          kind: 'PERSON',
        },
        {
          include: true,
          firstName: '',
          lastName: '',
          email: 'office-austria@spie.com',
          kind: 'COMPANY_EMAIL',
        },
      ],
      [
        {
          include: true,
          email: 'nl-nordbayern@spie.com',
          label: 'bereits vorhanden',
        },
      ],
    );

    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].email, 'udo.oerther@spie.com');
    assert.equal(movedCount, 2);
    const emails = companyEmails.map((e) => e.email.toLowerCase()).sort();
    assert.deepEqual(emails, [
      'nl-nordbayern@spie.com',
      'office-austria@spie.com',
    ]);
    // Dedup: nur eine nl-nordbayern
    assert.equal(
      companyEmails.filter((e) => e.email.includes('nl-nordbayern')).length,
      1,
    );
  });
});
