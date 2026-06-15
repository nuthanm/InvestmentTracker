-- =====================================================================
-- Investment Tracker · Postgres schema for Neon
-- Run this once in your Neon SQL editor (https://console.neon.tech).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);

-- ---------- Sessions ----------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If you are upgrading an older database, run:
-- db/migrations/2026-06-15-safe-upgrade-investments.sql

CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_goal ON investments(goal_id);

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
