-- Safe forward-only migration for existing databases.
-- Adds only missing columns used by current app code.
-- Existing data is preserved (no table drops, no destructive changes).

BEGIN;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS custom_type TEXT,
  ADD COLUMN IF NOT EXISTS tenure_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'lump_sum',
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS maturity_date DATE,
  ADD COLUMN IF NOT EXISTS maturity_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;

-- Backfill NULLs in legacy rows so reads/updates stay consistent.
UPDATE investments
SET
  tenure_days = COALESCE(tenure_days, 0),
  payment_frequency = COALESCE(payment_frequency, 'lump_sum'),
  start_date = COALESCE(start_date, CURRENT_DATE),
  auto_renew = COALESCE(auto_renew, FALSE)
WHERE
  tenure_days IS NULL
  OR payment_frequency IS NULL
  OR start_date IS NULL
  OR auto_renew IS NULL;

COMMIT;
