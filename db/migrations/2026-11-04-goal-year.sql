-- Explicit goal scope: NULL = common (ongoing), otherwise a calendar year.
-- Run this in your Neon SQL editor (https://console.neon.tech).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS goal_year INT;
