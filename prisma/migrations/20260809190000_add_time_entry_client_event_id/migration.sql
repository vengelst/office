-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "clientEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_clientEventId_key" ON "TimeEntry"("clientEventId");
