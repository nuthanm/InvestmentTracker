-- Safe patch migration.
-- Adds deferral timestamp for MFA onboarding reminders.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_skip_until TIMESTAMPTZ;
