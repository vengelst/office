/**
 * Alle Permission-Codes der Office-API.
 * Seed, Bootstrap und Guards nutzen dieselbe Liste.
 */

export const PERMISSION_CODES = [
  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'workers.view',
  'workers.create',
  'workers.edit',
  'workers.delete',
  'timesheets.view',
  'timesheets.create',
  'timesheets.sign',
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.finalize',
  'invoices.send',
  'documents.view',
  'documents.manage',
  'equipment.view',
  'equipment.manage',
  'calendar.view',
  'communication.view',
  'vehicles.view',
  'vehicles.manage',
  'subcontractors.view',
  'teams.view',
  'todos.view',
  'todos.manage',
  'timeclock.view',
  'settings.manage',
  'users.manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Default: welche Rolle welche Permission bekommt. */
export function roleHasDefaultPermission(
  role: string,
  perm: string,
): boolean {
  switch (role) {
    case 'SUPERADMIN':
      return true;
    case 'OFFICE':
      return perm !== 'users.manage';
    case 'PROJECT_MANAGER':
      return (
        (perm.endsWith('.view') && !perm.startsWith('invoices.')) ||
        perm === 'projects.edit' ||
        perm.startsWith('timesheets.')
      );
    case 'WORKER':
      return perm.endsWith('.view');
    case 'CUSTOMER_PL':
      return (
        perm === 'projects.view' ||
        perm === 'timesheets.view' ||
        perm === 'timesheets.sign'
      );
    default:
      return false;
  }
}
