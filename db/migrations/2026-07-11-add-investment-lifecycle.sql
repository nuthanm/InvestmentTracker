-- Investment lifecycle: active, matured, closed, premature_withdrawal
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closure_date DATE,
  ADD COLUMN IF NOT EXISTS closure_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS applied_rate_pct NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS penalty_pct NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS closure_notes TEXT;
