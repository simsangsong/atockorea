-- Smart-guide private mode W4.1 + W5.1 (master plan §C-1 migration ④ + P-D7).
--
-- ① push_subscriptions.booking_id — guest (role 'customer') subscriptions are
--    booking-scoped so rally/delay pushes hit exactly one party's devices.
--    Nullable: ops/guide rows keep their role-wide semantics.
-- ② poi_travel_matrix — measured drive minutes between poi_keys by daypart,
--    learned weekly from manual_arrival events (flywheel ①). Synthetic
--    haversine×1.55 stays the fallback for unseen pairs.

alter table public.push_subscriptions
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

create index if not exists push_subscriptions_booking_idx
  on public.push_subscriptions (booking_id) where booking_id is not null;

create table if not exists public.poi_travel_matrix (
  from_key text not null,
  to_key text not null,
  daypart text not null check (daypart in ('am', 'midday', 'pm', 'evening')),
  minutes_p50 numeric not null,
  samples integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (from_key, to_key, daypart)
);

alter table public.poi_travel_matrix enable row level security;

comment on table public.poi_travel_matrix is
  'Smart-guide flywheel ① — measured POI-to-POI drive minutes by daypart (from manual_arrival events). Service-role only.';
