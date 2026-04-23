-- ============================================================
-- 01 / Drop dead tables (pre-launch reset)
-- ============================================================
--
-- Scope: remove tables tied to features that were deleted from the
-- codebase on 2026-04-22 (itinerary parser, places ingestion,
-- tour-mode, bus tours, custom-join-tour). Live tables are NOT
-- touched here; this script only drops the ones no code references.
--
-- All DROPs are idempotent (IF EXISTS) and use CASCADE so dependent
-- indexes / FKs / policies disappear alongside.
--
-- BEFORE YOU RUN: take a Supabase Dashboard snapshot (Project > Database
-- > Backups > Create manual backup) so this step is recoverable.
-- ============================================================

BEGIN;

-- --- Parser / natural-language intent pipeline ----------------
DROP TABLE IF EXISTS public.parsed_intent_cache CASCADE;
DROP TABLE IF EXISTS public.request_parse_logs CASCADE;
DROP TABLE IF EXISTS public.request_profiles CASCADE;

-- --- Itinerary generation / reuse -----------------------------
DROP TABLE IF EXISTS public.itinerary_generation_logs CASCADE;
DROP TABLE IF EXISTS public.itinerary_runs CASCADE;
DROP TABLE IF EXISTS public.itinerary_templates CASCADE;
DROP TABLE IF EXISTS public.saved_itineraries CASCADE;

-- --- POI / Places ingestion + recommendation features ---------
DROP TABLE IF EXISTS public.poi_reco_features CASCADE;
DROP TABLE IF EXISTS public.jeju_kor_tourapi_places CASCADE;
DROP TABLE IF EXISTS public.places CASCADE;

-- --- Travel-time caches ---------------------------------------
DROP TABLE IF EXISTS public.endpoint_travel_cache CASCADE;
DROP TABLE IF EXISTS public.travel_time_edges CASCADE;

-- --- Tour add-on surfaces (bus / guide / facilities) ---------
DROP TABLE IF EXISTS public.tour_bus_details CASCADE;
DROP TABLE IF EXISTS public.tour_guide_spots CASCADE;
DROP TABLE IF EXISTS public.tour_facilities CASCADE;

-- --- Custom-join-tour feature (proposed plans) ----------------
DROP TABLE IF EXISTS public.proposed_tours CASCADE;

-- --- Tour-mode (guest day-of app) -----------------------------
-- tour_mode_* tables from legacy migration `tour_mode_schema.sql`,
-- if they exist. Names are a superset; IF EXISTS covers unused ones.
DROP TABLE IF EXISTS public.tour_mode_sessions CASCADE;
DROP TABLE IF EXISTS public.tour_mode_events CASCADE;
DROP TABLE IF EXISTS public.tour_mode_checkins CASCADE;

-- --- Orphan functions / views, if present --------------------
DROP FUNCTION IF EXISTS public.get_poi_candidates_rain_aware(text, double precision, double precision, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.get_poi_candidates_rain_aware CASCADE;

COMMIT;

-- ============================================================
-- Verification (read-only). Run after COMMIT to confirm cleanup.
-- ============================================================
-- SELECT table_schema, table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
