-- Liquidity goals keep an inflation rate and have no target date.
-- Run this in your Neon SQL editor (https://console.neon.tech).

BEGIN;

ALTER TABLE goals
  ALTER COLUMN target_date DROP NOT NULL;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS for_liquidity BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS amount_as_of DATE;

COMMIT;
