-- CreateEnum
CREATE TYPE "FeeEntryType" AS ENUM ('time', 'unitary', 'disbursement');

-- CreateTable
CREATE TABLE "fee_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "entry_type" "FeeEntryType" NOT NULL,
    "entry_date" DATE NOT NULL,
    "narration" TEXT NOT NULL,
    "duration_minutes_raw" INTEGER,
    "duration_minutes_billed" INTEGER,
    "unit_quantity_thousandths" INTEGER,
    "rate_cents" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "is_invoiced" BOOLEAN NOT NULL DEFAULT false,
    "receipt_file_name" TEXT,
    "receipt_file_path" TEXT,
    "posting_code_id" TEXT,
    "fee_earner_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_entries_matter_id_idx" ON "fee_entries"("matter_id");

-- CreateIndex
CREATE INDEX "fee_entries_fee_earner_id_idx" ON "fee_entries"("fee_earner_id");

-- CreateIndex
CREATE INDEX "fee_entries_entry_date_idx" ON "fee_entries"("entry_date");

-- AddForeignKey
ALTER TABLE "matter_notes" ADD CONSTRAINT "matter_notes_fee_entry_id_fkey" FOREIGN KEY ("fee_entry_id") REFERENCES "fee_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_entries" ADD CONSTRAINT "fee_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_entries" ADD CONSTRAINT "fee_entries_posting_code_id_fkey" FOREIGN KEY ("posting_code_id") REFERENCES "posting_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_entries" ADD CONSTRAINT "fee_entries_fee_earner_id_fkey" FOREIGN KEY ("fee_earner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_entries" ADD CONSTRAINT "fee_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
