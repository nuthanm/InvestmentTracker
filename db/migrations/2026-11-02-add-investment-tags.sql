-- Labels such as Marriage or Engagement, shared across a user's investments and liquidity.
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name_key)
);

CREATE TABLE IF NOT EXISTS investment_tags (
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (investment_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_investment_tags_tag ON investment_tags(tag_id);
