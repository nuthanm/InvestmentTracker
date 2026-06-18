-- Safe forward-only migration.
-- Adds account_holder to investments and a new payment_records table.
-- Run in your Neon SQL Editor (https://console.neon.tech).

BEGIN;

-- 1. Add account_holder to investments (who owns this investment: e.g. 'Self', 'Wife', 'Father').
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS account_holder TEXT DEFAULT 'Self';

-- Backfill existing rows.
UPDATE investments
SET account_holder = 'Self'
WHERE account_holder IS NULL;

-- 2. Payment records table — tracks whether each periodic instalment was paid.
--    One row per expected period (month or year) per investment.
--    period_label examples: 'Jun 2026' (monthly) or '2026-27' (yearly)
CREATE TABLE IF NOT EXISTS payment_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id  UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_label   TEXT NOT NULL,          -- human-readable period identifier
  due_date       DATE NOT NULL,          -- when this instalment is due
  amount         NUMERIC(14,2) NOT NULL, -- expected payment amount
  paid           BOOLEAN DEFAULT FALSE,
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(investment_id, period_label)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_investment ON payment_records(investment_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user ON payment_records(user_id);

COMMIT;
