-- Third-party platform review aggregates per tour product.
--
-- Strategy: the same tenant/operator lists the same tour on global OTAs
-- (TripAdvisor / Viator / GetYourGuide / Klook). We surface ONLY the public
-- aggregate (average rating + review count) attributed to the source platform,
-- with an outbound link to the original page. We do NOT copy review prose
-- (copyright stays with the author) and we do NOT show competitor prices.
--
-- Keyed by `tour_product_slug` (the slug the detail page renders with) so the
-- read path works for both Supabase-backed and static-bundle products without a
-- tour_id join. This supersedes the in-code platform-compare-registry pattern.

create table if not exists public.tour_external_reviews (
  id                 uuid primary key default gen_random_uuid(),
  tour_product_slug  text not null,
  platform           text not null
                       check (platform in ('tripadvisor', 'viator', 'getyourguide', 'klook')),
  -- Public aggregate as displayed on the source platform.
  average_rating     numeric(2, 1)
                       check (average_rating is null or (average_rating >= 0 and average_rating <= 5)),
  review_count       integer not null default 0 check (review_count >= 0),
  -- Source attribution.
  source_url         text not null,
  external_id        text,            -- platform's own listing id (optional)
  -- Display + provenance controls.
  is_visible         boolean not null default true,
  sort_order         integer not null default 0,
  last_checked_at    date,            -- when ops last verified the figures
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tour_product_slug, platform)
);

comment on table public.tour_external_reviews is
  'Third-party OTA review aggregates (rating + count + source link) per tour product slug. Aggregate-only, attributed, no review-text copy, no competitor pricing.';

create index if not exists tour_external_reviews_slug_idx
  on public.tour_external_reviews (tour_product_slug);

create index if not exists tour_external_reviews_visible_idx
  on public.tour_external_reviews (tour_product_slug, is_visible);

-- updated_at trigger. INVOKER (not DEFINER) + revoked EXECUTE so it is not an
-- anon/authenticated-callable RPC (Supabase advisor 0028/0029).
create or replace function public.set_tour_external_reviews_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_tour_external_reviews_updated_at() from public, anon, authenticated;

drop trigger if exists trg_tour_external_reviews_updated_at on public.tour_external_reviews;
create trigger trg_tour_external_reviews_updated_at
  before update on public.tour_external_reviews
  for each row
  execute function public.set_tour_external_reviews_updated_at();

-- RLS: public reads only visible rows; only admins write.
alter table public.tour_external_reviews enable row level security;

drop policy if exists tour_external_reviews_public_read on public.tour_external_reviews;
create policy tour_external_reviews_public_read
  on public.tour_external_reviews
  for select
  using (is_visible = true);

drop policy if exists tour_external_reviews_admin_all on public.tour_external_reviews;
create policy tour_external_reviews_admin_all
  on public.tour_external_reviews
  for all
  using (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin'));
