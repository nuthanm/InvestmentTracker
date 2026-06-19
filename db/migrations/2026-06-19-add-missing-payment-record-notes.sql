-- Safe patch migration.
-- Adds notes column to payment_records if it was created without notes.

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS notes TEXT;
