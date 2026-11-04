-- Reuse shared tags for goals (same labels as investments).
-- Run this in your Neon SQL editor (https://console.neon.tech).

CREATE TABLE IF NOT EXISTS goal_tags (
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (goal_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_tags_tag ON goal_tags(tag_id);
