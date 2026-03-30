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
