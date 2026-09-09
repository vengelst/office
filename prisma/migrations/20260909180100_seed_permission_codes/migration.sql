-- Idempotent: neue Permission-Codes und RolePermission-Links (Seed-Matrix).
-- IDs sind stabile Prefixe; ON CONFLICT DO NOTHING macht die Migration wiederholbar.

INSERT INTO "Permission" ("id", "code", "description") VALUES
  ('perm_invoices_view', 'invoices.view', 'Rechnungen ansehen'),
  ('perm_invoices_create', 'invoices.create', 'Rechnungen anlegen'),
  ('perm_invoices_edit', 'invoices.edit', 'Rechnungen bearbeiten'),
  ('perm_invoices_finalize', 'invoices.finalize', 'Rechnungen finalisieren'),
  ('perm_invoices_send', 'invoices.send', 'Rechnungen versenden'),
  ('perm_documents_view', 'documents.view', 'Dokumente ansehen'),
  ('perm_documents_manage', 'documents.manage', 'Dokumente verwalten'),
  ('perm_equipment_view', 'equipment.view', 'Geräte ansehen'),
  ('perm_equipment_manage', 'equipment.manage', 'Geräte verwalten'),
  ('perm_calendar_view', 'calendar.view', 'Kalender ansehen'),
  ('perm_communication_view', 'communication.view', 'Kommunikation ansehen'),
  ('perm_vehicles_view', 'vehicles.view', 'Fahrzeuge ansehen'),
  ('perm_vehicles_manage', 'vehicles.manage', 'Fahrzeuge verwalten'),
  ('perm_subcontractors_view', 'subcontractors.view', 'Nachunternehmer ansehen'),
  ('perm_teams_view', 'teams.view', 'Teams ansehen'),
  ('perm_todos_view', 'todos.view', 'Todos ansehen'),
  ('perm_todos_manage', 'todos.manage', 'Todos verwalten'),
  ('perm_timeclock_view', 'timeclock.view', 'Stempeluhr ansehen'),
  ('perm_customers_view', 'customers.view', 'Kunden ansehen'),
  ('perm_customers_create', 'customers.create', 'Kunden anlegen'),
  ('perm_customers_edit', 'customers.edit', 'Kunden bearbeiten'),
  ('perm_customers_delete', 'customers.delete', 'Kunden löschen'),
  ('perm_projects_view', 'projects.view', 'Projekte ansehen'),
  ('perm_projects_create', 'projects.create', 'Projekte anlegen'),
  ('perm_projects_edit', 'projects.edit', 'Projekte bearbeiten'),
  ('perm_projects_delete', 'projects.delete', 'Projekte löschen'),
  ('perm_workers_view', 'workers.view', 'Monteure ansehen'),
  ('perm_workers_create', 'workers.create', 'Monteure anlegen'),
  ('perm_workers_edit', 'workers.edit', 'Monteure bearbeiten'),
  ('perm_workers_delete', 'workers.delete', 'Monteure löschen'),
  ('perm_timesheets_view', 'timesheets.view', 'Stundenzettel ansehen'),
  ('perm_timesheets_create', 'timesheets.create', 'Stundenzettel erstellen'),
  ('perm_timesheets_sign', 'timesheets.sign', 'Stundenzettel abzeichnen'),
  ('perm_settings_manage', 'settings.manage', 'Einstellungen verwalten'),
  ('perm_users_manage', 'users.manage', 'Benutzer und Rollen verwalten')
ON CONFLICT ("code") DO NOTHING;

-- SUPERADMIN: alle Permissions
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_sa_' || p."code", r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'SUPERADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- OFFICE: alle außer users.manage
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_of_' || p."code", r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'OFFICE' AND p."code" <> 'users.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- PROJECT_MANAGER: *.view ohne invoices.* + projects.edit + timesheets.*
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_pm_' || p."code", r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'PROJECT_MANAGER'
  AND (
    (p."code" LIKE '%.view' AND p."code" NOT LIKE 'invoices.%')
    OR p."code" = 'projects.edit'
    OR p."code" LIKE 'timesheets.%'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- WORKER: nur *.view
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_wk_' || p."code", r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'WORKER' AND p."code" LIKE '%.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- CUSTOMER_PL: enges Set
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'rp_cpl_' || p."code", r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."code" = 'CUSTOMER_PL'
  AND p."code" IN ('projects.view', 'timesheets.view', 'timesheets.sign')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
