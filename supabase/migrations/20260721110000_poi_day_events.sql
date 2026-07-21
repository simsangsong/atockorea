-- A4 — per-day POI event status (docs/smart-guide-ops-detail-audit-2026-07-21.md).
--
-- "Is the haenyeo show running TODAY?" — until now only static authoring
-- (ItineraryStopAlternate) could say "if cancelled → alt venue". This adds the
-- live per-day answer: the operator confirms on/off with one tap in the
-- arrival sheet, guests see the citation line on the bundle card.
--
-- Generalized (user-decision default 2026-07-21, conservative): any POI can
-- carry ONE recurring headline event. The event's NAME is sticky per POI
-- (tour_poi_arrival_profiles.event_label — e.g. "해녀 공연 14:00"); the per-day
-- on/off lives here, keyed by date. RLS on, no anon policies (service role).

ALTER TABLE public.tour_poi_arrival_profiles
  ADD COLUMN IF NOT EXISTS event_label text,
  ADD COLUMN IF NOT EXISTS event_label_i18n jsonb;

CREATE TABLE IF NOT EXISTS public.poi_day_events (
  poi_key      text NOT NULL,
  event_date   date NOT NULL,
  status       text NOT NULL CHECK (status IN ('on', 'off')),
  label        text,           -- snapshot of the profile label at confirm time
  set_by_role  text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poi_key, event_date)
);

ALTER TABLE public.poi_day_events ENABLE ROW LEVEL SECURITY;
