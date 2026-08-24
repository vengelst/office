-- Master-Tätigkeitsbereiche: Katalog, Segmente, Stundenzettel-Aufschlüsselung
CREATE TABLE "ActivityType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityType_code_key" ON "ActivityType"("code");
CREATE INDEX "ActivityType_active_sortOrder_idx" ON "ActivityType"("active", "sortOrder");

CREATE TABLE "TimeActivitySegment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeActivitySegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeActivitySegment_workerId_startedAt_idx" ON "TimeActivitySegment"("workerId", "startedAt");
CREATE INDEX "TimeActivitySegment_workerId_endedAt_idx" ON "TimeActivitySegment"("workerId", "endedAt");
CREATE INDEX "TimeActivitySegment_projectId_startedAt_idx" ON "TimeActivitySegment"("projectId", "startedAt");
CREATE INDEX "TimeActivitySegment_activityTypeId_idx" ON "TimeActivitySegment"("activityTypeId");

ALTER TABLE "TimeActivitySegment" ADD CONSTRAINT "TimeActivitySegment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeActivitySegment" ADD CONSTRAINT "TimeActivitySegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeActivitySegment" ADD CONSTRAINT "TimeActivitySegment_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WeeklyTimesheetDayActivity" (
    "id" TEXT NOT NULL,
    "weeklyTimesheetDayId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "WeeklyTimesheetDayActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyTimesheetDayActivity_weeklyTimesheetDayId_activityTypeId_key" ON "WeeklyTimesheetDayActivity"("weeklyTimesheetDayId", "activityTypeId");
CREATE INDEX "WeeklyTimesheetDayActivity_activityTypeId_idx" ON "WeeklyTimesheetDayActivity"("activityTypeId");

ALTER TABLE "WeeklyTimesheetDayActivity" ADD CONSTRAINT "WeeklyTimesheetDayActivity_weeklyTimesheetDayId_fkey" FOREIGN KEY ("weeklyTimesheetDayId") REFERENCES "WeeklyTimesheetDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyTimesheetDayActivity" ADD CONSTRAINT "WeeklyTimesheetDayActivity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed-Katalog
INSERT INTO "ActivityType" ("id", "code", "name", "sortOrder", "active", "billable", "createdAt", "updatedAt") VALUES
  ('act_anfahrt', 'ANFAHRT', 'Anfahrt', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('act_abfahrt', 'ABFAHRT', 'Abfahrt', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('act_besprechung', 'BESPRECHUNG', 'Besprechung', 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('act_montage', 'MONTAGE', 'Montagetätigkeit', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('act_training', 'TRAINING', 'Training', 50, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
