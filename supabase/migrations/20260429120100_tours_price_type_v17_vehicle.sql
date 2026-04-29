-- =============================================================================
-- v17 batch — tours.price_type accept "vehicle"
-- =============================================================================
-- Private car charter SKUs (e.g. busan-private-car-charter-cruise-shore,
-- jeju-island-private-car-charter-tour, seoul-suburbs-private-chartered-car-10hr,
-- incheon-seoul-private-car-shore-excursion-cruise) price per VEHICLE rather
-- than per person/group. Extend `tours_price_type_check` so the seeded value
-- from `<slug>.en.json#price.per` flows in unmapped (per the v17 directive:
-- generator must NOT normalize enum values).
-- =============================================================================

ALTER TABLE public.tours DROP CONSTRAINT IF EXISTS tours_price_type_check;
ALTER TABLE public.tours
  ADD CONSTRAINT tours_price_type_check
  CHECK (price_type = ANY (ARRAY['person'::text, 'group'::text, 'vehicle'::text]));

COMMENT ON COLUMN public.tours.price_type IS
  'Per-pricing unit. v17 batch: person | group | vehicle. Source: <slug>.en.json#price.per (no generator-side mapping).';
