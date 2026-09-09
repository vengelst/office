/**
 * Tests für Permission-Helfer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userHasPermission } from './permissions.util';
import { roleHasDefaultPermission } from './permissions.constants';

describe('userHasPermission', () => {
  it('SUPERADMIN darf alles', () => {
    assert.equal(
      userHasPermission(['SUPERADMIN'], [], 'invoices.view'),
      true,
    );
  });
  it('prüft Permission-Liste', () => {
    assert.equal(
      userHasPermission(['OFFICE'], ['customers.view'], 'invoices.view'),
      false,
    );
    assert.equal(
      userHasPermission(['OFFICE'], ['invoices.view'], 'invoices.view'),
      true,
    );
  });
});

describe('roleHasDefaultPermission', () => {
  it('PROJECT_MANAGER ohne invoices', () => {
    assert.equal(
      roleHasDefaultPermission('PROJECT_MANAGER', 'invoices.view'),
      false,
    );
    assert.equal(
      roleHasDefaultPermission('PROJECT_MANAGER', 'projects.view'),
      true,
    );
  });
});
