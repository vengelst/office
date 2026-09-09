/**
 * Zentrale Liste aller Permission-Codes der Office-API.
 * Muss mit Seed, Migration und PermissionsBootstrapService synchron bleiben.
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

/** Beschreibungen für Bootstrap/Seed (DE). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  'customers.view': 'Kunden ansehen',
  'customers.create': 'Kunden anlegen',
  'customers.edit': 'Kunden bearbeiten',
  'customers.delete': 'Kunden löschen',
  'projects.view': 'Projekte ansehen',
  'projects.create': 'Projekte anlegen',
  'projects.edit': 'Projekte bearbeiten',
  'projects.delete': 'Projekte löschen',
  'workers.view': 'Monteure ansehen',
  'workers.create': 'Monteure anlegen',
  'workers.edit': 'Monteure bearbeiten',
  'workers.delete': 'Monteure löschen',
  'timesheets.view': 'Stundenzettel ansehen',
  'timesheets.create': 'Stundenzettel erstellen',
  'timesheets.sign': 'Stundenzettel abzeichnen',
  'invoices.view': 'Rechnungen ansehen',
  'invoices.create': 'Rechnungen anlegen',
  'invoices.edit': 'Rechnungen bearbeiten',
  'invoices.finalize': 'Rechnungen finalisieren',
  'invoices.send': 'Rechnungen versenden',
  'documents.view': 'Dokumente ansehen',
  'documents.manage': 'Dokumente verwalten',
  'equipment.view': 'Geräte ansehen',
  'equipment.manage': 'Geräte verwalten',
  'calendar.view': 'Kalender ansehen',
  'communication.view': 'Kommunikation ansehen',
  'vehicles.view': 'Fahrzeuge ansehen',
  'vehicles.manage': 'Fahrzeuge verwalten',
  'subcontractors.view': 'Nachunternehmer ansehen',
  'teams.view': 'Teams ansehen',
  'todos.view': 'Todos ansehen',
  'todos.manage': 'Todos verwalten',
  'timeclock.view': 'Stempeluhr ansehen',
  'settings.manage': 'Einstellungen verwalten',
  'users.manage': 'Benutzer und Rollen verwalten',
};

/**
 * Welche Permission einer Rolle zugewiesen wird (Seed-/Bootstrap-Matrix).
 * SUPERADMIN: alle; OFFICE: alle außer users.manage;
 * PROJECT_MANAGER: *.view (ohne invoices.*) + projects.edit + timesheets.*;
 * WORKER: nur *.view; CUSTOMER_PL: enges Set.
 */
export function roleAllowsPermission(
  roleCode: string,
  perm: string,
): boolean {
  switch (roleCode) {
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
