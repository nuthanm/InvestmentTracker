-- Safe follow-up patch: internal recovery key support.
-- Needed if auth-hardening migration was already applied before this column was added.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT;
