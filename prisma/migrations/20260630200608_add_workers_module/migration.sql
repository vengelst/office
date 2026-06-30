-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('EMPLOYED', 'SUBCONTRACTED');

-- CreateEnum
CREATE TYPE "WorkerAvailability" AS ENUM ('AVAILABLE', 'ON_PROJECT', 'SICK', 'VACATION', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'PASSPORT';
ALTER TYPE "DocumentType" ADD VALUE 'ID_CARD';
ALTER TYPE "DocumentType" ADD VALUE 'WORK_PERMIT';
ALTER TYPE "DocumentType" ADD VALUE 'RESIDENCE_PERMIT';
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICATION';
ALTER TYPE "DocumentType" ADD VALUE 'HEALTH_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'WORKER_PHOTO';

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "availability" "WorkerAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "clothingSize" TEXT,
ADD COLUMN     "contractEnd" TIMESTAMP(3),
ADD COLUMN     "contractStart" TIMESTAMP(3),
ADD COLUMN     "dailyRate" DOUBLE PRECISION,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "oib" TEXT,
ADD COLUMN     "passportExpiry" TIMESTAMP(3),
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "phoneSecondary" TEXT,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "residencePermitExpiry" TIMESTAMP(3),
ADD COLUMN     "residencePermitNumber" TEXT,
ADD COLUMN     "shoeSize" TEXT,
ADD COLUMN     "socialSecurityNumber" TEXT,
ADD COLUMN     "subcontractorId" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "workPermitExpiry" TIMESTAMP(3),
ADD COLUMN     "workPermitNumber" TEXT,
ADD COLUMN     "workerType" "WorkerType" NOT NULL DEFAULT 'SUBCONTRACTED';

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapsUrl" TEXT,
    "taxNumber" TEXT,
    "vatId" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankName" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerLanguage" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" "LanguageProficiency" NOT NULL,

    CONSTRAINT "WorkerLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerCertification" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkerCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaderId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "role" TEXT,

    CONSTRAINT "WorkerTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerLanguage_workerId_language_key" ON "WorkerLanguage"("workerId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerTeamMember_teamId_workerId_leftAt_key" ON "WorkerTeamMember"("teamId", "workerId", "leftAt");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerLanguage" ADD CONSTRAINT "WorkerLanguage_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCertification" ADD CONSTRAINT "WorkerCertification_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerTeamMember" ADD CONSTRAINT "WorkerTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkerTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerTeamMember" ADD CONSTRAINT "WorkerTeamMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
