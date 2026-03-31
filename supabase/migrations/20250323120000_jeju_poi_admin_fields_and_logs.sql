-- Admin-editable copy + tags on jeju_kor_tourapi_places (additive; skips columns already added by prior migrations)
-- itinerary_generation_logs for audit (service-role API only)

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS admin_note_ko TEXT,
  ADD COLUMN IF NOT EXISTS admin_note_en TEXT,
  ADD COLUMN IF NOT EXISTS admin_short_desc_ko TEXT,
  ADD COLUMN IF NOT EXISTS admin_short_desc_en TEXT,
  ADD COLUMN IF NOT EXISTS recommended_duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS admin_tags TEXT[],
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS admin_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.admin_note_ko IS 'Operator experience / recommendation (Korean)';
COMMENT ON COLUMN public.jeju_kor_tourapi_places.recommended_duration_min IS 'Suggested dwell time; overrides AI default when set';
COMMENT ON COLUMN public.jeju_kor_tourapi_places.admin_tags IS 'Free-form tags for search/filter';

CREATE TABLE IF NOT EXISTS public.itinerary_generation_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_ids TEXT[] NOT NULL DEFAULT '{}',
  gemini_raw JSONB,
  claude_raw JSONB,
  final_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.itinerary_generation_logs IS 'Server-side itinerary generation audit; no PII in user_input by convention';

ALTER TABLE public.itinerary_generation_logs ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — access via service_role in API routes only
GRANT ALL ON public.itinerary_generation_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_itinerary_generation_logs_created_at
  ON public.itinerary_generation_logs (created_at DESC);
