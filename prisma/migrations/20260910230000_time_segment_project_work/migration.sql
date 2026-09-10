-- Projekt-Arbeit an Zeitsegmenten + activityTypeId optional
ALTER TABLE "TimeActivitySegment" ADD COLUMN "projectWorkActivityId" TEXT;
ALTER TABLE "TimeActivitySegment" ALTER COLUMN "activityTypeId" DROP NOT NULL;

CREATE INDEX "TimeActivitySegment_projectWorkActivityId_idx" ON "TimeActivitySegment"("projectWorkActivityId");

ALTER TABLE "TimeActivitySegment" ADD CONSTRAINT "TimeActivitySegment_projectWorkActivityId_fkey" FOREIGN KEY ("projectWorkActivityId") REFERENCES "ProjectWorkActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
