-- Typ-Feld für Subunternehmen (Subunternehmer / Lieferant)
CREATE TYPE "SubcontractorType" AS ENUM ('SUBCONTRACTOR', 'SUPPLIER');
ALTER TABLE "Subcontractor" ADD COLUMN "subcontractorType" "SubcontractorType" NOT NULL DEFAULT 'SUBCONTRACTOR';
