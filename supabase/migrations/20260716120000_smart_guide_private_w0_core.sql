-- Smart Guide Private Mode — Wave W0.1 core schema
-- (docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md §C-1, §I W0.1)
--
-- All new tables are service-role only: RLS enabled with NO policies (the
-- push_subscriptions pattern) — room APIs authorize via resolveRoomActor().
-- Everything here is additive; existing rows/behaviour are untouched except
-- the three role CHECKs, which only widen the allowed enum.

-- ① tour_day_plans — booking-owned day plan (P-D4 tour_date key, P-D11 needs).
--    Owns the day's stops once status reaches guide_confirmed; until then the
--    resolver chain (lib/tour-room/dayPlan.ts) falls through to legacy sources.
create table if not exists public.tour_day_plans (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  room_id uuid references public.tour_rooms(id) on delete set null,
  tour_date date not null,
  status text not null default 'guest_draft'
    check (status in ('guest_draft', 'guide_confirmed', 'live', 'done')),
  stops jsonb not null default '[]'::jsonb,
  needs jsonb,
  feasibility jsonb,
  version integer not null default 1,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, tour_date)
);
alter table public.tour_day_plans enable row level security;
create index if not exists tour_day_plans_room_id_idx on public.tour_day_plans (room_id);
comment on table public.tour_day_plans is
  'Private-mode day plan (smart-guide plan §C-1). stops jsonb follows §C-2; needs jsonb holds the A10 checklist (sensitive — purge target, §C-7). Resolver: lib/tour-room/dayPlan.ts.';

-- ② tour_room_events — append-only event log shared by all 8 primitives (P-D5).
--    User-visible events additionally insert a tour_room_messages capsule; this
--    table is the recompute/audit/flywheel source. The partial unique index is
--    the ESCALATE idempotency gate (P-D6): one (room, subject, type) side-effect.
create table if not exists public.tour_room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.tour_rooms(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  actor_role text not null
    check (actor_role in ('customer', 'guide', 'driver', 'admin', 'system')),
  actor_participant_id uuid references public.tour_room_participants(id) on delete set null,
  subject_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.tour_room_events enable row level security;
create index if not exists tour_room_events_room_created_idx
  on public.tour_room_events (room_id, created_at);
create unique index if not exists tour_room_events_subject_once_idx
  on public.tour_room_events (room_id, subject_key, type)
  where subject_key is not null;
comment on table public.tour_room_events is
  'Append-only private-mode event log (smart-guide plan P-D5/P-D6). subject_key + type unique per room = idempotent escalation stages (spot_events pattern).';

-- ③ tour_room_pins — one-shot location pins with TTL (PIN primitive).
--    No continuous tracking, ever: a pin is an explicit action snapshot (§C-7).
create table if not exists public.tour_room_pins (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.tour_rooms(id) on delete cascade,
  kind text not null
    check (kind in ('parking', 'rally', 'pickup', 'vehicle_arrived', 'lost_me')),
  lat numeric not null,
  lng numeric not null,
  label text,
  photo_url text,
  expires_at timestamptz,
  created_by_role text
    check (created_by_role in ('customer', 'guide', 'driver', 'admin', 'system')),
  created_by_participant_id uuid references public.tour_room_participants(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.tour_room_pins enable row level security;
create index if not exists tour_room_pins_room_created_idx
  on public.tour_room_pins (room_id, created_at desc);
comment on table public.tour_room_pins is
  'One-shot location pins (smart-guide plan PIN primitive). expires_at is the TTL (lost_me defaults to 30 min in the API); never a tracking stream.';

-- ④ tour_room_extras — cash-settled extras ledger (LEDGER primitive, P-D2).
--    A transparency/record device, NOT a payment rail: extras are paid to the
--    guide in cash on the day; Stripe never touches this table.
create table if not exists public.tour_room_extras (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.tour_rooms(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  item text not null,
  amount_krw integer not null check (amount_krw >= 0),
  payer text not null check (payer in ('guide', 'driver')),
  kind text not null default 'other'
    check (kind in ('advance', 'extension', 'parking', 'other')),
  receipt_photo_url text,
  status text not null default 'logged'
    check (status in ('logged', 'confirmed', 'settled', 'voided')),
  settled_via text check (settled_via in ('cash')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tour_room_extras enable row level security;
create index if not exists tour_room_extras_room_idx on public.tour_room_extras (room_id);
create index if not exists tour_room_extras_booking_idx on public.tour_room_extras (booking_id);
comment on table public.tour_room_extras is
  'Extras ledger (smart-guide plan P-D2): logged → confirmed (guest ack) → settled (guide confirms cash received) | voided. settled_via stays cash-only in v1.';

-- ⑤ Role widenings (driver scope P-D3, lead flag P-D13, customer push P-D7).
alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_role_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_role_check
  check (role in ('guide', 'customer', 'driver'));

alter table public.tour_room_invites
  drop constraint if exists tour_room_invites_scope_check;
alter table public.tour_room_invites
  add constraint tour_room_invites_scope_check
  check (
    (role = 'customer' and booking_id is not null)
    or (role in ('guide', 'driver') and tour_id is not null and tour_date is not null)
  );

alter table public.tour_room_participants
  drop constraint if exists tour_room_participants_role_check;
alter table public.tour_room_participants
  add constraint tour_room_participants_role_check
  check (role in ('customer', 'guide', 'admin', 'driver'));

alter table public.tour_room_participants
  add column if not exists is_lead boolean not null default false;
comment on column public.tour_room_participants.is_lead is
  'P-D13 — the lead guest (first customer join, or contact_email owner). Sole /plan editor while the day plan is a guest_draft.';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_role_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_role_check
  check (role in ('admin', 'guide', 'customer'));
