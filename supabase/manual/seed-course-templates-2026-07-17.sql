-- Smart-guide W1.1 — one-time (idempotent) seed of course_templates from live
-- tour itineraries (master plan P-D14). Re-runnable: upserts on
-- origin_tour_slug and rebuilds stops from the current match data.
--
-- Sources:
--   match_itinerary_stops  — tour_slug / stop_index / poi_key / title
--   match_pois             — name_en/ko, lat/lng, default_stay_minutes, category
--   tours                  — city → region slug, title, duration → total_hours
--
-- Stop shape mirrors §C-2 DayPlanStop (extra lat/lng/category fields ride the
-- index signature so the /plan editor and feasibility engine need no joins).

insert into course_templates (region, origin_tour_slug, title_i18n, stops, total_hours, updated_at)
select
  lower(t.city)                                   as region,
  t.slug                                          as origin_tour_slug,
  jsonb_build_object('en', t.title)               as title_i18n,
  (
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id',           'tpl-' || s.stop_index,
        'seq',          s.stop_index,
        'source',       case when mp.poi_key is not null then 'poi' else 'free' end,
        'poi_key',      mp.poi_key,
        'name_i18n',    jsonb_strip_nulls(jsonb_build_object(
                          'en', coalesce(mp.name_en, s.title),
                          'ko', mp.name_ko
                        )),
        'stop_type',    'sight',
        'duration_min', coalesce(mp.default_stay_minutes, 60),
        'status',       'pending',
        'lat',          mp.lat,
        'lng',          mp.lng,
        'category',     mp.category
      ))
      order by s.stop_index
    )
    from match_itinerary_stops s
    left join match_pois mp on mp.poi_key = s.poi_key
    where s.tour_slug = t.slug
  )                                               as stops,
  nullif(regexp_replace(split_part(replace(t.duration, '—', '–'), '–', 1), '[^0-9.]', '', 'g'), '')::numeric
                                                  as total_hours,
  now()                                           as updated_at
from tours t
where t.slug in (select distinct tour_slug from match_itinerary_stops)
  and lower(t.city) in ('seoul', 'busan', 'jeju')
on conflict (origin_tour_slug) do update set
  region      = excluded.region,
  title_i18n  = excluded.title_i18n,
  stops       = excluded.stops,
  total_hours = excluded.total_hours,
  updated_at  = now();
