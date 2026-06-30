-- =====================================================================
-- Backup recovery codes and security questions for account recovery
-- =====================================================================

-- Backup recovery codes (one-time use for password reset)
CREATE TABLE IF NOT EXISTS backup_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_recovery_codes(user_id);

-- Security questions for account recovery
CREATE TABLE IF NOT EXISTS user_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_security_questions ON user_security_questions(user_id);
