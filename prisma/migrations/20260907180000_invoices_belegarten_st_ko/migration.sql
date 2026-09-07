-- Belegarten RE/ST/KO: CREDIT_NOTE/GS ersetzen, Steuer je Satz, PARTIALLY_CORRECTED.
-- Testdaten: destruktive Migration erlaubt (CREDIT_NOTE/GS-Belege löschen).

-- 1) Alte Gutschriften (Testdaten) entfernen
DELETE FROM "InvoicePayment"
WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "invoiceType"::text = 'CREDIT_NOTE');

DELETE FROM "InvoiceLine"
WHERE "invoiceId" IN (SELECT id FROM "Invoice" WHERE "invoiceType"::text = 'CREDIT_NOTE');

DELETE FROM "Invoice"
WHERE "invoiceType"::text = 'CREDIT_NOTE';

-- 2) InvoiceType: CREDIT_NOTE → STORNO + CORRECTION
CREATE TYPE "InvoiceType_new" AS ENUM ('OUTGOING', 'INCOMING', 'STORNO', 'CORRECTION');

ALTER TABLE "Invoice"
  ALTER COLUMN "invoiceType" TYPE "InvoiceType_new"
  USING ("invoiceType"::text::"InvoiceType_new");

DROP TYPE "InvoiceType";
ALTER TYPE "InvoiceType_new" RENAME TO "InvoiceType";

-- 3) InvoiceSeriesCode: CREDIT_NOTE → STORNO + CORRECTION
CREATE TYPE "InvoiceSeriesCode_new" AS ENUM ('OUTGOING', 'STORNO', 'CORRECTION');

DELETE FROM "InvoiceNumberSeries" WHERE "code"::text = 'CREDIT_NOTE';

ALTER TABLE "InvoiceNumberSeries"
  ALTER COLUMN "code" TYPE "InvoiceSeriesCode_new"
  USING ("code"::text::"InvoiceSeriesCode_new");

DROP TYPE "InvoiceSeriesCode";
ALTER TYPE "InvoiceSeriesCode_new" RENAME TO "InvoiceSeriesCode";

INSERT INTO "InvoiceNumberSeries" ("id", "code", "prefix", "nextNumber", "updatedAt")
SELECT gen_random_uuid()::text, 'STORNO'::"InvoiceSeriesCode", 'ST', 40000001, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "InvoiceNumberSeries" WHERE "code" = 'STORNO'::"InvoiceSeriesCode"
);

INSERT INTO "InvoiceNumberSeries" ("id", "code", "prefix", "nextNumber", "updatedAt")
SELECT gen_random_uuid()::text, 'CORRECTION'::"InvoiceSeriesCode", 'KO', 40000001, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "InvoiceNumberSeries" WHERE "code" = 'CORRECTION'::"InvoiceSeriesCode"
);

-- 4) Status PARTIALLY_CORRECTED
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_CORRECTED';

-- 5) CorrectionReason enum + neue Invoice-Felder
CREATE TYPE "CorrectionReason" AS ENUM ('INVOICE_ERROR', 'CONSIDERATION_REDUCTION');

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "correctionReason" "CorrectionReason";
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxPeriodFrom" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxPeriodTo" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxBreakdown" JSONB;

-- 6) Optionaler Steuersatz pro Position
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION;
