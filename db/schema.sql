-- =====================================================================
-- Investment Tracker · Postgres schema for Neon
-- Run this once in your Neon SQL editor (https://console.neon.tech).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  pin_hash TEXT,
  password_hash TEXT,
  recovery_key_hash TEXT,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_skip_until TIMESTAMPTZ,
  mfa_secret TEXT,
  mfa_pending_secret TEXT,
  legal_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------- Sessions ----------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------- Security Events ----------
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  meta JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);

-- ---------- Login Challenges (MFA step-up) ----------
CREATE TABLE IF NOT EXISTS login_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_challenges_user ON login_challenges(user_id);

-- ---------- Password Reset Tokens ----------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- ---------- Goals ----------
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  target_date DATE,
  icon TEXT DEFAULT 'house',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- ---------- Investments ----------
-- type_code values: FD, MF, ST, GD, PPF, RD, OT
-- payment_frequency values: lump_sum (one-time), monthly (e.g. RD), yearly (e.g. PPF)
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  type_code TEXT NOT NULL,
  custom_type TEXT,
  bank TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,          -- per-period contribution for monthly/yearly types
  rate_pct NUMERIC(6,3) NOT NULL,
  tenure_months INT NOT NULL,
  tenure_days INT DEFAULT 0,
  compounding TEXT DEFAULT 'quarterly',
  payment_frequency TEXT DEFAULT 'lump_sum', -- lump_sum | monthly | yearly
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maturity_date DATE,
  maturity_value NUMERIC(14,2),
  nominee TEXT NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,
  account_holder TEXT DEFAULT 'Self',    -- who owns this investment (e.g. Self, Wife, Father)
  lifecycle_status TEXT NOT NULL DEFAULT 'active', -- active | matured | closed | premature_withdrawal
  closure_date DATE,
  closure_amount NUMERIC(14,2),
  applied_rate_pct NUMERIC(6,3),
  penalty_pct NUMERIC(6,3),
  penalty_amount NUMERIC(14,2),
  closure_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If you are upgrading an older database, run:
-- db/migrations/2026-06-15-safe-upgrade-investments.sql

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_goal ON investments(goal_id);

-- ---------- Market Transactions ----------
-- Tracks buys, redemptions, dividends, bonuses, and switches for market-linked holdings.
CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  trade_date DATE NOT NULL,
  units NUMERIC(18,6) NOT NULL DEFAULT 0,
  price_per_unit NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxes NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment ON investment_transactions(investment_id, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user ON investment_transactions(user_id, trade_date DESC);

-- ---------- Payment Records ----------
-- Tracks whether each periodic instalment (monthly/yearly) was paid.
-- period_label: 'Jun 2026' for monthly, '2026-27' for yearly.
CREATE TABLE IF NOT EXISTS payment_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id  UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_label   TEXT NOT NULL,
  due_date       DATE NOT NULL,
  amount         NUMERIC(14,2) NOT NULL,
  paid           BOOLEAN DEFAULT FALSE,
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(investment_id, period_label)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_investment ON payment_records(investment_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user ON payment_records(user_id);

-- ---------- Documents (PDF metadata; files stored separately) ----------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size_bytes INT NOT NULL,
  page_count INT DEFAULT 1,
  data_url TEXT,                    -- v1: base64 stored here so the app stays free
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_investment ON documents(investment_id);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
