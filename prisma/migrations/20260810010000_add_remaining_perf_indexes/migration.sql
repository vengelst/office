-- Ergänzung zu 20260810000000: AuditLog, Document.expiryDate, TimeEntry/GpsEvent/Assignment-Komposits

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

CREATE INDEX "TimeEntry_workerId_entryType_occurredAtClient_idx" ON "TimeEntry"("workerId", "entryType", "occurredAtClient");

CREATE INDEX "GpsEvent_workerId_recordedAt_idx" ON "GpsEvent"("workerId", "recordedAt");
CREATE INDEX "GpsEvent_projectId_recordedAt_idx" ON "GpsEvent"("projectId", "recordedAt");
CREATE INDEX "GpsEvent_relatedTimeEntryId_idx" ON "GpsEvent"("relatedTimeEntryId");

CREATE INDEX "ProjectAssignment_workerId_active_idx" ON "ProjectAssignment"("workerId", "active");
CREATE INDEX "ProjectAssignment_workerId_startDate_endDate_idx" ON "ProjectAssignment"("workerId", "startDate", "endDate");

CREATE INDEX "WeeklyTimesheet_workerId_status_idx" ON "WeeklyTimesheet"("workerId", "status");

CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
