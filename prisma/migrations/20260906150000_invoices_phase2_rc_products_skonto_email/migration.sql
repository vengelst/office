-- CreateEnum
CREATE TYPE "InvoiceTaxKind" AS ENUM ('STANDARD', 'REDUCED', 'REVERSE_CHARGE', 'TAX_EXEMPT');

-- AlterTable Customer: VIES fields
ALTER TABLE "Customer" ADD COLUMN "vatIdValidatedAt" TIMESTAMP(3),
ADD COLUMN "vatIdValid" BOOLEAN,
ADD COLUMN "vatIdViesName" TEXT,
ADD COLUMN "vatIdViesRequestId" TEXT;

-- AlterTable Invoice: taxKind
ALTER TABLE "Invoice" ADD COLUMN "taxKind" "InvoiceTaxKind" NOT NULL DEFAULT 'STANDARD';

-- AlterTable InvoiceLine: product + discount
ALTER TABLE "InvoiceLine" ADD COLUMN "productId" TEXT,
ADD COLUMN "discountPercent" DOUBLE PRECISION,
ADD COLUMN "discountAmount" DOUBLE PRECISION;

-- AlterTable InvoicePayment: skonto
ALTER TABLE "InvoicePayment" ADD COLUMN "skontoApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "skontoAmount" DOUBLE PRECISION;

-- CreateTable InvoiceProduct
CREATE TABLE "InvoiceProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "defaultUnitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultTaxRate" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerProductPrice
CREATE TABLE "CustomerProductPrice" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CustomerProductPrice_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "InvoiceProduct_active_idx" ON "InvoiceProduct"("active");
CREATE INDEX "InvoiceProduct_name_idx" ON "InvoiceProduct"("name");
CREATE INDEX "CustomerProductPrice_customerId_idx" ON "CustomerProductPrice"("customerId");
CREATE INDEX "CustomerProductPrice_productId_idx" ON "CustomerProductPrice"("productId");
CREATE UNIQUE INDEX "CustomerProductPrice_customerId_productId_key" ON "CustomerProductPrice"("customerId", "productId");
CREATE INDEX "InvoiceLine_productId_idx" ON "InvoiceLine"("productId");
CREATE INDEX "InvoicePayment_skontoApplied_paidDate_idx" ON "InvoicePayment"("skontoApplied", "paidDate");

-- ForeignKeys
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InvoiceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InvoiceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
