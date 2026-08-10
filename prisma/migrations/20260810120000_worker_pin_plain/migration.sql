-- Stempel-PIN in Klartext speichern, damit Office sie am Monteur wieder anzeigen kann.
-- Login bleibt über pinHash (bcrypt).
ALTER TABLE "WorkerPin" ADD COLUMN "pinPlain" TEXT;
