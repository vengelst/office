-- Query-Indexes für häufig gefilterte FK-/Status-/Datumsfelder
-- Ergänzung zu 20260711091500_add_performance_indexes

-- Customer-Unterentitäten
CREATE INDEX "CustomerBranch_customerId_idx" ON "CustomerBranch"("customerId");
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");
CREATE INDEX "CustomerContact_branchId_idx" ON "CustomerContact"("branchId");
CREATE INDEX "CustomerEmail_customerId_idx" ON "CustomerEmail"("customerId");
CREATE INDEX "CustomerBankAccount_customerId_idx" ON "CustomerBankAccount"("customerId");
CREATE INDEX "CustomerNote_customerId_idx" ON "CustomerNote"("customerId");
CREATE INDEX "CustomerCallLog_customerId_idx" ON "CustomerCallLog"("customerId");
CREATE INDEX "CustomerCallLog_contactId_idx" ON "CustomerCallLog"("contactId");

-- Project-Unterentitäten
CREATE INDEX "ProjectSite_projectId_idx" ON "ProjectSite"("projectId");
CREATE INDEX "ProjectEquipment_projectId_idx" ON "ProjectEquipment"("projectId");
CREATE INDEX "ProjectStatusHistory_projectId_idx" ON "ProjectStatusHistory"("projectId");
CREATE INDEX "ProjectNote_projectId_idx" ON "ProjectNote"("projectId");
CREATE INDEX "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");
CREATE INDEX "ProjectAssignment_workerId_idx" ON "ProjectAssignment"("workerId");
CREATE INDEX "ProjectAssignment_projectId_active_idx" ON "ProjectAssignment"("projectId", "active");
CREATE INDEX "ProjectEmailRecipient_projectId_idx" ON "ProjectEmailRecipient"("projectId");

-- Subcontractor / Worker / PIN
CREATE INDEX "Subcontractor_active_idx" ON "Subcontractor"("active");
CREATE INDEX "Subcontractor_deletedAt_idx" ON "Subcontractor"("deletedAt");
CREATE INDEX "Subcontractor_active_deletedAt_idx" ON "Subcontractor"("active", "deletedAt");
CREATE INDEX "WorkerPin_workerId_idx" ON "WorkerPin"("workerId");
CREATE INDEX "WorkerPin_workerId_isActive_idx" ON "WorkerPin"("workerId", "isActive");
CREATE INDEX "UserPin_userId_idx" ON "UserPin"("userId");
CREATE INDEX "UserPin_userId_isActive_idx" ON "UserPin"("userId", "isActive");
CREATE INDEX "WorkerLanguage_workerId_idx" ON "WorkerLanguage"("workerId");
CREATE INDEX "WorkerCertification_workerId_idx" ON "WorkerCertification"("workerId");
CREATE INDEX "WorkerTeamMember_workerId_idx" ON "WorkerTeamMember"("workerId");
CREATE INDEX "WorkerTeamMember_teamId_idx" ON "WorkerTeamMember"("teamId");

-- Vehicles
CREATE INDEX "Vehicle_active_idx" ON "Vehicle"("active");
CREATE INDEX "Vehicle_subcontractorId_idx" ON "Vehicle"("subcontractorId");
CREATE INDEX "WorkerVehicleAssignment_workerId_idx" ON "WorkerVehicleAssignment"("workerId");
CREATE INDEX "WorkerVehicleAssignment_vehicleId_idx" ON "WorkerVehicleAssignment"("vehicleId");

-- Time tracking
CREATE INDEX "GpsEvent_workerId_idx" ON "GpsEvent"("workerId");
CREATE INDEX "GpsEvent_recordedAt_idx" ON "GpsEvent"("recordedAt");
CREATE INDEX "BreakRule_projectId_idx" ON "BreakRule"("projectId");
CREATE INDEX "BreakRule_active_idx" ON "BreakRule"("active");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX "WeeklyTimesheet_status_idx" ON "WeeklyTimesheet"("status");
CREATE INDEX "WeeklyTimesheet_projectId_idx" ON "WeeklyTimesheet"("projectId");
CREATE INDEX "WeeklyTimesheet_status_projectId_idx" ON "WeeklyTimesheet"("status", "projectId");
CREATE INDEX "WeeklyTimesheetDay_weeklyTimesheetId_idx" ON "WeeklyTimesheetDay"("weeklyTimesheetId");
CREATE INDEX "WeeklyTimesheetSignature_weeklyTimesheetId_idx" ON "WeeklyTimesheetSignature"("weeklyTimesheetId");

-- Invoices
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- Email
CREATE INDEX "EmailLog_relatedEntityType_relatedEntityId_idx" ON "EmailLog"("relatedEntityType", "relatedEntityId");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
