-- Mypage settings preferences shared by the profile UI and update-profile API.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mypage_preferences jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.user_profiles
  ALTER COLUMN mypage_preferences SET DEFAULT '{}'::jsonb;

UPDATE public.user_profiles
SET mypage_preferences = '{}'::jsonb
WHERE mypage_preferences IS NULL;

COMMENT ON COLUMN public.user_profiles.mypage_preferences IS
  'Mypage-only prefs (currency, notifications, city, gender, emergency contact); merged via PATCH /api/auth/update-profile';
