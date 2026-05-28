-- Phase 10 — extend bookings for itinerary-builder flow.
-- See docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md §C D16/D17.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'tour_product',
  ADD COLUMN IF NOT EXISTS itinerary jsonb;

CREATE INDEX IF NOT EXISTS bookings_source_idx ON public.bookings(source);
CREATE INDEX IF NOT EXISTS bookings_itinerary_gin_idx
  ON public.bookings USING gin(itinerary) WHERE itinerary IS NOT NULL;

COMMENT ON COLUMN public.bookings.currency IS
  'ISO 4217. usd for legacy tour-product bookings; krw for itinerary-builder. /api/stripe/checkout + webhook branch on this.';
COMMENT ON COLUMN public.bookings.source IS
  'Origin flow: tour_product (standard /tour-product/[slug] booking) | itinerary_builder (no tour_id, has itinerary jsonb).';
COMMENT ON COLUMN public.bookings.itinerary IS
  'Builder payload: { poi_keys, region, track, duration_hours, guide_language, jeju_pickup_zone, cruise_port, breakdown, vehicle, tier }. NULL for tour-product rows.';
