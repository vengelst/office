-- Master-Monteur: Clock-In auf jedes Projekt ohne Projektzuweisung
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "masterEngineer" BOOLEAN NOT NULL DEFAULT false;
