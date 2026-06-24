-- Add user_settings table to store per-user preferences including overall portfolio goal.
-- Run this in your Neon SQL editor (https://console.neon.tech).

BEGIN;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  overall_goal_amount NUMERIC(14,2),
  overall_goal_date   DATE,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

COMMIT;
