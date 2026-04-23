-- Internal recommendation / scoring columns for jeju_kor_tourapi_places
-- Run batch: npm run score:jeju:places (after data import)

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS region_group TEXT,
  ADD COLUMN IF NOT EXISTS is_indoor BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_must_visit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS popularity_score NUMERIC,
  ADD COLUMN IF NOT EXISTS data_quality_score NUMERIC,
  ADD COLUMN IF NOT EXISTS base_score NUMERIC,
  ADD COLUMN IF NOT EXISTS manual_priority NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_value_score NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_score NUMERIC,
  ADD COLUMN IF NOT EXISTS senior_score NUMERIC,
  ADD COLUMN IF NOT EXISTS family_score NUMERIC,
  ADD COLUMN IF NOT EXISTS couple_score NUMERIC,
  ADD COLUMN IF NOT EXISTS rainy_day_score NUMERIC,
  ADD COLUMN IF NOT EXISTS route_efficiency_score NUMERIC,
  ADD COLUMN IF NOT EXISTS season_spring NUMERIC,
  ADD COLUMN IF NOT EXISTS season_summer NUMERIC,
  ADD COLUMN IF NOT EXISTS season_autumn NUMERIC,
  ADD COLUMN IF NOT EXISTS season_winter NUMERIC,
  ADD COLUMN IF NOT EXISTS scoring_version TEXT,
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.region_group IS 'Heuristic region bucket: east, west, south, city, udo, etc';
COMMENT ON COLUMN public.jeju_kor_tourapi_places.base_score IS 'Weighted v1 score 0–100; manual_hidden forces ~0';
COMMENT ON COLUMN public.jeju_kor_tourapi_places.scoring_version IS 'Batch scoring recipe id, e.g. v1';
COMMENT ON COLUMN public.jeju_kor_tourapi_places.scored_at IS 'Last time batch scoring ran';

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_region_group
  ON public.jeju_kor_tourapi_places (region_group);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_manual_hidden
  ON public.jeju_kor_tourapi_places (manual_hidden);

CREATE INDEX IF NOT EXISTS idx_jeju_kor_tourapi_places_base_score_desc
  ON public.jeju_kor_tourapi_places (base_score DESC NULLS LAST);
