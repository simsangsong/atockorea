-- POI facility pins: per-attraction restroom / photo-spot map pins.
-- (Track: docs/tour-room-facility-pins-master-plan-2026-07-19.md, W0.1)
--
-- POI-GLOBAL reference data keyed by poi_key (a restroom near an attraction is
-- the same for every booking) — distinct from the room-scoped ephemeral
-- tour_room_pins (parking / lost-me). The Smart Guide concierge (Tier0) looks
-- these up by the current arrival spot's poi_key and answers "restroom?" /
-- "photo spot?" with a scoped inline map card.
--
-- Sources: restrooms are auto-collected from Google Places (source='places_auto',
-- is_verified=false until a human confirms); photo spots and all corrections are
-- curated in the admin editor (source='curated'). All manual add/edit/delete
-- flows through the admin API (service role) — RLS on, no anon policies, matching
-- the tour_room_* / match_pois families (clients never read this table directly;
-- the server injects the current spot's pins into the arrival event / snapshot).

CREATE TABLE IF NOT EXISTS public.poi_facility_pins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_key      text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('restroom', 'photo')),
  lat          numeric NOT NULL,
  lng          numeric NOT NULL,
  name         text,                         -- neutral / default display label
  name_i18n    jsonb,                         -- { en, ko, ja, es, zh } (optional, curated)
  photo_url    text,                          -- Phase 2 photo-thumbnail pins (optional)
  source       text NOT NULL DEFAULT 'curated'
                 CHECK (source IN ('places_auto', 'curated')),
  place_id     text,                          -- Places source id (auto dedupe / re-collect)
  distance_m   integer,                       -- metres from the attraction centre (sort / quality)
  is_verified  boolean NOT NULL DEFAULT false,-- human-confirmed (auto-collected start false)
  is_active    boolean NOT NULL DEFAULT true, -- soft delete
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Serving lookup: current spot's active pins by kind.
CREATE INDEX IF NOT EXISTS idx_poi_facility_pins_lookup
  ON public.poi_facility_pins (poi_key, kind, is_active);

-- Auto-collect re-runs are idempotent: one row per (poi, kind, place_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_facility_pins_place_uniq
  ON public.poi_facility_pins (poi_key, kind, place_id)
  WHERE place_id IS NOT NULL;

ALTER TABLE public.poi_facility_pins ENABLE ROW LEVEL SECURITY;
-- No anon policies: all reads/writes go through service-role API routes.

COMMENT ON TABLE public.poi_facility_pins IS
  'Per-attraction restroom/photo-spot map pins (poi_key global). Smart Guide facility-pins track.';
