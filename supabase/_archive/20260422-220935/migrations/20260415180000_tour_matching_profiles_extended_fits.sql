-- =============================================================================
-- tour_matching_profiles — extended fit dimensions (all products same columns)
-- =============================================================================
-- Scales: fit columns 1–5 unless noted. indoor_ratio: 0–100 (indoor-ish share).
-- weather_sensitivity: 1–5 (higher = route more weather-exposed / sensitive).
-- shopping_fit: 1–5 (higher = more shopping-oriented stops emphasis).
-- =============================================================================

ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS adult_family_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS young_kids_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS senior_active_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS senior_general_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS mobility_friendly_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS stroller_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS indoor_ratio SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS weather_sensitivity SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS local_culture_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS shopping_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS storytelling_fit SMALLINT NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.tour_matching_profiles.adult_family_fit IS '1–5: fit for adult family groups';
COMMENT ON COLUMN public.tour_matching_profiles.young_kids_fit IS '1–5: fit for young children';
COMMENT ON COLUMN public.tour_matching_profiles.senior_active_fit IS '1–5: fit for active seniors';
COMMENT ON COLUMN public.tour_matching_profiles.senior_general_fit IS '1–5: fit for general senior pace';
COMMENT ON COLUMN public.tour_matching_profiles.mobility_friendly_fit IS '1–5: low-mobility / step-friendly emphasis';
COMMENT ON COLUMN public.tour_matching_profiles.stroller_fit IS '1–5: stroller-friendly routing';
COMMENT ON COLUMN public.tour_matching_profiles.indoor_ratio IS '0–100 approximate indoor / sheltered share';
COMMENT ON COLUMN public.tour_matching_profiles.weather_sensitivity IS '1–5: higher = more exposure to weather variability';
COMMENT ON COLUMN public.tour_matching_profiles.local_culture_fit IS '1–5: local culture / heritage emphasis';
COMMENT ON COLUMN public.tour_matching_profiles.shopping_fit IS '1–5: shopping-oriented experience (not avoid flag)';
COMMENT ON COLUMN public.tour_matching_profiles.storytelling_fit IS '1–5: guide narrative / story depth';
