-- Store per-locale rich POI stop content copied from static tour JSONs.
-- The existing match_pois.description/highlights/why_on_route columns remain
-- the English fallback; this object carries ko/ja/zh/zh-TW/es copies for the
-- itinerary builder catalog and detail drawer.

ALTER TABLE public.match_pois
  ADD COLUMN IF NOT EXISTS content_locales jsonb;

COMMENT ON COLUMN public.match_pois.content_locales IS
  'Per-locale POI stop content keyed by locale (ko, ja, zh, zh-TW, es; en optional). Copied 1:1 from product tour itineraryStops by _poi_meta.poi_key.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_pois_content_locales_object'
      AND conrelid = 'public.match_pois'::regclass
  ) THEN
    ALTER TABLE public.match_pois
      ADD CONSTRAINT match_pois_content_locales_object
      CHECK (content_locales IS NULL OR jsonb_typeof(content_locales) = 'object');
  END IF;
END $$;
