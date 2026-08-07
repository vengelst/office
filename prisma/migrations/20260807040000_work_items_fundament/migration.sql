-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'REVIEW', 'REWORK', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkItemReportType" AS ENUM ('COMPLETED', 'REWORK');

-- CreateEnum
CREATE TYPE "WorkItemReviewAction" AS ENUM ('APPROVE', 'FORCE_COMPLETE');

-- AlterEnum
ALTER TYPE "RoleCode" ADD VALUE 'CUSTOMER_PL';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "itemBased" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectBlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "name" TEXT,
    "pdfDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT,
    "itemKey" TEXT NOT NULL,
    "title" TEXT,
    "floor" TEXT,
    "area" TEXT,
    "room" TEXT,
    "type" TEXT,
    "rc" TEXT,
    "detail" TEXT,
    "planPage" INTEGER,
    "sheetNo" INTEGER,
    "sheetTotal" INTEGER,
    "pdfFile" TEXT,
    "pdfPage" INTEGER,
    "workScopeDe" TEXT,
    "workScopeSk" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemMaterial" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "qty" TEXT,
    "qtyUnit" TEXT,
    "materialDe" TEXT NOT NULL,
    "materialSk" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCustomerPlAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCustomerPlAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemAssignment" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemSession" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkItemSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemReport" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "WorkItemReportType" NOT NULL,
    "comment" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemReview" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "action" "WorkItemReviewAction" NOT NULL,
    "comment" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBlock_projectId_idx" ON "ProjectBlock"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBlock_projectId_blockKey_key" ON "ProjectBlock"("projectId", "blockKey");

-- CreateIndex
CREATE INDEX "WorkItem_projectId_status_idx" ON "WorkItem"("projectId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_blockId_idx" ON "WorkItem"("blockId");

-- CreateIndex
CREATE INDEX "WorkItem_itemKey_idx" ON "WorkItem"("itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_projectId_itemKey_key" ON "WorkItem"("projectId", "itemKey");

-- CreateIndex
CREATE INDEX "WorkItemMaterial_workItemId_idx" ON "WorkItemMaterial"("workItemId");

-- CreateIndex
CREATE INDEX "ProjectCustomerPlAssignment_userId_active_idx" ON "ProjectCustomerPlAssignment"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCustomerPlAssignment_projectId_userId_key" ON "ProjectCustomerPlAssignment"("projectId", "userId");

-- CreateIndex
CREATE INDEX "WorkItemAssignment_workItemId_active_idx" ON "WorkItemAssignment"("workItemId", "active");

-- CreateIndex
CREATE INDEX "WorkItemAssignment_workerId_active_idx" ON "WorkItemAssignment"("workerId", "active");

-- CreateIndex
CREATE INDEX "WorkItemSession_workItemId_workerId_idx" ON "WorkItemSession"("workItemId", "workerId");

-- CreateIndex
CREATE INDEX "WorkItemSession_workerId_endedAt_idx" ON "WorkItemSession"("workerId", "endedAt");

-- CreateIndex
CREATE INDEX "WorkItemReport_workItemId_reportedAt_idx" ON "WorkItemReport"("workItemId", "reportedAt");

-- CreateIndex
CREATE INDEX "WorkItemReport_workerId_idx" ON "WorkItemReport"("workerId");

-- CreateIndex
CREATE INDEX "WorkItemReview_workItemId_reviewedAt_idx" ON "WorkItemReview"("workItemId", "reviewedAt");

-- CreateIndex
CREATE INDEX "WorkItemReview_reviewerUserId_idx" ON "WorkItemReview"("reviewerUserId");

-- AddForeignKey
ALTER TABLE "ProjectBlock" ADD CONSTRAINT "ProjectBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProjectBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemMaterial" ADD CONSTRAINT "WorkItemMaterial_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomerPlAssignment" ADD CONSTRAINT "ProjectCustomerPlAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomerPlAssignment" ADD CONSTRAINT "ProjectCustomerPlAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignment" ADD CONSTRAINT "WorkItemAssignment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignment" ADD CONSTRAINT "WorkItemAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemSession" ADD CONSTRAINT "WorkItemSession_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemSession" ADD CONSTRAINT "WorkItemSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReport" ADD CONSTRAINT "WorkItemReport_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReport" ADD CONSTRAINT "WorkItemReport_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReview" ADD CONSTRAINT "WorkItemReview_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReview" ADD CONSTRAINT "WorkItemReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

