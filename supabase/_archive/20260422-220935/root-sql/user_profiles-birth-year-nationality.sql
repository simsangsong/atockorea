-- Add booking-relevant profile fields: birth_year, nationality
-- Run in Supabase SQL Editor if not yet applied.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS nationality TEXT;

COMMENT ON COLUMN user_profiles.birth_year IS 'Year of birth (e.g. 1990)';
COMMENT ON COLUMN user_profiles.nationality IS 'Nationality / country (e.g. South Korea, USA)';
