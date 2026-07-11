-- Run this if you already applied 2026-07-11-add-investment-lifecycle.sql before interest_loss was added.
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS interest_loss NUMERIC(14,2);
