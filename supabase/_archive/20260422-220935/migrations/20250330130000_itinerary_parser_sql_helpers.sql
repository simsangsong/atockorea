-- ============================================================
-- SQL helper functions for parser-first + SQL-first itinerary
-- architecture (Step 2 — read-only RPC helpers + candidate query)
--
-- All functions are STABLE (no writes, safe for Supabase RPC).
-- No SELECT * used anywhere.
-- Depends on tables created in 20250330120000_itinerary_parser_schema.sql
-- ============================================================

begin;

-- ── get_active_phrase_rules ───────────────────────────────────
-- Returns active phrase → slot rules for the given locale,
-- ordered by priority ASC then id ASC (lower priority number = higher precedence).
create or replace function public.get_active_phrase_rules(
  p_locale text default 'ko'
)
returns table (
  id         bigint,
  locale     text,
  pattern    text,
  match_type text,
  intent_key text,
  slot_key   text,
  slot_value jsonb,
  confidence numeric,
  priority   integer
)
language sql
stable
as $$
  select
    r.id,
    r.locale,
    r.pattern,
    r.match_type,
    r.intent_key,
    r.slot_key,
    r.slot_value,
    r.confidence,
    r.priority
  from public.request_phrase_rules r
  where r.is_active = true
    and r.locale = coalesce(p_locale, 'ko')
  order by r.priority asc, r.id asc;
$$;

-- ── get_active_synonym_groups ─────────────────────────────────
-- Returns active synonym groups for the given locale.
create or replace function public.get_active_synonym_groups(
  p_locale text default 'ko'
)
returns table (
  id               bigint,
  locale           text,
  group_key        text,
  intent_key       text,
  slot_key         text,
  canonical_phrase text,
  phrases          text[],
  slot_value       jsonb,
  confidence       numeric
)
language sql
stable
as $$
  select
    s.id,
    s.locale,
    s.group_key,
    s.intent_key,
    s.slot_key,
    s.canonical_phrase,
    s.phrases,
    s.slot_value,
    s.confidence
  from public.request_synonym_groups s
  where s.is_active = true
    and s.locale = coalesce(p_locale, 'ko')
  order by s.id asc;
$$;

-- ── get_active_intent_examples ────────────────────────────────
-- Returns labelled intent examples for the given locale.
-- (pgvector similarity deferred; this feeds exact/fuzzy matching for now.)
create or replace function public.get_active_intent_examples(
  p_locale text default 'ko'
)
returns table (
  id           bigint,
  locale       text,
  intent_key   text,
  example_text text,
  slot_key     text,
  slot_value   jsonb,
  confidence   numeric,
  notes        text
)
language sql
stable
as $$
  select
    e.id,
    e.locale,
    e.intent_key,
    e.example_text,
    e.slot_key,
    e.slot_value,
    e.confidence,
    e.notes
  from public.request_intent_examples e
  where e.locale = coalesce(p_locale, 'ko')
  order by e.id asc;
$$;

