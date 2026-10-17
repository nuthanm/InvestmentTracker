-- Partial withdrawals on an open recurring plan (RD, yearly, chit).
-- Recording one does not close the plan. Run in the Neon SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS partial_withdrawals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id  UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         NUMERIC(14,2) NOT NULL,
  withdrawn_on   DATE NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partial_withdrawals_investment ON partial_withdrawals(investment_id, withdrawn_on);
CREATE INDEX IF NOT EXISTS idx_partial_withdrawals_user ON partial_withdrawals(user_id);

COMMIT;
