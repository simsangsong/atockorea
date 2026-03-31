-- ============================================================
-- Parser-first + SQL-first Jeju itinerary architecture
-- Side-table foundation (search / reco / parser / request / run)
--
-- Repo reality:
--   Base POI table : public.jeju_kor_tourapi_places  (BIGINT id)
--   External key   : content_id TEXT NOT NULL
--   No public.pois, no title_en/zh/ja, no is_rainy_day_ok
--   rainy_day_score NUMERIC exists (used in bootstrap)
--   itinerary_generation_logs.id is BIGINT (referenced by itinerary_runs)
--   pgvector already installed (not used here; deferred to next step)
--
-- Deferred to second migration:
--   poi_operational_guide, poi_display_content
--   pgvector embedding columns on side tables
-- ============================================================

begin;

-- ── shared extensions ────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ── shared updated_at trigger function ───────────────────────
-- Named generically; does not conflict with the base table's
-- set_jeju_kor_tourapi_places_updated_at() function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── search document refresh trigger function ─────────────────
-- Fires before insert/update on poi_search_profile.
-- Rebuilds search_text from component fields, then
-- recomputes the tsvector search_document from search_text.
create or replace function public.refresh_poi_search_document()
returns trigger
language plpgsql
as $$
declare
  _tags      text;
  _vibe_tags text;
  _combined  text;
begin
  _tags      := array_to_string(coalesce(new.tags,      '{}'::text[]), ' ');
  _vibe_tags := array_to_string(coalesce(new.vibe_tags, '{}'::text[]), ' ');

  _combined := trim(
    concat_ws(
      ' ',
      coalesce(new.display_name,  ''),
      coalesce(new.region,        ''),
      coalesce(new.subregion,     ''),
      coalesce(new.summary_line,  ''),
      _tags,
      _vibe_tags,
      coalesce(new.search_text,   '')
    )
  );

  -- Only overwrite search_text when the trigger is rebuilding from
  -- component fields (i.e. the caller did not set search_text directly).
  -- We always recompute search_document from the final search_text.
  new.search_text     := nullif(_combined, '');
  new.search_document := to_tsvector('simple', coalesce(new.search_text, ''));

  return new;
end;
$$;

-- ============================================================
-- A. SEARCH / RECOMMENDATION CORE
-- ============================================================

