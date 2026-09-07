-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN "workNotesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable ProjectWorkActivity
CREATE TABLE "ProjectWorkActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWorkActivity_pkey" PRIMARY KEY ("id")
);

-- AlterTable TimeEntry
ALTER TABLE "TimeEntry" ADD COLUMN "workNotes" TEXT,
ADD COLUMN "workDocumentedAt" TIMESTAMP(3);

-- Historische CLOCK_OUT: nicht als Pending behandeln
UPDATE "TimeEntry"
SET "workDocumentedAt" = "occurredAtServer"
WHERE "entryType" = 'CLOCK_OUT' AND "workDocumentedAt" IS NULL;

-- CreateTable TimeEntryWorkActivity
CREATE TABLE "TimeEntryWorkActivity" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "projectWorkActivityId" TEXT NOT NULL,

    CONSTRAINT "TimeEntryWorkActivity_pkey" PRIMARY KEY ("id")
);

-- AlterTable WeeklyTimesheetDay
ALTER TABLE "WeeklyTimesheetDay" ADD COLUMN "workNotes" TEXT;

-- CreateTable WeeklyTimesheetDayWorkActivity
CREATE TABLE "WeeklyTimesheetDayWorkActivity" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "projectWorkActivityId" TEXT NOT NULL,

    CONSTRAINT "WeeklyTimesheetDayWorkActivity_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ProjectWorkActivity_projectId_active_sortOrder_idx" ON "ProjectWorkActivity"("projectId", "active", "sortOrder");
CREATE INDEX "TimeEntry_workerId_entryType_workDocumentedAt_idx" ON "TimeEntry"("workerId", "entryType", "workDocumentedAt");
CREATE UNIQUE INDEX "TimeEntryWorkActivity_timeEntryId_projectWorkActivityId_key" ON "TimeEntryWorkActivity"("timeEntryId", "projectWorkActivityId");
CREATE INDEX "TimeEntryWorkActivity_projectWorkActivityId_idx" ON "TimeEntryWorkActivity"("projectWorkActivityId");
CREATE UNIQUE INDEX "WeeklyTimesheetDayWorkActivity_dayId_projectWorkActivityId_key" ON "WeeklyTimesheetDayWorkActivity"("dayId", "projectWorkActivityId");
CREATE INDEX "WeeklyTimesheetDayWorkActivity_projectWorkActivityId_idx" ON "WeeklyTimesheetDayWorkActivity"("projectWorkActivityId");

-- FKs
ALTER TABLE "ProjectWorkActivity" ADD CONSTRAINT "ProjectWorkActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntryWorkActivity" ADD CONSTRAINT "TimeEntryWorkActivity_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntryWorkActivity" ADD CONSTRAINT "TimeEntryWorkActivity_projectWorkActivityId_fkey" FOREIGN KEY ("projectWorkActivityId") REFERENCES "ProjectWorkActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyTimesheetDayWorkActivity" ADD CONSTRAINT "WeeklyTimesheetDayWorkActivity_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "WeeklyTimesheetDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyTimesheetDayWorkActivity" ADD CONSTRAINT "WeeklyTimesheetDayWorkActivity_projectWorkActivityId_fkey" FOREIGN KEY ("projectWorkActivityId") REFERENCES "ProjectWorkActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
