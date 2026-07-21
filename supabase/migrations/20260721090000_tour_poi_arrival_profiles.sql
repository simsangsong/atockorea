-- A0 — arrival one-tap bundle: per-POI sticky "arrival profile".
-- (Track: docs/smart-guide-ops-detail-audit-2026-07-21.md, TIER A / A0)
--
-- The solo join-tour lead (bus safety staff / Solati driver) fires ONE tap on
-- arrival; everything about the stop that never changes day-to-day lives here
-- (follow-the-staff vs free visit, ticket-purchase step, viewing-route note,
-- an optional named meeting point). The only per-day variables are the meeting
-- TIME and the parking PIN, entered in the cockpit sheet (user decision
-- 2026-07-21). Sticky defaults: the sheet's toggles persist back here on send,
-- so the profile self-builds with use — no separate admin editor needed (v1).
--
-- POI-GLOBAL reference data (like poi_facility_pins): RLS on, no anon
-- policies — all reads/writes go through the server routes (service role).

CREATE TABLE IF NOT EXISTS public.tour_poi_arrival_profiles (
  poi_key            text PRIMARY KEY,
  follow_mode        text NOT NULL DEFAULT 'free'
                       CHECK (follow_mode IN ('follow', 'free')),
  ticket_required    boolean NOT NULL DEFAULT false,
  route_note         text,          -- operator-typed Korean viewing-route note
  route_note_i18n    jsonb,         -- { en, ko, ja, es, zh } (translated on save, R-6 verbatim fallback)
  meeting_point      text,          -- optional named gather point ("정문 앞"); null → "the vehicle"
  meeting_point_i18n jsonb,
  updated_by_role    text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tour_poi_arrival_profiles ENABLE ROW LEVEL SECURITY;
