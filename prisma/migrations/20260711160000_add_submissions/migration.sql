-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "source" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SubmissionPriority" NOT NULL DEFAULT 'MEDIUM',
    "deadline" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "value" DECIMAL(12,2),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "requirements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_customerId_status_deletedAt_idx" ON "Submission"("customerId", "status", "deletedAt");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
