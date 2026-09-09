/**
 * Unit-Tests für Permission-Matrix-Helfer (ohne Prisma).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSION_CODES,
  roleAllowsPermission,
} from './permissions.constants';

describe('roleAllowsPermission', () => {
  it('SUPERADMIN darf alles', () => {
    for (const code of PERMISSION_CODES) {
      assert.equal(roleAllowsPermission('SUPERADMIN', code), true);
    }
  });

  it('OFFICE darf alles außer users.manage', () => {
    assert.equal(roleAllowsPermission('OFFICE', 'invoices.view'), true);
    assert.equal(roleAllowsPermission('OFFICE', 'users.manage'), false);
    assert.equal(roleAllowsPermission('OFFICE', 'settings.manage'), true);
  });

  it('PROJECT_MANAGER hat keine invoices.*', () => {
    assert.equal(roleAllowsPermission('PROJECT_MANAGER', 'projects.view'), true);
    assert.equal(roleAllowsPermission('PROJECT_MANAGER', 'projects.edit'), true);
    assert.equal(roleAllowsPermission('PROJECT_MANAGER', 'timesheets.sign'), true);
    assert.equal(roleAllowsPermission('PROJECT_MANAGER', 'invoices.view'), false);
    assert.equal(roleAllowsPermission('PROJECT_MANAGER', 'invoices.create'), false);
  });

  it('WORKER nur *.view', () => {
    assert.equal(roleAllowsPermission('WORKER', 'customers.view'), true);
    assert.equal(roleAllowsPermission('WORKER', 'customers.edit'), false);
  });

  it('CUSTOMER_PL enges Set', () => {
    assert.equal(roleAllowsPermission('CUSTOMER_PL', 'projects.view'), true);
    assert.equal(roleAllowsPermission('CUSTOMER_PL', 'timesheets.sign'), true);
    assert.equal(roleAllowsPermission('CUSTOMER_PL', 'customers.view'), false);
  });
});
