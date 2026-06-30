/*
  Warnings:

  - You are about to drop the column `accommodationAddress` on the `Project` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'DRAWING';
ALTER TYPE "DocumentType" ADD VALUE 'WORK_CONTRACT';
ALTER TYPE "DocumentType" ADD VALUE 'SPECIFICATION';
ALTER TYPE "DocumentType" ADD VALUE 'SITE_PHOTO';
ALTER TYPE "DocumentType" ADD VALUE 'HANDOVER_PROTOCOL';

-- AlterTable
-- accommodationAddress wird nach accommodationAddressLine1 migriert (Datenerhalt),
-- daher zuerst die neuen Spalten anlegen, Wert kopieren und erst dann droppen.
ALTER TABLE "Project"
ADD COLUMN     "accommodationAddressLine1" TEXT,
ADD COLUMN     "accommodationAddressLine2" TEXT,
ADD COLUMN     "accommodationCity" TEXT,
ADD COLUMN     "accommodationCountry" TEXT,
ADD COLUMN     "accommodationLatitude" DOUBLE PRECISION,
ADD COLUMN     "accommodationLongitude" DOUBLE PRECISION,
ADD COLUMN     "accommodationMapsUrl" TEXT,
ADD COLUMN     "accommodationNotes" TEXT,
ADD COLUMN     "accommodationPostalCode" TEXT,
ADD COLUMN     "billingMode" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "overtimeRatePerHour" DOUBLE PRECISION,
ADD COLUMN     "siteAccessInfo" TEXT,
ADD COLUMN     "siteWorkingHours" TEXT,
ADD COLUMN     "weeklyPackageHours" DOUBLE PRECISION,
ADD COLUMN     "weeklyPackagePrice" DOUBLE PRECISION;

-- Bestehenden Unterkunfts-Adresswert übernehmen
UPDATE "Project" SET "accommodationAddressLine1" = "accommodationAddress" WHERE "accommodationAddress" IS NOT NULL;

-- Alte Spalte entfernen
ALTER TABLE "Project" DROP COLUMN "accommodationAddress";

-- AlterTable
ALTER TABLE "ProjectAssignment" ADD COLUMN     "isLead" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectSite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapsUrl" TEXT,
    "accessInfo" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEquipment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "serialNumber" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "issuedTo" TEXT,
    "condition" TEXT,
    "returnCondition" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProjectEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatusHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectSite" ADD CONSTRAINT "ProjectSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEquipment" ADD CONSTRAINT "ProjectEquipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
