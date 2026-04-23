-- Add p_rain_aware: boost rain_fallback_score without indoor-only filter.
-- need_indoor_if_rain still applies indoor/mixed filter when true.

begin;

create or replace function public.get_poi_candidates(
  p_region              text    default null,
  p_subregion           text    default null,
  p_max_walking_level   text    default null,
  p_need_indoor_if_rain boolean default null,
  p_rain_aware          boolean default null,
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
            when coalesce(p_rain_aware, false) = true
              then coalesce(rf.rain_fallback_score, 0) * 1.5
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
      (p_region is null or sp.region = p_region)
      and (p_subregion is null or sp.subregion = p_subregion)
      and (
        p_max_walking_level is null
        or (p_max_walking_level = 'easy'     and sp.walking_difficulty = 'easy')
        or (p_max_walking_level = 'moderate' and sp.walking_difficulty in ('easy', 'moderate'))
        or (p_max_walking_level = 'hard'     and sp.walking_difficulty in ('easy', 'moderate', 'hard'))
        or sp.walking_difficulty is null
      )
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
