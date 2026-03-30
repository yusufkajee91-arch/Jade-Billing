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
