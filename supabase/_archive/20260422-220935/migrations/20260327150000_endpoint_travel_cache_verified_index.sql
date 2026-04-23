-- Optional maintenance index for stale-row policies / observability (no behavior change).
create index if not exists idx_endpoint_travel_cache_verified
  on public.endpoint_travel_cache (last_verified_at desc nulls last);
