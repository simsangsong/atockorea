-- Stage-level observability for itinerary generation (additive; no column drops/renames)

ALTER TABLE public.itinerary_generation_logs
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT,
  ADD COLUMN IF NOT EXISTS provider_status JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.itinerary_generation_logs.pipeline_stage IS 'Latest pipeline stage name (mirrors last event stage when in sync)';
COMMENT ON COLUMN public.itinerary_generation_logs.pipeline_events IS 'Append-only stage events: stage, at, success, metadata (counts only)';
COMMENT ON COLUMN public.itinerary_generation_logs.prompt_versions IS 'Prompt bundle versions per provider key, e.g. gemini/claude';
COMMENT ON COLUMN public.itinerary_generation_logs.fallback_reason IS 'Short code when rule-based or recovery path used';
COMMENT ON COLUMN public.itinerary_generation_logs.provider_status IS 'Per-provider outcome: success | failed | skipped';
