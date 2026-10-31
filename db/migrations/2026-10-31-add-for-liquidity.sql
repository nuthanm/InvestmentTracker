-- Mark an investment as cash kept for liquidity rather than a growth holding.
-- Run this in your Neon SQL editor (https://console.neon.tech).

BEGIN;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS for_liquidity BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
