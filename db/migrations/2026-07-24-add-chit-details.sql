-- Add chit fund schedule / pick-month details on investments.
-- Run this in your Neon SQL editor (https://console.neon.tech).

BEGIN;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS chit_details JSONB;

COMMIT;
