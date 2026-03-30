-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('pro_forma', 'invoice');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft_pro_forma', 'sent_pro_forma', 'draft_invoice', 'sent_invoice', 'paid');

-- AlterTable
ALTER TABLE "firm_settings" ADD COLUMN     "smtp_from_email" TEXT,
ADD COLUMN     "smtp_from_name" TEXT,
ADD COLUMN     "smtp_host" TEXT,
ADD COLUMN     "smtp_password" TEXT,
ADD COLUMN     "smtp_port" INTEGER NOT NULL DEFAULT 587,
ADD COLUMN     "smtp_user" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft_pro_forma',
    "matter_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "matter_code" TEXT NOT NULL,
    "matter_description" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT,
    "firm_name" TEXT NOT NULL,
    "firm_address" TEXT,
    "firm_tel" TEXT,
    "firm_email" TEXT,
    "firm_website" TEXT,
    "vat_registered" BOOLEAN NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "vat_reg_number" TEXT,
    "trust_bank_name" TEXT,
    "trust_bank_account_name" TEXT,
    "trust_bank_account_number" TEXT,
    "trust_bank_branch_code" TEXT,
    "trust_bank_swift" TEXT,
    "invoice_payment_instructions" TEXT,
    "sub_total_cents" INTEGER NOT NULL,
    "vat_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "invoice_date" DATE NOT NULL,
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "paid_note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "fee_entry_id" TEXT,
    "entry_date" DATE NOT NULL,
    "entry_type" TEXT NOT NULL,
    "cost_centre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration_minutes_billed" INTEGER,
    "unit_quantity_thousandths" INTEGER,
    "rate_cents" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_matter_id_idx" ON "invoices"("matter_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
