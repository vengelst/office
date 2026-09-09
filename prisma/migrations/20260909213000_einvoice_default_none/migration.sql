-- Default: nur PDF, E-Rechnung bewusst am Kunden aktivieren
ALTER TABLE "Customer" ALTER COLUMN "eInvoicePreference" SET DEFAULT 'NONE';

-- Bisherige Auto-Defaults (frisch eingeführt) auf NONE zurücksetzen
UPDATE "Customer"
SET "eInvoicePreference" = 'NONE'
WHERE "eInvoicePreference" = 'ZUGFERD_COMFORT';
