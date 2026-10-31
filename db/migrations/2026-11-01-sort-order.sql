-- Manual priority order for goals and investments.
-- Run this in the Neon SQL editor if the app asks for it.

ALTER TABLE goals ADD COLUMN IF NOT EXISTS sort_order INT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS sort_order INT;
