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
