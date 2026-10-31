-- Grams credited on each gold or silver scheme instalment.
-- Run this in the Neon SQL editor if the app asks for it.

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS rate_per_gram NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS grams NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS grams_manual BOOLEAN NOT NULL DEFAULT FALSE;
