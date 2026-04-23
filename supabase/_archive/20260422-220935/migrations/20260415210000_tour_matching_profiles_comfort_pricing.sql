-- =============================================================================
-- tour_matching_profiles — comfort / format / price positioning
-- =============================================================================
-- Numeric fits: 1–5. price_band: coarse commercial band (e.g. budget | mid | premium).
-- =============================================================================

ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS comfort_level SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS budget_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS premium_fit SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS small_group_fit SMALLINT NOT NULL DEFAULT 5;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS private_fit SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS bus_fit SMALLINT NOT NULL DEFAULT 2;
ALTER TABLE public.tour_matching_profiles ADD COLUMN IF NOT EXISTS price_band TEXT NOT NULL DEFAULT 'mid';

COMMENT ON COLUMN public.tour_matching_profiles.comfort_level IS '1–5: overall pacing/vehicle comfort vs intensity';
COMMENT ON COLUMN public.tour_matching_profiles.budget_fit IS '1–5: fit for budget-minded travelers';
COMMENT ON COLUMN public.tour_matching_profiles.premium_fit IS '1–5: fit for premium/luxury expectations';
COMMENT ON COLUMN public.tour_matching_profiles.small_group_fit IS '1–5: fit for small-group van format';
COMMENT ON COLUMN public.tour_matching_profiles.private_fit IS '1–5: fit for private-tour expectations (usually low for shared tours)';
COMMENT ON COLUMN public.tour_matching_profiles.bus_fit IS '1–5: fit for large-bus style (usually low for van tours)';
COMMENT ON COLUMN public.tour_matching_profiles.price_band IS 'Coarse price tier label: budget | mid | premium';
