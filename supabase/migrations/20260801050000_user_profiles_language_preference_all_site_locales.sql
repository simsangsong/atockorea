-- The site has shipped 10 UI locales since the fr/de/it/ru launch
-- (lib/locale.ts `locales`, and the generated type in lib/supabase.ts already
-- lists all ten), but this CHECK still carried the original six. lib/i18n.ts
-- `setLocale()` writes the chosen locale to user_profiles.language_preference
-- inside a try/catch that only console.errors, so for fr/de/it/ru the UPDATE
-- was rejected by Postgres and SILENTLY discarded: those guests' language
-- choice never reached their account and reverted to English on any new device.
-- Zero rows carry the four locales, which is the fingerprint.
alter table public.user_profiles
  drop constraint if exists user_profiles_language_preference_check;

alter table public.user_profiles
  add constraint user_profiles_language_preference_check
  check (
    language_preference is null
    or language_preference = any (array[
      'en'::text, 'ko'::text, 'zh'::text, 'zh-TW'::text, 'es'::text,
      'ja'::text, 'fr'::text, 'de'::text, 'it'::text, 'ru'::text
    ])
  );
