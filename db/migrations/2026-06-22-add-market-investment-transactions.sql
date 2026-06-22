BEGIN;

CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  trade_date DATE NOT NULL,
  units NUMERIC(18,6) NOT NULL DEFAULT 0,
  price_per_unit NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxes NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment ON investment_transactions(investment_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user ON investment_transactions(user_id, trade_date DESC);

COMMIT;
