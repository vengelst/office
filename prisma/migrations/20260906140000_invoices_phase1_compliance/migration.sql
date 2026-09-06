-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'CREDIT_NOTE';

-- CreateEnum
CREATE TYPE "InvoiceSeriesCode" AS ENUM ('OUTGOING', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "creditedInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "performanceCountryCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "finalizedByUserId" TEXT;

-- CreateTable
CREATE TABLE "InvoiceNumberSeries" (
    "id" TEXT NOT NULL,
    "code" "InvoiceSeriesCode" NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceNumberSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceNumberSeries_code_key" ON "InvoiceNumberSeries"("code");
CREATE INDEX "Invoice_creditedInvoiceId_idx" ON "Invoice"("creditedInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditedInvoiceId_fkey" FOREIGN KEY ("creditedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed Nummernkreise: RE ab 40000113, GS ab 40000001
INSERT INTO "InvoiceNumberSeries" ("id", "code", "prefix", "nextNumber", "updatedAt")
VALUES
  ('invseries_outgoing', 'OUTGOING', 'RE', 40000113, CURRENT_TIMESTAMP),
  ('invseries_credit', 'CREDIT_NOTE', 'GS', 40000001, CURRENT_TIMESTAMP);

-- Seed Verrechnung-Settings
INSERT INTO "AppSetting" ("id", "key", "value", "updatedAt")
VALUES (
  'appsetting_billing',
  'billing_settings',
  '{"defaultPaymentTermDays":14,"paymentTermOptions":[7,14,30,60],"skonto":{"percent":2,"days":10,"pdfHintTemplate":"Bei Zahlung innerhalb von {{skontoDays}} Tagen gewähren wir {{skontoPercent}} % Skonto ({{skontoAmount}}). Zahlungsziel ohne Abzug: {{dueDate}}. Rechnungs-Nr. {{invoiceNumber}} – {{companyName}}."},"performanceCountries":[{"countryCode":"DE","name":"Deutschland","standardRate":19,"reducedRate":7},{"countryCode":"LU","name":"Luxemburg","standardRate":17,"reducedRate":8},{"countryCode":"NL","name":"Niederlande","standardRate":21,"reducedRate":9},{"countryCode":"FR","name":"Frankreich","standardRate":20,"reducedRate":5.5}]}',
  CURRENT_TIMESTAMP
);
