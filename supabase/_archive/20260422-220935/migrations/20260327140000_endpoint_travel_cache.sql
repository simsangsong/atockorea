-- Server-only persistent cache for endpoint <-> POI travel (coordinates + POI id + bucket).
-- Does not replace travel_time_edges (POI <-> POI).

create table if not exists public.endpoint_travel_cache (
  endpoint_key text not null,
  endpoint_kind text not null default 'unknown',
  endpoint_region_group text,
  endpoint_lat_rounded double precision,
  endpoint_lng_rounded double precision,
  poi_id bigint not null
    references public.jeju_kor_tourapi_places(id)
    on delete cascade,
  poi_content_id text not null,
  direction text not null
    check (direction in ('endpoint_to_poi', 'poi_to_endpoint')),
  provider text not null,
  time_bucket text not null default 'midday'
    check (time_bucket in ('am_peak', 'midday', 'pm_peak', 'weekend')),
  duration_minutes integer,
  distance_meters integer,
  source_type text not null default 'estimated'
    check (source_type in ('estimated', 'live', 'cached')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (endpoint_key, poi_id, direction, provider, time_bucket)
);

create index if not exists idx_endpoint_travel_cache_poi_bucket
  on public.endpoint_travel_cache (poi_id, time_bucket);

create index if not exists idx_endpoint_travel_cache_endpoint_key
  on public.endpoint_travel_cache (endpoint_key);

drop trigger if exists trg_endpoint_travel_cache_updated_at
  on public.endpoint_travel_cache;
create trigger trg_endpoint_travel_cache_updated_at
  before update on public.endpoint_travel_cache
  for each row execute function public.set_updated_at();

comment on table public.endpoint_travel_cache is
  'Coordinate-normalized endpoint<->POI travel cache; server-side only.';
