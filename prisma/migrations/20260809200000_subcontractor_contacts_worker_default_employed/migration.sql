-- AlterTable: Worker default type EMPLOYED
ALTER TABLE "Worker" ALTER COLUMN "workerType" SET DEFAULT 'EMPLOYED';

-- CreateTable: SubcontractorContact
CREATE TABLE "SubcontractorContact" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phoneMobile" TEXT,
    "phoneLandline" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubcontractorContact_subcontractorId_idx" ON "SubcontractorContact"("subcontractorId");

-- AddForeignKey
ALTER TABLE "SubcontractorContact" ADD CONSTRAINT "SubcontractorContact_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
