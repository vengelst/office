-- CreateEnum
CREATE TYPE "EInvoicePreference" AS ENUM ('ZUGFERD_COMFORT', 'XRECHNUNG', 'BOTH', 'NONE');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "leitwegId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "eInvoicePreference" "EInvoicePreference" NOT NULL DEFAULT 'BOTH';
