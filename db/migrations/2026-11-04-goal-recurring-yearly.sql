-- Year goals can repeat every calendar year.
-- Run this in your Neon SQL editor (https://console.neon.tech).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS recurring_yearly BOOLEAN NOT NULL DEFAULT FALSE;
