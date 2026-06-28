-- Safe auth hardening migration.
-- Introduces email/password auth and lockout controls while preserving legacy mobile/PIN data.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN mobile DROP NOT NULL;

ALTER TABLE users
  ALTER COLUMN pin_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
