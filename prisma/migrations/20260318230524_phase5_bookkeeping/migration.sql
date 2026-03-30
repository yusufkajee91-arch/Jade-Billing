-- CreateEnum
CREATE TYPE "TrustEntryType" AS ENUM ('trust_receipt', 'trust_payment', 'trust_transfer_in', 'trust_transfer_out', 'collection_receipt');

-- CreateEnum
CREATE TYPE "BusinessEntryType" AS ENUM ('matter_receipt', 'matter_payment', 'business_receipt', 'business_payment', 'supplier_invoice', 'supplier_payment', 'bank_transfer', 'trust_to_business');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "tel" TEXT,
    "vat_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "entry_type" "TrustEntryType" NOT NULL,
    "entry_date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "reference_number" TEXT,
    "cheque_number" TEXT,
    "supplier_id" TEXT,
    "linked_entry_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT,
    "entry_type" "BusinessEntryType" NOT NULL,
    "entry_date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "reference_number" TEXT,
    "supplier_id" TEXT,
    "linked_trust_entry_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trust_entries_linked_entry_id_key" ON "trust_entries"("linked_entry_id");

-- CreateIndex
CREATE INDEX "trust_entries_matter_id_idx" ON "trust_entries"("matter_id");

-- CreateIndex
CREATE INDEX "trust_entries_entry_date_idx" ON "trust_entries"("entry_date");

-- CreateIndex
CREATE INDEX "business_entries_matter_id_idx" ON "business_entries"("matter_id");

-- CreateIndex
CREATE INDEX "business_entries_entry_date_idx" ON "business_entries"("entry_date");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_entries" ADD CONSTRAINT "trust_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_entries" ADD CONSTRAINT "trust_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_entries" ADD CONSTRAINT "trust_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_entries" ADD CONSTRAINT "trust_entries_linked_entry_id_fkey" FOREIGN KEY ("linked_entry_id") REFERENCES "trust_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_entries" ADD CONSTRAINT "business_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_entries" ADD CONSTRAINT "business_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_entries" ADD CONSTRAINT "business_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
