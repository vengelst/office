-- Kiosk-Zugang pro Monteur (PIN an work.vivahome.de)
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "kioskAccessEnabled" BOOLEAN NOT NULL DEFAULT true;
