-- CreateEnum
CREATE TYPE "VatFlag" AS ENUM ('Y', 'N');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('time', 'qty');

-- CreateEnum
CREATE TYPE "TaxTypeCategory" AS ENUM ('sales', 'purchase');

-- CreateEnum
CREATE TYPE "NarrationContext" AS ENUM ('matter_notes', 'fee_disb_narrations', 'diary_notes');

-- CreateEnum
CREATE TYPE "InvestmentEntryType" AS ENUM ('investment_receipt', 'investment_payment', 'investment_interest', 'investment_transfer_in', 'investment_transfer_out');

-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'credit_note';

-- AlterEnum
ALTER TYPE "BankAccountType" ADD VALUE 'investment';

-- AlterTable
ALTER TABLE "posting_codes" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "default_unit_price_cents" INTEGER,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "gl_account_id" TEXT,
ADD COLUMN     "tax_type_id" TEXT,
ADD COLUMN     "unit_type" "UnitType" NOT NULL DEFAULT 'time';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "bank_account" TEXT,
ADD COLUMN     "bank_branch" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "client_ref" TEXT,
ADD COLUMN     "credit_terms" TEXT,
ADD COLUMN     "currency_id" TEXT,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "id_number" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reg_number" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "surname" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "tax_type_id" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "trading_as" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "accounts_email" TEXT,
ADD COLUMN     "billing_entity_override" TEXT,
ADD COLUMN     "claim_amount_cents" INTEGER,
ADD COLUMN     "client_ref" TEXT,
ADD COLUMN     "css_class" TEXT,
ADD COLUMN     "default_discount_percent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fee_cap_cents" INTEGER,
ADD COLUMN     "fee_cap_period" TEXT,
ADD COLUMN     "fee_level_id" TEXT,
ADD COLUMN     "investment_name" TEXT,
ADD COLUMN     "reserve_trust" TEXT,
ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax_number" TEXT;

-- AlterTable
ALTER TABLE "fee_entries" ADD COLUMN     "capturer_id" TEXT,
ADD COLUMN     "stamp_date" TIMESTAMP(3),
ADD COLUMN     "vat_flag" "VatFlag";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "lp_pdf_url" TEXT,
ADD COLUMN     "original_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bank_account" TEXT,
ADD COLUMN     "bank_branch" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "credit_days" INTEGER,
ADD COLUMN     "default_account_id" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "physical_address" TEXT,
ADD COLUMN     "postal_address" TEXT,
ADD COLUMN     "reg_number" TEXT,
ADD COLUMN     "supplier_code" TEXT,
ADD COLUMN     "supplier_type_id" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "trading_as" TEXT;

-- AlterTable
ALTER TABLE "gl_accounts" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "fee_earner_id" TEXT,
ADD COLUMN     "flag" TEXT,
ADD COLUMN     "opening_balance_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_pct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "category" "TaxTypeCategory" NOT NULL DEFAULT 'sales',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tax_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_code_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parent_id" TEXT,
    "gl_account_id" TEXT,
    "unbilled_gl_account_id" TEXT,
    "department_id" TEXT,

    CONSTRAINT "posting_code_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_account_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parent_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gl_account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_account_id" TEXT,
    "bti_code" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "title" TEXT,
    "first_name" TEXT,
    "surname" TEXT,
    "salutation" TEXT,
    "birthdate" DATE,
    "email" TEXT,
    "website" TEXT,
    "cell" TEXT,
    "work_phone" TEXT,
    "direct_phone" TEXT,
    "home_phone" TEXT,
    "fax" TEXT,
    "company_name" TEXT,
    "job_title" TEXT,
    "id_number" TEXT,
    "passport_number" TEXT,
    "nationality" TEXT,
    "tax_number" TEXT,
    "vat_number" TEXT,
    "physical_address" TEXT,
    "postal_address" TEXT,
    "employer_address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "BankAccountType" NOT NULL,
    "bank_name" TEXT,
    "account_number" TEXT,
    "branch_code" TEXT,
    "swift" TEXT,
    "currency_code" TEXT DEFAULT 'ZAR',
    "bti_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_narrations" (
    "id" TEXT NOT NULL,
    "search_trigger" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "context" "NarrationContext" NOT NULL DEFAULT 'fee_disb_narrations',
    "all_departments" BOOLEAN NOT NULL DEFAULT true,
    "all_matter_types" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canned_narrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "entry_type" "InvestmentEntryType" NOT NULL,
    "entry_date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "reference_number" TEXT,
    "investment_name" TEXT,
    "supplier_id" TEXT,
    "linked_entry_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_types_code_key" ON "tax_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "posting_code_categories_code_key" ON "posting_code_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gl_account_categories_code_key" ON "gl_account_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_methods_name_key" ON "receipt_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_types_name_key" ON "supplier_types"("name");

-- CreateIndex
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_code_key" ON "bank_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "investment_entries_linked_entry_id_key" ON "investment_entries"("linked_entry_id");

-- CreateIndex
CREATE INDEX "investment_entries_matter_id_idx" ON "investment_entries"("matter_id");

-- CreateIndex
CREATE INDEX "investment_entries_entry_date_idx" ON "investment_entries"("entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- AddForeignKey
ALTER TABLE "posting_codes" ADD CONSTRAINT "posting_codes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "posting_code_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_codes" ADD CONSTRAINT "posting_codes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_codes" ADD CONSTRAINT "posting_codes_tax_type_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_codes" ADD CONSTRAINT "posting_codes_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_code_categories" ADD CONSTRAINT "posting_code_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "posting_code_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_code_categories" ADD CONSTRAINT "posting_code_categories_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_code_categories" ADD CONSTRAINT "posting_code_categories_unbilled_gl_account_id_fkey" FOREIGN KEY ("unbilled_gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_code_categories" ADD CONSTRAINT "posting_code_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_account_categories" ADD CONSTRAINT "gl_account_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "gl_account_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tax_type_id_fkey" FOREIGN KEY ("tax_type_id") REFERENCES "tax_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_fee_level_id_fkey" FOREIGN KEY ("fee_level_id") REFERENCES "fee_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_entries" ADD CONSTRAINT "fee_entries_capturer_id_fkey" FOREIGN KEY ("capturer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_supplier_type_id_fkey" FOREIGN KEY ("supplier_type_id") REFERENCES "supplier_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_entries" ADD CONSTRAINT "investment_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_entries" ADD CONSTRAINT "investment_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_entries" ADD CONSTRAINT "investment_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_entries" ADD CONSTRAINT "investment_entries_linked_entry_id_fkey" FOREIGN KEY ("linked_entry_id") REFERENCES "investment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "gl_account_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

