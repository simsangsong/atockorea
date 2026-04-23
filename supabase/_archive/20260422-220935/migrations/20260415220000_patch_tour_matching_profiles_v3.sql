-- =============================================================================
-- Patch tour_matching_profiles v3 — business corrections (3 Jeju small-group)
-- =============================================================================
-- Run after: 20260415210000_tour_matching_profiles_comfort_pricing.sql
-- Does NOT modify tours / tour_product_pages / tour_product_offers.
-- Idempotent: UPDATE by product_id only.
-- Source-of-truth note: see lib/tour-product-match/PROFILE_SOURCE.md
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.tour_matching_profiles
  WHERE product_id IN (
    'east-signature-nature-core',
    'southwest-hallasan-osulloc-aewol',
    'jeju-grand-highlights-loop'
  );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'patch_tour_matching_profiles_v3: expected 3 tour_matching_profiles rows, found %',
      v_count;
  END IF;
END $$;

-- 1) East: tone down local culture slightly; stricter indoor-preference signal
UPDATE public.tour_matching_profiles
SET
  local_culture_fit = 4,
  hard_constraints = '{
    "avoidIf": ["monday_departure_required", "tight_same_day_departure", "strictly_indoor_preference"],
    "notIdealFor": ["very_low_mobility", "stroller_heavy_if_summit_focus"]
  }'::jsonb,
  synonym_hints = '[
    "iconic east",
    "balanced day",
    "classic jeju east",
    "geology coast culture",
    "east volcano coast village",
    "first trip east jeju",
    "east coast highlights"
  ]'::jsonb,
  profile_version = 3,
  updated_at = NOW()
WHERE product_id = 'east-signature-nature-core';

-- 2) Southwest: slightly less harsh on mobility, slightly more premium; richer keywords
UPDATE public.tour_matching_profiles
SET
  mobility_friendly_fit = 3,
  premium_fit = 3,
  keywords = '[
    "southwest jeju",
    "southwest jeju small group",
    "hallasan trail",
    "jusangjeolli",
    "cheonjeyeon",
    "osulloc",
    "aewol",
    "tea museum",
    "southwest highlights",
    "balanced southwest day tour"
  ]'::jsonb,
  synonym_hints = '[
    "balanced southwest",
    "tea and coast finish",
    "hallasan and tea",
    "waterfall tea coast",
    "scenic southwest"
  ]'::jsonb,
  profile_version = 3,
  updated_at = NOW()
WHERE product_id = 'southwest-hallasan-osulloc-aewol';

-- 3) Grand loop: reduce overmatching for flight/cafe/family/senior; tighter same-day signals
UPDATE public.tour_matching_profiles
SET
  family_fit = 2,
  senior_fit = 2,
  same_day_flight_fit = 1,
  cafe_fit = 2,
  senior_general_fit = 2,
  premium_fit = 3,
  hard_constraints = '{
    "avoidIf": ["needs_slow_pace", "tight_same_day_departure", "strict_same_day_flight_schedule"],
    "notIdealFor": ["stroller_heavy", "very_low_mobility", "toddlers", "cafe_relax_focused_day"]
  }'::jsonb,
  keywords = '[
    "jeju one day",
    "jeju full island loop",
    "hallasan",
    "seongsan",
    "jusangjeolli",
    "jeongbang",
    "grand tour jeju",
    "see a lot in one day",
    "fast paced jeju",
    "jeju highlights"
  ]'::jsonb,
  synonym_hints = '[
    "full island loop",
    "highlights in one day",
    "busy but iconic",
    "see more in one day",
    "fast highlights route"
  ]'::jsonb,
  profile_version = 3,
  updated_at = NOW()
WHERE product_id = 'jeju-grand-highlights-loop';

COMMIT;

-- Verification
SELECT
  product_id,
  family_fit,
  senior_fit,
  same_day_flight_fit,
  cafe_fit,
  mobility_friendly_fit,
  local_culture_fit,
  premium_fit,
  profile_version
FROM public.tour_matching_profiles
WHERE product_id IN (
  'east-signature-nature-core',
  'southwest-hallasan-osulloc-aewol',
  'jeju-grand-highlights-loop'
)
ORDER BY product_id;
