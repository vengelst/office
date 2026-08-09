-- CreateEnum
CREATE TYPE "BackupJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "RestoreLogStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleHour" INTEGER NOT NULL DEFAULT 2,
    "scheduleMinute" INTEGER NOT NULL DEFAULT 0,
    "retentionDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "status" "BackupJobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "filePath" TEXT,
    "fileSize" BIGINT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreLog" (
    "id" TEXT NOT NULL,
    "backupJobId" TEXT,
    "status" "RestoreLogStatus" NOT NULL DEFAULT 'PENDING',
    "modules" JSONB NOT NULL,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupJob_status_createdAt_idx" ON "BackupJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BackupJob_createdAt_idx" ON "BackupJob"("createdAt");

-- CreateIndex
CREATE INDEX "RestoreLog_createdAt_idx" ON "RestoreLog"("createdAt");

-- CreateIndex
CREATE INDEX "RestoreLog_backupJobId_idx" ON "RestoreLog"("backupJobId");

-- AddForeignKey
ALTER TABLE "RestoreLog" ADD CONSTRAINT "RestoreLog_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "BackupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