-- ── A1. poi_search_profile ───────────────────────────────────
-- Lean search/filter fields only.
-- FK → jeju_kor_tourapi_places(id); content_id mirrored for
-- human-readable joins without text FK fragility.
create table if not exists public.poi_search_profile (
  poi_id                   bigint      primary key
                             references public.jeju_kor_tourapi_places(id)
                             on delete cascade,
  content_id               text        not null,
  locale                   text        not null default 'ko',
  display_name             text,
  region                   text,
  subregion                text,
  tags                     text[]      not null default '{}'::text[],
  vibe_tags                text[]      not null default '{}'::text[],
  summary_line             text,
  recommended_stay_minutes integer,
  walking_difficulty       text        check (
                             walking_difficulty is null
                             or walking_difficulty in ('easy', 'moderate', 'hard')
                           ),
  indoor_outdoor           text        check (
                             indoor_outdoor is null
                             or indoor_outdoor in ('indoor', 'outdoor', 'mixed')
                           ),
  toilet_available         boolean,
  quick_photo_stop_ok      boolean,
  -- search_text is the denormalised plain-text blob used for trgm search.
  -- search_document is the tsvector derived from search_text.
  -- Both are maintained by the refresh_poi_search_document trigger.
  search_text              text,
  search_document          tsvector,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── A2. poi_reco_features ────────────────────────────────────
-- Scoring signals used for SQL-first candidate ranking only.
-- All scores are 0.0 – 1.0 normalised (or 0–100 for base_rank_score).
create table if not exists public.poi_reco_features (
  poi_id               bigint      primary key
                         references public.jeju_kor_tourapi_places(id)
                         on delete cascade,
  content_id           text        not null,
  base_rank_score      numeric(8,3) not null default 0,
  iconic_score         numeric(8,3) not null default 0,
  hidden_gem_score     numeric(8,3) not null default 0,
  first_timer_score    numeric(8,3) not null default 0,
  revisit_score        numeric(8,3) not null default 0,
  senior_score         numeric(8,3) not null default 0,
  family_score         numeric(8,3) not null default 0,
  rain_fallback_score  numeric(8,3) not null default 0,
  indoor_score         numeric(8,3) not null default 0,
  quick_stop_score     numeric(8,3) not null default 0,
  photo_score          numeric(8,3) not null default 0,
  nature_score         numeric(8,3) not null default 0,
  culture_score        numeric(8,3) not null default 0,
  food_score           numeric(8,3) not null default 0,
  cafe_score           numeric(8,3) not null default 0,
  shopping_score       numeric(8,3) not null default 0,
  kdrama_score         numeric(8,3) not null default 0,
  kpop_score           numeric(8,3) not null default 0,
  overly_touristy_score numeric(8,3) not null default 0,
  morning_score        numeric(8,3) not null default 0,
  sunset_score         numeric(8,3) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── A3. travel_time_edges ────────────────────────────────────
-- Cache-first travel time store.
-- provider: 'haversine' (current), 'kakao' (future server-side only).
-- time_bucket: traffic period.
-- source_type: estimated = haversine, live = fresh API, cached = stored API.
create table if not exists public.travel_time_edges (
  from_poi_id      bigint      not null
                     references public.jeju_kor_tourapi_places(id)
                     on delete cascade,
  to_poi_id        bigint      not null
                     references public.jeju_kor_tourapi_places(id)
                     on delete cascade,
  from_content_id  text        not null,
  to_content_id    text        not null,
  provider         text        not null default 'haversine',
  time_bucket      text        not null default 'midday'
                     check (time_bucket in ('am_peak', 'midday', 'pm_peak', 'weekend')),
  duration_minutes integer,
  distance_meters  integer,
  polyline_summary jsonb,
  source_type      text        not null default 'estimated'
                     check (source_type in ('estimated', 'live', 'cached')),
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (from_poi_id, to_poi_id, provider, time_bucket)
);

-- ============================================================
-- B. REQUEST / RUN PERSISTENCE
-- ============================================================

-- ── B1. request_profiles ────────────────────────────────────
-- Persisted structured output from the parser step.
-- parser_confidence, parse_source, unmatched_terms, parse_debug
-- are mandatory for auditability (Rule 12/13).
create table if not exists public.request_profiles (
  id                      uuid        primary key default gen_random_uuid(),
  raw_text                text        not null,
  normalized_query_text   text,
  locale                  text        not null default 'ko',
  -- geographic preference
  region_preference       text,
  subregion_preference    text,
  -- traveller profile
  with_seniors            boolean,
  with_children           boolean,
  age_band                text,
  group_type              text,
  max_walking_level       text,
  -- interest priorities (integer 0–10; null = not specified)
  photo_priority          integer,
  first_visit             boolean,
  iconic_spot_priority    integer,
  hidden_gem_priority     integer,
  avoid_overly_touristy   boolean,
  need_indoor_if_rain     boolean,
  nature_priority         integer,
  culture_priority        integer,
  food_priority           integer,
  cafe_priority           integer,
  shopping_priority       integer,
  kdrama_priority         integer,
  kpop_priority           integer,
  -- logistics
  long_drive_tolerance    integer,
  quick_photo_mode        boolean,
  morning_preference      boolean,
  sunset_preference       boolean,
  nationality_preference  text,
  pickup_area             text,
  trip_length_minutes     integer,
  -- parser metadata (Rule 12: always persist these)
  parser_confidence       numeric(6,3),
  parse_source            text,
  unmatched_terms         text[]      not null default '{}'::text[],
  structured_slots        jsonb       not null default '{}'::jsonb,
  parse_debug             jsonb       not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── B2. itinerary_templates ──────────────────────────────────
-- Reusable successful POI sequences for warm-start candidate ranking.
create table if not exists public.itinerary_templates (
  id                   uuid        primary key default gen_random_uuid(),
  title                text,
  use_case             text,
  region               text,
  poi_sequence         jsonb       not null default '[]'::jsonb,
  constraints_snapshot jsonb       not null default '{}'::jsonb,
  score                numeric(8,2),
  usage_count          integer     not null default 0,
  booking_count        integer     not null default 0,
  active               boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── B3. itinerary_runs ───────────────────────────────────────
-- Final POI sequence + route summary for every generation run.
-- References itinerary_generation_logs(id) (BIGINT PK confirmed).
-- References request_profiles(id) (UUID).
-- References itinerary_templates(id) (UUID, optional warm-start).
create table if not exists public.itinerary_runs (
  id                       uuid        primary key default gen_random_uuid(),
  request_profile_id       uuid        references public.request_profiles(id)
                             on delete set null,
  template_id              uuid        references public.itinerary_templates(id)
                             on delete set null,
  generation_log_id        bigint      references public.itinerary_generation_logs(id)
                             on delete set null,
  final_poi_sequence       jsonb       not null default '[]'::jsonb,
  route_summary            jsonb       not null default '{}'::jsonb,
  was_edited               boolean     not null default false,
  was_booked               boolean     not null default false,
  user_feedback_score      numeric(8,2),
  operator_note            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- C. PARSER DICTIONARY / LOGS
-- ============================================================

-- ── C1. request_intent_catalog ───────────────────────────────
-- Master registry of all intent keys and their slot mappings.
create table if not exists public.request_intent_catalog (
  id             bigserial   primary key,
  intent_key     text        not null unique,
  slot_key       text        not null,
  slot_type      text        not null,
  description    text,
  allowed_values jsonb,
  default_weight numeric(8,2),
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── C2. request_phrase_rules ─────────────────────────────────
-- Deterministic phrase → slot rules (exact / contains / regex).
create table if not exists public.request_phrase_rules (
  id          bigserial   primary key,
  locale      text        not null default 'ko',
  pattern     text        not null,
  match_type  text        not null
                check (match_type in ('exact', 'contains', 'regex')),
  intent_key  text        not null,
  slot_key    text        not null,
  slot_value  jsonb       not null,
  confidence  numeric(6,3) not null default 0.950,
  priority    integer     not null default 100,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── C3. request_synonym_groups ───────────────────────────────
-- Synonym clusters that map to a canonical slot value.
create table if not exists public.request_synonym_groups (
  id               bigserial   primary key,
  locale           text        not null default 'ko',
  group_key        text        not null,
  intent_key       text        not null,
  slot_key         text        not null,
  canonical_phrase text,
  phrases          text[]      not null default '{}'::text[],
  slot_value       jsonb       not null,
  confidence       numeric(6,3) not null default 0.850,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── C4. request_intent_examples ──────────────────────────────
-- Labelled examples for similarity-based intent matching
-- (pgvector embeddings deferred to next migration).
create table if not exists public.request_intent_examples (
  id           bigserial   primary key,
  locale       text        not null default 'ko',
  intent_key   text        not null,
  example_text text        not null,
  slot_key     text        not null,
  slot_value   jsonb       not null,
  confidence   numeric(6,3) not null default 0.750,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── C5. request_parse_logs ───────────────────────────────────
-- Per-request stage-by-stage parser output for auditability.
create table if not exists public.request_parse_logs (
  id                   uuid        primary key default gen_random_uuid(),
  request_profile_id   uuid        references public.request_profiles(id)
                         on delete set null,
  raw_text             text        not null,
  locale               text        not null default 'ko',
  stage1_rule_result   jsonb,
  stage2_synonym_result jsonb,
  stage3_similarity_result jsonb,
  stage4_llm_result    jsonb,
  merged_result        jsonb,
  parser_confidence    numeric(6,3),
  unmatched_terms      text[]      not null default '{}'::text[],
  parse_source         text,
  created_at           timestamptz not null default now()
  -- no updated_at: parse logs are append-only
);

-- ============================================================
-- INDEXES
-- ============================================================

-- poi_search_profile
create index if not exists idx_poi_search_profile_content_id
  on public.poi_search_profile(content_id);
create index if not exists idx_poi_search_profile_locale
  on public.poi_search_profile(locale);
create index if not exists idx_poi_search_profile_region
  on public.poi_search_profile(region);
create index if not exists idx_poi_search_profile_subregion
  on public.poi_search_profile(subregion);
create index if not exists idx_poi_search_profile_tags_gin
  on public.poi_search_profile using gin(tags);
create index if not exists idx_poi_search_profile_vibe_tags_gin
  on public.poi_search_profile using gin(vibe_tags);
create index if not exists idx_poi_search_profile_search_text_trgm
  on public.poi_search_profile using gin(search_text gin_trgm_ops);
create index if not exists idx_poi_search_profile_search_document
  on public.poi_search_profile using gin(search_document);

-- poi_reco_features
create index if not exists idx_poi_reco_features_content_id
  on public.poi_reco_features(content_id);

-- travel_time_edges
create index if not exists idx_travel_time_edges_from
  on public.travel_time_edges(from_poi_id);
create index if not exists idx_travel_time_edges_to
  on public.travel_time_edges(to_poi_id);
create index if not exists idx_travel_time_edges_provider_bucket
  on public.travel_time_edges(provider, time_bucket);

-- request_profiles
create index if not exists idx_request_profiles_locale
  on public.request_profiles(locale);
create index if not exists idx_request_profiles_region
  on public.request_profiles(region_preference);
create index if not exists idx_request_profiles_pickup_area
  on public.request_profiles(pickup_area);

-- itinerary_runs
create index if not exists idx_itinerary_runs_request_profile_id
  on public.itinerary_runs(request_profile_id);
create index if not exists idx_itinerary_runs_generation_log_id
  on public.itinerary_runs(generation_log_id);

-- parser dictionary
create index if not exists idx_request_phrase_rules_locale_intent
  on public.request_phrase_rules(locale, intent_key);
create index if not exists idx_request_synonym_groups_locale_group
  on public.request_synonym_groups(locale, group_key);
create index if not exists idx_request_intent_examples_locale_intent
  on public.request_intent_examples(locale, intent_key);
create index if not exists idx_request_parse_logs_request_profile_id
  on public.request_parse_logs(request_profile_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

drop trigger if exists trg_poi_search_profile_updated_at
  on public.poi_search_profile;
create trigger trg_poi_search_profile_updated_at
  before update on public.poi_search_profile
  for each row execute function public.set_updated_at();

-- search document trigger fires on both insert and update so that
-- bootstrap inserts also populate search_document immediately.
drop trigger if exists trg_poi_search_profile_search_document
  on public.poi_search_profile;
create trigger trg_poi_search_profile_search_document
  before insert or update on public.poi_search_profile
  for each row execute function public.refresh_poi_search_document();

drop trigger if exists trg_poi_reco_features_updated_at
  on public.poi_reco_features;
create trigger trg_poi_reco_features_updated_at
  before update on public.poi_reco_features
  for each row execute function public.set_updated_at();

drop trigger if exists trg_travel_time_edges_updated_at
  on public.travel_time_edges;
create trigger trg_travel_time_edges_updated_at
  before update on public.travel_time_edges
  for each row execute function public.set_updated_at();

drop trigger if exists trg_request_profiles_updated_at
  on public.request_profiles;
create trigger trg_request_profiles_updated_at
  before update on public.request_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_itinerary_templates_updated_at
  on public.itinerary_templates;
create trigger trg_itinerary_templates_updated_at
  before update on public.itinerary_templates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_itinerary_runs_updated_at
  on public.itinerary_runs;
create trigger trg_itinerary_runs_updated_at
  before update on public.itinerary_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_request_intent_catalog_updated_at
  on public.request_intent_catalog;
create trigger trg_request_intent_catalog_updated_at
  before update on public.request_intent_catalog
  for each row execute function public.set_updated_at();

drop trigger if exists trg_request_phrase_rules_updated_at
  on public.request_phrase_rules;
create trigger trg_request_phrase_rules_updated_at
  before update on public.request_phrase_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_request_synonym_groups_updated_at
  on public.request_synonym_groups;
create trigger trg_request_synonym_groups_updated_at
  before update on public.request_synonym_groups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_request_intent_examples_updated_at
  on public.request_intent_examples;
create trigger trg_request_intent_examples_updated_at
  before update on public.request_intent_examples
  for each row execute function public.set_updated_at();

-- ============================================================
-- BOOTSTRAP: initialize side tables from jeju_kor_tourapi_places
--
-- Uses dynamic SQL (DO $$ block) so the bootstrap is safe regardless
-- of which prior scoring/admin migrations have been applied.
-- Each optional column is checked via pg_attribute before use;
-- if absent, a safe literal default is substituted.
--
-- Guaranteed base columns (from 20250322150000):
--   id, content_id, title, addr1, addr2
--
-- Optional columns (from later migrations):
--   manual_hidden        (20250322170000)
--   is_indoor, is_outdoor (20250322170000)
--   base_score, data_quality_score, manual_priority (20250322170000)
--   rainy_day_score, photo_score, senior_score, family_score (20250322170000)
--   recommended_duration_min (20250323120000)
--   manual_boost_score   (20250325120000)
-- ============================================================

do $$
declare
  _has_manual_hidden        boolean;
  _has_is_indoor            boolean;
  _has_is_outdoor           boolean;
  _has_recommended_duration boolean;
  _has_base_score           boolean;
  _has_data_quality_score   boolean;
  _has_manual_priority      boolean;
  _has_manual_boost_score   boolean;
  _has_rainy_day_score      boolean;
  _has_photo_score          boolean;
  _has_senior_score         boolean;
  _has_family_score         boolean;

begin
  -- Inline pg_attribute checks (nested functions not allowed in DO blocks)
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='manual_hidden'        and a.attnum>0 and not a.attisdropped) into _has_manual_hidden;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='is_indoor'             and a.attnum>0 and not a.attisdropped) into _has_is_indoor;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='is_outdoor'            and a.attnum>0 and not a.attisdropped) into _has_is_outdoor;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='recommended_duration_min' and a.attnum>0 and not a.attisdropped) into _has_recommended_duration;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='base_score'            and a.attnum>0 and not a.attisdropped) into _has_base_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='data_quality_score'    and a.attnum>0 and not a.attisdropped) into _has_data_quality_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='manual_priority'       and a.attnum>0 and not a.attisdropped) into _has_manual_priority;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='manual_boost_score'    and a.attnum>0 and not a.attisdropped) into _has_manual_boost_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='rainy_day_score'       and a.attnum>0 and not a.attisdropped) into _has_rainy_day_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='photo_score'           and a.attnum>0 and not a.attisdropped) into _has_photo_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='senior_score'          and a.attnum>0 and not a.attisdropped) into _has_senior_score;
  select exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='jeju_kor_tourapi_places' and a.attname='family_score'          and a.attnum>0 and not a.attisdropped) into _has_family_score;

  -- ── Bootstrap A1: poi_search_profile ───────────────────────
  execute format(
    $sql$
    insert into public.poi_search_profile (
      poi_id, content_id, locale, display_name,
      region, subregion, tags, vibe_tags, summary_line,
      recommended_stay_minutes, walking_difficulty, indoor_outdoor,
      toilet_available, quick_photo_stop_ok, search_text
    )
    select
      p.id,
      p.content_id,
      'ko',
      nullif(trim(coalesce(p.title, '')), ''),
      null,   -- region: filled by operators
      null,   -- subregion: filled by operators
      '{}'::text[],
      '{}'::text[],
      null,   -- summary_line: filled by operators
      %s,     -- recommended_stay_minutes
      'moderate',
      %s,     -- indoor_outdoor
      null,   -- toilet_available
      false,
      nullif(trim(concat_ws(' ',
        coalesce(p.title, ''),
        coalesce(p.addr1, ''),
        coalesce(p.addr2, '')
      )), '')
    from public.jeju_kor_tourapi_places p
    where %s
    on conflict (poi_id) do update set
      content_id               = excluded.content_id,
      display_name             = excluded.display_name,
      recommended_stay_minutes = excluded.recommended_stay_minutes,
      indoor_outdoor           = excluded.indoor_outdoor,
      search_text              = excluded.search_text,
      updated_at               = now()
    $sql$,
    -- recommended_stay_minutes
    case when _has_recommended_duration
      then 'coalesce(p.recommended_duration_min, 60)'
      else '60'
    end,
    -- indoor_outdoor
    case when _has_is_indoor and _has_is_outdoor then
      $expr$case
        when coalesce(p.is_indoor,false) and coalesce(p.is_outdoor,false) then 'mixed'
        when coalesce(p.is_indoor,false) then 'indoor'
        when coalesce(p.is_outdoor,false) then 'outdoor'
        else null
      end$expr$
    when _has_is_indoor then
      $expr$case when coalesce(p.is_indoor,false) then 'indoor' else null end$expr$
    else 'null'
    end,
    -- where clause
    case when _has_manual_hidden
      then 'coalesce(p.manual_hidden, false) = false'
      else 'true'
    end
  );

  -- ── Bootstrap A2: poi_reco_features ────────────────────────
  execute format(
    $sql$
    insert into public.poi_reco_features (
      poi_id, content_id,
      base_rank_score, iconic_score, hidden_gem_score,
      first_timer_score, revisit_score,
      senior_score, family_score, rain_fallback_score,
      indoor_score, quick_stop_score, photo_score,
      nature_score, culture_score, food_score, cafe_score,
      shopping_score, kdrama_score, kpop_score,
      overly_touristy_score, morning_score, sunset_score
    )
    select
      p.id,
      p.content_id,
      -- base_rank_score
      greatest(%s, 0),
      -- iconic_score
      least(greatest(%s / 100.0, 0), 1),
      -- hidden_gem_score
      %s,
      -- first_timer_score
      least(greatest(%s / 100.0, 0), 1),
      -- revisit_score
      least(greatest(%s / 100.0, 0), 1),
      -- senior_score
      least(greatest(%s / 100.0, 0), 1),
      -- family_score
      least(greatest(%s / 100.0, 0), 1),
      -- rain_fallback_score
      least(greatest(%s / 100.0, 0), 1),
      -- indoor_score
      %s,
      -- quick_stop_score
      0.30,
      -- photo_score
      least(greatest(%s / 100.0, 0), 1),
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      -- overly_touristy_score
      least(greatest(%s / 100.0, 0), 1),
      0.00, 0.00
    from public.jeju_kor_tourapi_places p
    where %s
    on conflict (poi_id) do update set
      content_id            = excluded.content_id,
      base_rank_score       = excluded.base_rank_score,
      iconic_score          = excluded.iconic_score,
      hidden_gem_score      = excluded.hidden_gem_score,
      first_timer_score     = excluded.first_timer_score,
      revisit_score         = excluded.revisit_score,
      senior_score          = excluded.senior_score,
      family_score          = excluded.family_score,
      rain_fallback_score   = excluded.rain_fallback_score,
      indoor_score          = excluded.indoor_score,
      photo_score           = excluded.photo_score,
      overly_touristy_score = excluded.overly_touristy_score,
      updated_at            = now()
    $sql$,
    -- base_rank_score expression
    concat_ws(' + ',
      case when _has_base_score         then 'coalesce(p.base_score,0)::numeric'          else '0' end,
      case when _has_data_quality_score then 'coalesce(p.data_quality_score,0)::numeric'  else '0' end,
      case when _has_manual_boost_score then 'coalesce(p.manual_boost_score,0)::numeric'  else '0' end,
      case when _has_manual_priority    then '(coalesce(p.manual_priority,0)::numeric*10)' else '0' end
    ),
    -- iconic_score numerator
    case when _has_manual_priority then 'coalesce(p.manual_priority,0)::numeric' else '0::numeric' end,
    -- hidden_gem_score expression
    case when _has_manual_priority then
      $expr$case
        when coalesce(p.manual_priority,0) >= 80 then 0.10
        when coalesce(p.manual_priority,0) >= 50 then 0.30
        else 0.60
      end$expr$
    else '0.60'
    end,
    -- first_timer_score numerator
    case when _has_base_score then 'coalesce(p.base_score,0)::numeric' else '0::numeric' end,
    -- revisit_score numerator
    case when _has_data_quality_score then 'coalesce(p.data_quality_score,0)::numeric' else '0::numeric' end,
    -- senior_score numerator
    case when _has_senior_score then 'coalesce(p.senior_score,0)::numeric' else '0::numeric' end,
    -- family_score numerator
    case when _has_family_score then 'coalesce(p.family_score,0)::numeric' else '0::numeric' end,
    -- rain_fallback_score numerator
    case when _has_rainy_day_score then 'coalesce(p.rainy_day_score,0)::numeric' else '0::numeric' end,
    -- indoor_score expression
    case when _has_is_indoor then 'case when coalesce(p.is_indoor,false) then 1.00 else 0.00 end'
         else '0.00'
    end,
    -- photo_score numerator
    case when _has_photo_score then 'coalesce(p.photo_score,0)::numeric' else '0::numeric' end,
    -- overly_touristy_score numerator
    case when _has_manual_priority then 'coalesce(p.manual_priority,0)::numeric' else '0::numeric' end,
    -- where clause
    case when _has_manual_hidden
      then 'coalesce(p.manual_hidden, false) = false'
      else 'true'
    end
  );

  raise notice 'Bootstrap complete. Columns detected: manual_hidden=%, is_indoor=%, is_outdoor=%, base_score=%, data_quality_score=%, manual_priority=%, manual_boost_score=%, rainy_day_score=%, photo_score=%, senior_score=%, family_score=%, recommended_duration_min=%',
    _has_manual_hidden, _has_is_indoor, _has_is_outdoor,
    _has_base_score, _has_data_quality_score, _has_manual_priority,
    _has_manual_boost_score, _has_rainy_day_score, _has_photo_score,
    _has_senior_score, _has_family_score, _has_recommended_duration;
end;
$$;

commit;
