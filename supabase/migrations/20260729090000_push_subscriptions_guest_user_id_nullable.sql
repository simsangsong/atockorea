-- P0-4 — guest Web Push could never be stored.
--
-- push_subscriptions started life as an ADMIN push table: role defaults to
-- 'admin' and user_id is a NOT NULL auth user. W4.1 (P-D7) reused it for guest
-- pings by adding booking_id, but left user_id NOT NULL.
--
-- A guest in a tour room authenticates with a room session / invite token, not
-- a Supabase login, so resolveRoomActor returns authUserId = null. The
-- push-subscribe route inserts that null into user_id, Postgres raises 23502,
-- the route 500s, and the opt-in banner reports failure. Live evidence: the
-- table has never held a single row while real customer participants exist.
--
-- Relaxing the constraint (never tightening) — existing rows are unaffected and
-- admin/ops rows keep supplying user_id. Guest rows are identified by
-- booking_id, which is how guestPush already selects them.
alter table public.push_subscriptions
  alter column user_id drop not null;

-- Keep the guest lookup (booking_id + role) cheap now that guest rows can exist.
create index if not exists push_subscriptions_booking_role_idx
  on public.push_subscriptions (booking_id, role)
  where booking_id is not null;

comment on column public.push_subscriptions.user_id is
  'Supabase auth user for admin/ops devices. NULL for tour-room guests, who authenticate by room session/invite token and are identified by booking_id (P0-4).';
