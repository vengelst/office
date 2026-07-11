-- Performance-Indizes für häufig gefilterte Felder

-- Customer
CREATE INDEX "Customer_status_deletedAt_idx" ON "Customer"("status", "deletedAt");
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- Project
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX "Project_status_deletedAt_idx" ON "Project"("status", "deletedAt");
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- Worker
CREATE INDEX "Worker_deletedAt_idx" ON "Worker"("deletedAt");
CREATE INDEX "Worker_subcontractorId_idx" ON "Worker"("subcontractorId");
CREATE INDEX "Worker_active_deletedAt_idx" ON "Worker"("active", "deletedAt");

-- Session
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- Document
CREATE INDEX "Document_isLatest_idx" ON "Document"("isLatest");
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- DocumentLink
CREATE INDEX "DocumentLink_entityType_entityId_idx" ON "DocumentLink"("entityType", "entityId");
CREATE INDEX "DocumentLink_documentId_idx" ON "DocumentLink"("documentId");

-- TimeEntry
CREATE INDEX "TimeEntry_workerId_projectId_idx" ON "TimeEntry"("workerId", "projectId");
CREATE INDEX "TimeEntry_occurredAtClient_idx" ON "TimeEntry"("occurredAtClient");

-- Invoice
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");
CREATE INDEX "Invoice_subcontractorId_idx" ON "Invoice"("subcontractorId");
CREATE INDEX "Invoice_invoiceType_status_idx" ON "Invoice"("invoiceType", "status");
