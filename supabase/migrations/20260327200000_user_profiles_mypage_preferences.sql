-- Optional JSON for mypage settings: currency, city, gender, notifications, emergency_contact, etc.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mypage_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_profiles.mypage_preferences IS 'Mypage-only prefs (currency, notifications, city, gender, emergency contact); merged via PATCH /api/auth/update-profile';
