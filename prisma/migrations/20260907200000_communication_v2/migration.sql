-- AlterEnum
ALTER TYPE "CommunicationType" ADD VALUE 'WHATSAPP';

-- AlterTable Todo
ALTER TABLE "Todo" ADD COLUMN "communicationEntryId" TEXT;

-- AlterTable CalendarEvent
ALTER TABLE "CalendarEvent" ADD COLUMN "communicationEntryId" TEXT;

-- CreateIndex
CREATE INDEX "Todo_communicationEntryId_idx" ON "Todo"("communicationEntryId");

-- CreateIndex
CREATE INDEX "CalendarEvent_communicationEntryId_idx" ON "CalendarEvent"("communicationEntryId");

-- CreateIndex
CREATE INDEX "CommunicationEntry_occurredAt_idx" ON "CommunicationEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationEntry_createdBy_occurredAt_idx" ON "CommunicationEntry"("createdBy", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationEntry_type_occurredAt_idx" ON "CommunicationEntry"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_communicationEntryId_fkey" FOREIGN KEY ("communicationEntryId") REFERENCES "CommunicationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_communicationEntryId_fkey" FOREIGN KEY ("communicationEntryId") REFERENCES "CommunicationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Best-effort: CustomerCallLog → CommunicationEntry (einmalig, idempotent über feste IDs)
INSERT INTO "CommunicationEntry" (
  "id",
  "entityType",
  "entityId",
  "contactId",
  "type",
  "direction",
  "subject",
  "content",
  "occurredAt",
  "duration",
  "createdBy",
  "createdAt",
  "updatedAt"
)
SELECT
  'migrated-call-' || c."id",
  'CUSTOMER'::"CommunicationEntityType",
  c."customerId",
  c."contactId",
  'PHONE_CALL'::"CommunicationType",
  CASE
    WHEN UPPER(c."direction") IN ('INCOMING', 'EINGEHEND', 'IN') THEN 'INCOMING'::"CommunicationDirection"
    ELSE 'OUTGOING'::"CommunicationDirection"
  END,
  NULLIF(TRIM(c."subject"), ''),
  COALESCE(
    NULLIF(
      TRIM(
        CONCAT_WS(
          E'\n',
          NULLIF(TRIM(c."summary"), ''),
          CASE
            WHEN c."nextAction" IS NOT NULL AND TRIM(c."nextAction") <> ''
              THEN 'Nächste Aktion: ' || TRIM(c."nextAction")
            ELSE NULL
          END
        )
      ),
      ''
    ),
    COALESCE(NULLIF(TRIM(c."subject"), ''), 'Telefonat (migriert)')
  ),
  c."callDate",
  NULL,
  c."createdByUserId",
  c."createdAt",
  c."createdAt"
FROM "CustomerCallLog" c
WHERE NOT EXISTS (
  SELECT 1 FROM "CommunicationEntry" e WHERE e."id" = 'migrated-call-' || c."id"
);
