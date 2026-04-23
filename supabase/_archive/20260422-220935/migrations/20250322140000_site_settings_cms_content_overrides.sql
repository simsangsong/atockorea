-- CMS: locale message/siteCopy overrides + section image URLs (merged at runtime with repo JSON baselines).
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS cms_content_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.site_settings.cms_content_overrides IS
  'JSON shape: { messages?: Record<locale, object>, siteCopy?: Record<locale, object>, sectionImages?: Record<string, string> }. Deep-merged with static baselines.';
