-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TodoEntityType" AS ENUM ('CUSTOMER', 'PROJECT', 'WORKER', 'SUBCONTRACTOR', 'EQUIPMENT');

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT,
    "linkedEntityType" "TodoEntityType",
    "linkedEntityId" TEXT,
    "linkedEntityName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Todo_status_assignedToId_dueDate_idx" ON "Todo"("status", "assignedToId", "dueDate");

-- CreateIndex
CREATE INDEX "Todo_linkedEntityType_linkedEntityId_idx" ON "Todo"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "Todo_createdById_idx" ON "Todo"("createdById");
