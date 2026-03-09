-- Allow zh-TW, es, ja in user_profiles.language_preference (fix 400 / error 23514 on PATCH)
-- Run in Supabase SQL Editor if language selector (e.g. 中文 繁體) causes "400 Bad Request".
-- If DROP fails, find constraint: SELECT conname FROM pg_constraint WHERE conrelid = 'public.user_profiles'::regclass AND contype = 'c';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_language_preference_check;

-- Re-add CHECK with all app locales
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_language_preference_check
  CHECK (language_preference IN ('en', 'zh', 'ko', 'zh-TW', 'es', 'ja'));
