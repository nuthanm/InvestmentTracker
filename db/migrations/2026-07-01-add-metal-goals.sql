-- Add gold and silver weight target columns to user_settings.
-- Run this in your Neon SQL editor (https://console.neon.tech).

BEGIN;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS gold_target_g  NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS silver_target_g NUMERIC(10,3);

COMMIT;
