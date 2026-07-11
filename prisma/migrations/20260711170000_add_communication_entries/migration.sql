-- CreateEnum
CREATE TYPE "CommunicationEntityType" AS ENUM ('CUSTOMER', 'SUBCONTRACTOR', 'WORKER');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('PHONE_CALL', 'EMAIL', 'MEETING', 'NOTE', 'INSTRUCTION');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateTable
CREATE TABLE "CommunicationEntry" (
    "id" TEXT NOT NULL,
    "entityType" "CommunicationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "contactId" TEXT,
    "type" "CommunicationType" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTGOING',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationEntry_entityType_entityId_occurredAt_idx" ON "CommunicationEntry"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationEntry_contactId_occurredAt_idx" ON "CommunicationEntry"("contactId", "occurredAt");
