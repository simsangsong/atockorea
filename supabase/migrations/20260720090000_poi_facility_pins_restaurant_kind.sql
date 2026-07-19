-- Facility pins: add the 'restaurant' kind + rating/review_count.
-- (Track: docs/tour-room-facility-pins-master-plan-2026-07-19.md — restaurant extension)
--
-- Restaurants are recommended around a POI ranked by rating × review volume.
-- Kakao Local has no rating field, so restaurants come from Google Places (New)
-- (rating + userRatingCount); restrooms stay on Kakao. Same POI-scoped map card.

ALTER TABLE public.poi_facility_pins DROP CONSTRAINT poi_facility_pins_kind_check;
ALTER TABLE public.poi_facility_pins
  ADD CONSTRAINT poi_facility_pins_kind_check CHECK (kind IN ('restroom', 'photo', 'restaurant'));

ALTER TABLE public.poi_facility_pins ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE public.poi_facility_pins ADD COLUMN IF NOT EXISTS review_count integer;

COMMENT ON COLUMN public.poi_facility_pins.rating IS 'Provider rating 0-5 (restaurants; null for restroom/photo).';
COMMENT ON COLUMN public.poi_facility_pins.review_count IS 'Provider review count (restaurants).';
