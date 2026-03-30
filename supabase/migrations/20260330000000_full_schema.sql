-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'fee_earner', 'assistant');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'fee_earner',
    "default_fee_level_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firm_settings" (
    "id" TEXT NOT NULL,
    "firm_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "logo_file_path" TEXT,
    "vat_registered" BOOLEAN NOT NULL DEFAULT false,
    "vat_registration_number" TEXT,
    "vat_rate_bps" INTEGER NOT NULL DEFAULT 1500,
    "trust_bank_name" TEXT,
    "trust_bank_account_name" TEXT,
    "trust_bank_account_number" TEXT,
    "trust_bank_branch_code" TEXT,
    "trust_bank_swift" TEXT,
    "business_bank_name" TEXT,
    "business_bank_account_name" TEXT,
    "business_bank_account_number" TEXT,
    "business_bank_branch_code" TEXT,
    "business_bank_swift" TEXT,
    "invoice_payment_instructions" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'INV',
    "invoice_next_number" INTEGER NOT NULL DEFAULT 1,
    "matter_code_auto_generate" BOOLEAN NOT NULL DEFAULT true,
    "billing_blocks_enabled" BOOLEAN NOT NULL DEFAULT true,
    "financial_year_start_month" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firm_offices" (
    "id" TEXT NOT NULL,
    "firm_settings_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal_code" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "website" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "firm_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourly_rate_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "default_billable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "posting_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "matter_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "posting_codes_code_key" ON "posting_codes"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_fee_level_id_fkey" FOREIGN KEY ("default_fee_level_id") REFERENCES "fee_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firm_offices" ADD CONSTRAINT "firm_offices_firm_settings_id_fkey" FOREIGN KEY ("firm_settings_id") REFERENCES "firm_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('individual_sa', 'company_pty', 'company_ltd', 'close_corporation', 'trust', 'partnership', 'foreign_company', 'other');

-- CreateEnum
CREATE TYPE "FicaStatus" AS ENUM ('not_compliant', 'partially_compliant', 'compliant');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('open', 'closed', 'suspended');

-- CreateEnum
CREATE TYPE "NoteSource" AS ENUM ('manual', 'from_fee_entry');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "client_code" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "email_general" TEXT,
    "email_invoices" TEXT,
    "email_statements" TEXT,
    "tel" TEXT,
    "mobile" TEXT,
    "physical_address_line_1" TEXT,
    "physical_address_line_2" TEXT,
    "physical_city" TEXT,
    "physical_province" TEXT,
    "physical_postal_code" TEXT,
    "postal_address_line_1" TEXT,
    "postal_address_line_2" TEXT,
    "postal_city" TEXT,
    "postal_province" TEXT,
    "postal_postal_code" TEXT,
    "vat_number" TEXT,
    "fica_status" "FicaStatus" NOT NULL DEFAULT 'not_compliant',
    "fica_notes" TEXT,
    "fica_last_updated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fica_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "notes" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fica_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_code_sequences" (
    "fee_earner_initials" TEXT NOT NULL,
    "client_code" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "matter_code_sequences_pkey" PRIMARY KEY ("fee_earner_initials","client_code")
);

-- CreateTable
CREATE TABLE "matters" (
    "id" TEXT NOT NULL,
    "matter_code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matter_type_id" TEXT,
    "department_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'open',
    "date_opened" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_closed" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_users" (
    "matter_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_users_pkey" PRIMARY KEY ("matter_id","user_id")
);

-- CreateTable
CREATE TABLE "matter_associations" (
    "matter_id" TEXT NOT NULL,
    "associated_matter_id" TEXT NOT NULL,
    "relationship_note" TEXT,

    CONSTRAINT "matter_associations_pkey" PRIMARY KEY ("matter_id","associated_matter_id")
);

-- CreateTable
CREATE TABLE "matter_attachments" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "description" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_notes" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "NoteSource" NOT NULL DEFAULT 'manual',
    "fee_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matter_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "assigned_to" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_code_key" ON "clients"("client_code");

-- CreateIndex
CREATE UNIQUE INDEX "matters_matter_code_key" ON "matters"("matter_code");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fica_documents" ADD CONSTRAINT "fica_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fica_documents" ADD CONSTRAINT "fica_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_matter_type_id_fkey" FOREIGN KEY ("matter_type_id") REFERENCES "matter_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_associations" ADD CONSTRAINT "matter_associations_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_associations" ADD CONSTRAINT "matter_associations_associated_matter_id_fkey" FOREIGN KEY ("associated_matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_attachments" ADD CONSTRAINT "matter_attachments_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_attachments" ADD CONSTRAINT "matter_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_notes" ADD CONSTRAINT "matter_notes_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_notes" ADD CONSTRAINT "matter_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
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
-- Trust balance non-negative trigger
-- Fires AFTER INSERT on trust_entries.
-- For outflow entry types (trust_payment, trust_transfer_out), checks that the
-- running trust balance for the matter does not go below zero.

CREATE OR REPLACE FUNCTION check_trust_balance_non_negative()
RETURNS TRIGGER AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  -- Only enforce for outflow types
  IF NEW.entry_type IN ('trust_payment', 'trust_transfer_out') THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN entry_type IN ('trust_receipt', 'trust_transfer_in', 'collection_receipt') THEN amount_cents
        WHEN entry_type IN ('trust_payment', 'trust_transfer_out') THEN -amount_cents
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM trust_entries
    WHERE matter_id = NEW.matter_id;

    IF v_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient trust funds: matter % would have a negative trust balance', NEW.matter_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_trust_balance
AFTER INSERT ON trust_entries
FOR EACH ROW EXECUTE FUNCTION check_trust_balance_non_negative();
-- ─── Phase 5 GL: Chart of Accounts + Double-Entry Journal ────────────────────

-- CreateEnum
CREATE TYPE "GlAccountType" AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- CreateTable: gl_accounts
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "GlAccountType" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- CreateTable: journal_entries
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "narration" TEXT NOT NULL,
    "reference_number" TEXT,
    "trust_entry_id" TEXT,
    "business_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries"("entry_date");
CREATE INDEX "journal_entries_trust_entry_id_idx" ON "journal_entries"("trust_entry_id");
CREATE INDEX "journal_entries_business_entry_id_idx" ON "journal_entries"("business_entry_id");

-- CreateTable: journal_lines
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit_cents" INTEGER NOT NULL DEFAULT 0,
    "credit_cents" INTEGER NOT NULL DEFAULT 0,
    "matter_id" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- AddForeignKeys
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_trust_entry_id_fkey"
    FOREIGN KEY ("trust_entry_id") REFERENCES "trust_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_business_entry_id_fkey"
    FOREIGN KEY ("business_entry_id") REFERENCES "business_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_lines"
    ADD CONSTRAINT "journal_lines_journal_entry_id_fkey"
    FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_lines"
    ADD CONSTRAINT "journal_lines_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_lines"
    ADD CONSTRAINT "journal_lines_matter_id_fkey"
    FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Seed system GL accounts ──────────────────────────────────────────────────
-- SA law firm standard chart of accounts

INSERT INTO "gl_accounts" ("id", "code", "name", "account_type", "is_system", "sort_order") VALUES
  (gen_random_uuid()::text, '1001', 'Trust Bank Account',           'asset',     true, 10),
  (gen_random_uuid()::text, '1002', 'Business Current Account',     'asset',     true, 20),
  (gen_random_uuid()::text, '1010', 'Debtors Control',              'asset',     true, 30),
  (gen_random_uuid()::text, '2001', 'Trust Creditors (Client Funds)','liability', true, 10),
  (gen_random_uuid()::text, '2010', 'Payables Control',             'liability', true, 20),
  (gen_random_uuid()::text, '4001', 'Professional Fees Income',     'income',    true, 10),
  (gen_random_uuid()::text, '4002', 'Trust-to-Business Transfer',   'income',    true, 20),
  (gen_random_uuid()::text, '5001', 'Disbursements Expense',        'expense',   true, 10);

-- ─── Trigger 1: Trust-Business separation enforcement ─────────────────────────
-- Prevents trust_to_business entries without a paired trust entry.

CREATE OR REPLACE FUNCTION enforce_trust_to_business_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_type = 'trust_to_business' AND NEW.linked_trust_entry_id IS NULL THEN
    RAISE EXCEPTION
      'trust_to_business business entries must reference a linked_trust_entry_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_trust_business_link
BEFORE INSERT ON "business_entries"
FOR EACH ROW EXECUTE FUNCTION enforce_trust_to_business_link();

-- ─── Trigger 2: Auto-journal for trust_entries ────────────────────────────────
-- For each posted trust entry (excluding inter-matter transfers whose net GL
-- effect is zero), insert a balanced journal entry.
--
-- Mapping:
--   trust_receipt / collection_receipt  →  DR 1001 Trust Bank  / CR 2001 Trust Creditors
--   trust_payment                       →  DR 2001 Trust Creditors / CR 1001 Trust Bank

CREATE OR REPLACE FUNCTION generate_gl_journal_for_trust()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id   TEXT;
  v_dr_acct TEXT;
  v_cr_acct TEXT;
BEGIN
  -- Inter-matter transfers are internal to 2001 sub-ledgers; net GL effect = 0.
  -- They are captured by the trust balance trigger separately.
  IF NEW.entry_type IN ('trust_transfer_in', 'trust_transfer_out') THEN
    RETURN NEW;
  END IF;

  IF NEW.entry_type IN ('trust_receipt', 'collection_receipt') THEN
    SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '1001';
    SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '2001';
  ELSIF NEW.entry_type = 'trust_payment' THEN
    SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '2001';
    SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '1001';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO "journal_entries" (id, entry_date, narration, trust_entry_id, created_at)
  VALUES (gen_random_uuid()::text, NEW.entry_date, NEW.narration, NEW.id, NOW())
  RETURNING id INTO v_je_id;

  INSERT INTO "journal_lines" (id, journal_entry_id, account_id, debit_cents, credit_cents, matter_id)
  VALUES (gen_random_uuid()::text, v_je_id, v_dr_acct, NEW.amount_cents, 0, NEW.matter_id);

  INSERT INTO "journal_lines" (id, journal_entry_id, account_id, debit_cents, credit_cents, matter_id)
  VALUES (gen_random_uuid()::text, v_je_id, v_cr_acct, 0, NEW.amount_cents, NEW.matter_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gl_journal_trust
AFTER INSERT ON "trust_entries"
FOR EACH ROW EXECUTE FUNCTION generate_gl_journal_for_trust();

-- ─── Trigger 3: Auto-journal for business_entries ─────────────────────────────
-- Mapping:
--   matter_receipt    →  DR 1002 Business Current / CR 1010 Debtors Control
--   matter_payment    →  DR 1010 Debtors Control  / CR 1002 Business Current
--   business_receipt  →  DR 1002 Business Current / CR 4001 Professional Fees
--   business_payment  →  DR 5001 Disbursements    / CR 1002 Business Current
--   supplier_invoice  →  DR 5001 Disbursements    / CR 2010 Payables Control
--   supplier_payment  →  DR 2010 Payables Control / CR 1002 Business Current
--   trust_to_business →  DR 1002 Business Current / CR 4002 Trust-to-Business Transfer
--   bank_transfer     →  (skipped — internal between bank accounts)

CREATE OR REPLACE FUNCTION generate_gl_journal_for_business()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id   TEXT;
  v_dr_acct TEXT;
  v_cr_acct TEXT;
BEGIN
  IF NEW.entry_type = 'bank_transfer' THEN
    RETURN NEW;
  END IF;

  CASE NEW.entry_type
    WHEN 'matter_receipt' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '1002';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '1010';
    WHEN 'matter_payment' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '1010';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '1002';
    WHEN 'business_receipt' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '1002';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '4001';
    WHEN 'business_payment' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '5001';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '1002';
    WHEN 'supplier_invoice' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '5001';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '2010';
    WHEN 'supplier_payment' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '2010';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '1002';
    WHEN 'trust_to_business' THEN
      SELECT id INTO v_dr_acct FROM "gl_accounts" WHERE code = '1002';
      SELECT id INTO v_cr_acct FROM "gl_accounts" WHERE code = '4002';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO "journal_entries" (id, entry_date, narration, business_entry_id, created_at)
  VALUES (gen_random_uuid()::text, NEW.entry_date, NEW.narration, NEW.id, NOW())
  RETURNING id INTO v_je_id;

  INSERT INTO "journal_lines" (id, journal_entry_id, account_id, debit_cents, credit_cents, matter_id)
  VALUES (gen_random_uuid()::text, v_je_id, v_dr_acct, NEW.amount_cents, 0, NEW.matter_id);

  INSERT INTO "journal_lines" (id, journal_entry_id, account_id, debit_cents, credit_cents, matter_id)
  VALUES (gen_random_uuid()::text, v_je_id, v_cr_acct, 0, NEW.amount_cents, NEW.matter_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gl_journal_business
AFTER INSERT ON "business_entries"
FOR EACH ROW EXECUTE FUNCTION generate_gl_journal_for_business();
-- Phase 6: Bank Statement Import and Reconciliation

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('trust', 'business');

-- CreateTable: bank_statements
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "account_type" "BankAccountType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "account_number" TEXT,
    "account_description" TEXT,
    "statement_from" DATE,
    "statement_to" DATE,
    "opening_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "closing_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "imported_by_id" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_statements_account_type_idx" ON "bank_statements"("account_type");

-- CreateTable: bank_statement_lines
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "bank_statement_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "transaction_date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "balance_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_statement_lines_bank_statement_id_idx" ON "bank_statement_lines"("bank_statement_id");
CREATE INDEX "bank_statement_lines_transaction_date_idx" ON "bank_statement_lines"("transaction_date");

-- CreateTable: bank_matches
CREATE TABLE "bank_matches" (
    "id" TEXT NOT NULL,
    "bank_statement_line_id" TEXT NOT NULL,
    "trust_entry_id" TEXT,
    "business_entry_id" TEXT,
    "matched_by_id" TEXT NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "bank_matches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_bank_statement_line_id_fkey" FOREIGN KEY ("bank_statement_line_id") REFERENCES "bank_statement_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_trust_entry_id_fkey" FOREIGN KEY ("trust_entry_id") REFERENCES "trust_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_business_entry_id_fkey" FOREIGN KEY ("business_entry_id") REFERENCES "business_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_matched_by_id_fkey" FOREIGN KEY ("matched_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger: keep bank_statement_lines.is_reconciled in sync with bank_matches
CREATE OR REPLACE FUNCTION update_bank_line_reconciled()
RETURNS TRIGGER AS $$
DECLARE
  v_line_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_line_id := NEW.bank_statement_line_id;
    UPDATE "bank_statement_lines" SET is_reconciled = true WHERE id = v_line_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_line_id := OLD.bank_statement_line_id;
    UPDATE "bank_statement_lines"
    SET is_reconciled = EXISTS (
      SELECT 1 FROM "bank_matches" WHERE bank_statement_line_id = v_line_id
    )
    WHERE id = v_line_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_match_reconciled
AFTER INSERT OR DELETE ON "bank_matches"
FOR EACH ROW EXECUTE FUNCTION update_bank_line_reconciled();
-- AlterTable
ALTER TABLE "gl_accounts" ALTER COLUMN "is_system" SET DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "monthly_target_cents" INTEGER;
-- CreateTable
CREATE TABLE "fee_schedule_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedule_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedule_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "official_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "professional_fee_cents" INTEGER NOT NULL,
    "vat_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedule_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "fee_schedule_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: South Africa Trade Marks tariff
DO $$
DECLARE cat TEXT := 'fsc-za-trademarks-2024';
BEGIN
  INSERT INTO "fee_schedule_categories" ("id", "name", "jurisdiction", "currency")
  VALUES (cat, 'Trade Marks', 'South Africa', 'ZAR')
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "fee_schedule_items" ("id", "category_id", "section", "description", "official_fee_cents", "professional_fee_cents", "sort_order")
  VALUES
    -- SEARCHES
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Availability search for one trade mark', 120, 300000, 10),
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Identical / Exact search', 20, 50000, 20),
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Proprietor search', 20, 30000, 30),

    -- APPLICATIONS
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Filing one application in one class', 590, 300000, 40),
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Each additional class same trade mark', 590, 270000, 50),
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Claiming convention priority', 0, 60000, 60),

    -- PROSECUTION / OFFICIAL ACTION
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Receiving Official Action', 0, 210000, 70),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First association endorsement', 5, 90000, 80),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional association endorsement', 5, 50000, 90),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First other endorsement (disclaimer etc)', 0, 90000, 100),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional other endorsement', 0, 50000, 110),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Written opinion on prospects', 0, 58500, 120),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Preparing written submissions (minimum)', 0, 210000, 130),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Attending informal hearing', 0, 102500, 140),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Obtaining grounds of Registrar decision', 363, 112500, 150),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First extension application', 0, 60000, 160),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional extension simultaneously', 0, 35000, 170),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Serving notice of acceptance on proprietor', 0, 87000, 180),

    -- REGISTRATION
    (gen_random_uuid()::text, cat, 'REGISTRATION', 'First certificate', 14, 180000, 190),
    (gen_random_uuid()::text, cat, 'REGISTRATION', 'Each additional certificate simultaneously', 14, 100000, 200),

    -- ASSIGNMENT & SUBSTITUTION
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'First application/registration', 150, 330000, 210),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Each additional up to 10th', 26, 109200, 220),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', '11th and each additional', 26, 27500, 230),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Preparing assignment agreement', 0, 190000, 240),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Late recordal penalty first 12 months', 48, 25000, 250),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Late recordal penalty each additional period', 48, 25000, 260),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Preparation of assignment certificate', 0, 15000, 270),

    -- REGISTERED USERS
    (gen_random_uuid()::text, cat, 'REGISTERED USERS', 'First registration', 150, 330000, 280),
    (gen_random_uuid()::text, cat, 'REGISTERED USERS', 'Each additional up to 10th', 26, 109200, 290);
END $$;
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "is_historical" BOOLEAN NOT NULL DEFAULT false;
-- AlterTable
ALTER TABLE "fee_schedule_items" ALTER COLUMN "vat_rate" SET DATA TYPE DECIMAL(65,30);
-- AlterTable
ALTER TABLE "fee_entries" ADD COLUMN     "is_historical" BOOLEAN NOT NULL DEFAULT false;
-- AlterTable
ALTER TABLE "fee_entries" ADD COLUMN     "fee_earner_name" TEXT;
-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('not_yet_billed', 'awaiting_payment', 'paid');

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "allocation" TEXT,
ADD COLUMN     "billing_status" "BillingStatus" NOT NULL DEFAULT 'not_yet_billed',
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "loe_fica_done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matter_status_note" TEXT,
ADD COLUMN     "to_do" JSONB;
