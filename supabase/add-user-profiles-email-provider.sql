-- Add email and auth_provider to user_profiles for storing signup source (Google, etc.)
-- Run this in Supabase SQL Editor if your user_profiles table doesn't have these columns yet.
-- After running, the app will store email and auth_provider on next OAuth login (callback).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_provider ON user_profiles(auth_provider);

COMMENT ON COLUMN user_profiles.email IS 'User email (synced from auth or OAuth)';
COMMENT ON COLUMN user_profiles.auth_provider IS 'Sign-in provider: email, google, facebook, kakao, line';
