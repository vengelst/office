-- E-Rechnung Kundenfelder
DO $$ BEGIN
  CREATE TYPE "EInvoicePreference" AS ENUM ('NONE', 'ZUGFERD_COMFORT', 'XRECHNUNG', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "leitwegId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "eInvoicePreference" "EInvoicePreference" NOT NULL DEFAULT 'ZUGFERD_COMFORT';

-- Permission-Codes (idempotent)
INSERT INTO "Permission" ("id", "code", "description")
SELECT md5(v.code), v.code, v.code
FROM (VALUES
  ('invoices.view'),
  ('invoices.create'),
  ('invoices.edit'),
  ('invoices.finalize'),
  ('invoices.send'),
  ('documents.view'),
  ('documents.manage'),
  ('equipment.view'),
  ('equipment.manage'),
  ('calendar.view'),
  ('communication.view'),
  ('vehicles.view'),
  ('vehicles.manage'),
  ('subcontractors.view'),
  ('teams.view'),
  ('todos.view'),
  ('todos.manage'),
  ('timeclock.view')
) AS v(code)
WHERE NOT EXISTS (SELECT 1 FROM "Permission" p WHERE p.code = v.code);

-- SUPERADMIN: alle Permissions
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(r.id || p.id), r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'SUPERADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- OFFICE: alles außer users.manage
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(r.id || p.id), r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'OFFICE'
  AND p.code <> 'users.manage'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- PROJECT_MANAGER: views (ohne invoices) + projects.edit + timesheets.*
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(r.id || p.id), r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'PROJECT_MANAGER'
  AND (
    (p.code LIKE '%.view' AND p.code NOT LIKE 'invoices.%')
    OR p.code = 'projects.edit'
    OR p.code LIKE 'timesheets.%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );
