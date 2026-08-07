-- Rolle CUSTOMER_PL (Kunden-Projektleiter) anlegen.
-- Eigene Migration, weil ein in derselben Transaktion neu angelegter Enum-Wert
-- (RoleCode.CUSTOMER_PL aus der Vormigration) in Postgres nicht verwendet werden darf.
INSERT INTO "Role" ("id", "code", "name", "description")
VALUES (
  'role_customer_pl',
  'CUSTOMER_PL',
  'Kunden-PL',
  'Projektleiter des Kunden – Item-Prüfung und Wochenabzeichnung, kein interner Zugriff'
)
ON CONFLICT ("code") DO NOTHING;
