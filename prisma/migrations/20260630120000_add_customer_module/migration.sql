-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'BUSINESS_CARD';
ALTER TYPE "DocumentType" ADD VALUE 'CONTRACT';
ALTER TYPE "DocumentType" ADD VALUE 'LOGO';
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'NOTE_DOCUMENT';

-- AlterTable: Customer – neue Felder hinzufügen (email/billingEmail folgen nach Datenmigration)
ALTER TABLE "Customer" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "paymentTermDays" INTEGER,
ADD COLUMN     "rating" TEXT,
ADD COLUMN     "taxNumber" TEXT;

-- AlterTable
ALTER TABLE "CustomerBranch" ADD COLUMN     "branchType" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mapsUrl" TEXT;

-- AlterTable
ALTER TABLE "CustomerContact" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "preferredContactMethod" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "CustomerEmail" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBankAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "accountHolder" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "CustomerBankAccount_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerEmail" ADD CONSTRAINT "CustomerEmail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBankAccount" ADD CONSTRAINT "CustomerBankAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- Datenmigration: bestehende E-Mail-Felder nach CustomerEmail überführen
-- (vor dem Droppen der Spalten ausführen!)
-- ──────────────────────────────────────────────────────────────
INSERT INTO "CustomerEmail" ("id", "customerId", "email", "emailType", "isPrimary")
SELECT gen_random_uuid()::text, "id", "email", 'GENERAL', true
FROM "Customer"
WHERE "email" IS NOT NULL AND "email" <> '';

INSERT INTO "CustomerEmail" ("id", "customerId", "email", "emailType", "isPrimary")
SELECT gen_random_uuid()::text, "id", "billingEmail", 'BILLING', false
FROM "Customer"
WHERE "billingEmail" IS NOT NULL AND "billingEmail" <> '';

-- AlterTable: alte E-Mail-Spalten nach erfolgter Migration entfernen
ALTER TABLE "Customer" DROP COLUMN "billingEmail",
DROP COLUMN "email";