-- ── get_poi_candidates ────────────────────────────────────────
-- SQL-first, deterministic candidate ranking.
-- Joins poi_search_profile + poi_reco_features only.
-- Does NOT touch jeju_kor_tourapi_places (display/operational fields
-- are loaded separately after final POIs are fixed).
-- Does NOT use SELECT *.
--
-- Scoring formula:
--   base_rank_score
--   + photo_score      * p_photo_priority
--   + hidden_gem_score * p_hidden_gem_priority
--   + iconic_score     * p_iconic_priority
--   + nature_score     * p_nature_priority
--   + culture_score    * p_culture_priority
--   + food_score       * p_food_priority
--   + cafe_score       * p_cafe_priority
--   + shopping_score   * p_shopping_priority
--   + rain_fallback_score * 2  (when p_need_indoor_if_rain = true)
--   + first_timer_score * 2    (when p_first_visit = true)
--   + revisit_score            (when p_first_visit = false)
--
-- Filters:
--   region / subregion exact match (null = no filter)
--   walking difficulty ceiling: easy ≤ moderate ≤ hard
--   indoor/rain: when p_need_indoor_if_rain = true, only indoor/mixed
--
-- Order: final_score DESC, poi_id ASC (deterministic tie-break)
-- Limit: clamped to [1, 120]
create or replace function public.get_poi_candidates(
  p_region              text    default null,
  p_subregion           text    default null,
  p_max_walking_level   text    default null,
  p_need_indoor_if_rain boolean default null,
  p_first_visit         boolean default null,
  p_photo_priority      integer default 0,
  p_hidden_gem_priority integer default 0,
  p_iconic_priority     integer default 0,
  p_nature_priority     integer default 0,
  p_culture_priority    integer default 0,
  p_food_priority       integer default 0,
  p_cafe_priority       integer default 0,
  p_shopping_priority   integer default 0,
  p_limit               integer default 40
)
returns table (
  poi_id                   bigint,
  content_id               text,
  display_name             text,
  region                   text,
  subregion                text,
  summary_line             text,
  recommended_stay_minutes integer,
  walking_difficulty       text,
  indoor_outdoor           text,
  quick_photo_stop_ok      boolean,
  base_rank_score          numeric,
  final_score              numeric
)
language sql
stable
as $$
  with base as (
    select
      sp.poi_id,
      sp.content_id,
      sp.display_name,
      sp.region,
      sp.subregion,
      sp.summary_line,
      sp.recommended_stay_minutes,
      sp.walking_difficulty,
      sp.indoor_outdoor,
      sp.quick_photo_stop_ok,
      rf.base_rank_score,
      (
        coalesce(rf.base_rank_score,     0)
        + coalesce(rf.photo_score,       0) * greatest(coalesce(p_photo_priority,       0), 0)
        + coalesce(rf.hidden_gem_score,  0) * greatest(coalesce(p_hidden_gem_priority,  0), 0)
        + coalesce(rf.iconic_score,      0) * greatest(coalesce(p_iconic_priority,      0), 0)
        + coalesce(rf.nature_score,      0) * greatest(coalesce(p_nature_priority,      0), 0)
        + coalesce(rf.culture_score,     0) * greatest(coalesce(p_culture_priority,     0), 0)
        + coalesce(rf.food_score,        0) * greatest(coalesce(p_food_priority,        0), 0)
        + coalesce(rf.cafe_score,        0) * greatest(coalesce(p_cafe_priority,        0), 0)
        + coalesce(rf.shopping_score,    0) * greatest(coalesce(p_shopping_priority,    0), 0)
        + case
            when coalesce(p_need_indoor_if_rain, false) = true
              then coalesce(rf.rain_fallback_score, 0) * 2
            else 0
          end
        + case
            when coalesce(p_first_visit, false) = true
              then coalesce(rf.first_timer_score, 0) * 2
            else coalesce(rf.revisit_score, 0)
          end
      ) as final_score
    from public.poi_search_profile sp
    join public.poi_reco_features rf
      on rf.poi_id = sp.poi_id
    where
      -- region filter (null = all regions)
      (p_region is null or sp.region = p_region)
      -- subregion filter (null = all subregions)
      and (p_subregion is null or sp.subregion = p_subregion)
      -- walking difficulty ceiling
      and (
        p_max_walking_level is null
        or (p_max_walking_level = 'easy'     and sp.walking_difficulty = 'easy')
        or (p_max_walking_level = 'moderate' and sp.walking_difficulty in ('easy', 'moderate'))
        or (p_max_walking_level = 'hard'     and sp.walking_difficulty in ('easy', 'moderate', 'hard'))
        -- null walking_difficulty rows pass through when filter is set
        or sp.walking_difficulty is null
      )
      -- indoor/rain filter: only indoor or mixed when rain preference is set
      and (
        coalesce(p_need_indoor_if_rain, false) = false
        or sp.indoor_outdoor in ('indoor', 'mixed')
        or sp.indoor_outdoor is null
      )
  )
  select
    b.poi_id,
    b.content_id,
    b.display_name,
    b.region,
    b.subregion,
    b.summary_line,
    b.recommended_stay_minutes,
    b.walking_difficulty,
    b.indoor_outdoor,
    b.quick_photo_stop_ok,
    b.base_rank_score,
    b.final_score
  from base b
  order by b.final_score desc, b.poi_id asc
  limit greatest(coalesce(p_limit, 40), 1);
$$;

commit;
