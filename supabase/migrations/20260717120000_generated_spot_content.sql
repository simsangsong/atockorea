-- Smart Guide Private Mode — W1.5 auto POI content (plan P-D16).
-- Booking-scoped generated mini-guides for stops outside the poi_kb:
-- facts come from Google Places Details, the LLM writes narrative only,
-- a critic pass strips unverifiable claims. Served as the 'generated'
-- tier of the spot-content fallback chain with an AI-provenance badge.
-- Service-role only (RLS, no policies — room APIs authorize).

create table if not exists public.generated_spot_content (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  -- 'place:<place_id>' | 'poi:<poi_key>' | 'name:<slug>' — first match wins.
  poi_ref text not null,
  title text not null,
  facts jsonb,
  content_locales jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'failed')),
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, poi_ref)
);
alter table public.generated_spot_content enable row level security;
create index if not exists generated_spot_content_booking_idx
  on public.generated_spot_content (booking_id);
comment on table public.generated_spot_content is
  'P-D16 auto-generated spot mini-guides (facts=Places, narrative=LLM, critic-verified). content_locales: locale -> SpotArrivalContent shape. Repeated refs get promoted to poi_kb via the weekly review flywheel.';
