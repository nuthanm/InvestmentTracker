-- Add optional goal notes and inflation planning data for future target calculations.
-- Run this in your database migration tool or Neon SQL editor.

BEGIN;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS inflation_pct NUMERIC(6,3) DEFAULT 0;

ALTER TABLE goals
  ALTER COLUMN target_date SET NOT NULL;

COMMIT;
