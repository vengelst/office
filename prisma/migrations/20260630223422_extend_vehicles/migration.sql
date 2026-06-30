-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "category" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "fuelType" TEXT,
ADD COLUMN     "insuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "nextInspection" TIMESTAMP(3),
ADD COLUMN     "ownerType" TEXT,
ADD COLUMN     "registrationDoc" TEXT,
ADD COLUMN     "subcontractorId" TEXT,
ADD COLUMN     "vin" TEXT,
ADD COLUMN     "year" INTEGER;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
