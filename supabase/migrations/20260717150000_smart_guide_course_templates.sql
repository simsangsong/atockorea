-- Smart-guide private mode W1.1 — course_templates (master plan §C-1 migration ③, P-D14).
--
-- Recommended-course templates for the guest /plan editor's tab ①. Seeded
-- once from match_itinerary_stops + tours (see
-- supabase/manual/seed-course-templates-2026-07-17.sql) — the poi_key linking
-- that makes this cheap was already done by scripts/import-match-v18.mjs.
--
-- Service-role only (same posture as the tour_room_* tables): RLS enabled
-- with no policies; the /plan templates API authorizes via resolveRoomActor().

create table if not exists course_templates (
  id uuid primary key default gen_random_uuid(),
  region text not null,                      -- builder region slug: seoul | busan | jeju
  origin_tour_slug text unique,              -- provenance + idempotent re-seed key
  title_i18n jsonb not null default '{}',    -- { en, ko?, ... } (room 5-locale convention)
  stops jsonb not null default '[]',         -- §C-2 DayPlanStop-shaped array (seq/source/poi_key/title/duration_min/lat/lng)
  total_hours numeric,                       -- parsed from tours.duration ("9 hours" → 9)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_templates_region_idx
  on course_templates (region) where is_active;

alter table course_templates enable row level security;

comment on table course_templates is
  'Smart-guide /plan tab-① recommended courses, seeded from live tour itineraries (P-D14). Service-role only.';
