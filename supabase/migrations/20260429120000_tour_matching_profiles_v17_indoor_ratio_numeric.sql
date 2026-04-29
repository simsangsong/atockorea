-- =============================================================================
-- v17 batch — indoor_ratio: smallint → numeric
-- =============================================================================
-- Authoring JSONs in `all_tours_v17/` ship indoor_ratio as a 0..1 float (e.g.
-- 0.32). Legacy seeds used 0..100 integer. Promote the column to NUMERIC so
-- both forms persist losslessly; runtime norm in
-- `lib/tour-product-match/score-tour-products.ts#normIndoorRatioPercent`
-- auto-detects scale at read time (value > 1 → /100; otherwise pass-through).
--
-- Idempotent: ALTER COLUMN ... TYPE numeric is a no-op if already numeric.
-- =============================================================================

ALTER TABLE public.tour_matching_profiles
  ALTER COLUMN indoor_ratio TYPE numeric USING indoor_ratio::numeric;

COMMENT ON COLUMN public.tour_matching_profiles.indoor_ratio IS
  'Approximate indoor / sheltered share. v17 batch: 0..1 float (preferred). Legacy 0..100 int values still accepted; runtime norm in score-tour-products.ts auto-detects scale.';
