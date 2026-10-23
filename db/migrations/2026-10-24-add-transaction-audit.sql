-- Edit/delete support for market and metal transactions, with an audit trail
-- of every create, update and delete. Run in the Neon SQL Editor.

BEGIN;

ALTER TABLE investment_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- transaction_id has no foreign key so audit rows survive the transaction being deleted.
CREATE TABLE IF NOT EXISTS investment_transaction_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL,
  action          TEXT NOT NULL,            -- create | update | delete
  before_data     JSONB,
  after_data      JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_investment ON investment_transaction_audit(investment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_transaction ON investment_transaction_audit(transaction_id, created_at DESC);

COMMIT;
