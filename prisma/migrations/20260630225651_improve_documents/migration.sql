-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'REGISTRATION_DOC';
ALTER TYPE "DocumentType" ADD VALUE 'INSURANCE_DOC';
ALTER TYPE "DocumentType" ADD VALUE 'INSPECTION_DOC';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "replacesId" TEXT,
ADD COLUMN     "storagePath" TEXT,
ADD COLUMN     "tags" TEXT,
ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "uploadSource" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "DocumentLink" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolder_entityType_entityId_name_parentId_key" ON "DocumentFolder"("entityType", "entityId", "name", "parentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
