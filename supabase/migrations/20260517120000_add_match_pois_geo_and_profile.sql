-- Itinerary Builder Phase 1 — extend match_pois for POI catalog + map UI
-- Adds: geo coords (lat, lng), matching_profile (jsonb), default_stay_minutes,
-- category, names_other_locales (jsonb for ja/zh/zh-TW/es).
-- See docs/itinerary-builder-plan.md §F Phase 1.

ALTER TABLE public.match_pois
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS matching_profile jsonb,
  ADD COLUMN IF NOT EXISTS default_stay_minutes integer,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS names_other_locales jsonb;

CREATE INDEX IF NOT EXISTS idx_match_pois_region
  ON public.match_pois (region)
  WHERE region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_match_pois_stop_role
  ON public.match_pois (stop_role)
  WHERE stop_role IS NOT NULL;
