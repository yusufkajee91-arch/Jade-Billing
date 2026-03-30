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
