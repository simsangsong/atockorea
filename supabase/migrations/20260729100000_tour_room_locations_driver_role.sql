-- Driver mode — close a repo/live drift on tour_room_locations.role.
--
-- 20260714090000_tour_room_v1_core.sql created the table with
--   CHECK (role IN ('customer','guide','admin'))
-- and the driver role arrived later (W3, cb14d993) without a migration to widen
-- it. Production was patched out of band — the live constraint DOES include
-- 'driver' — so nobody noticed. A fresh environment (supabase db reset, a
-- preview branch, a new region) would instead reject every driver location row.
--
-- The rejection would be invisible: app/api/tour-rooms/[bookingId]/location
-- never inspects the upsert error and returns { ok: true } regardless, so the
-- cockpit would report success while the room saw nothing.
--
-- Idempotent and additive (the role set only widens); safe to re-run.
alter table public.tour_room_locations
  drop constraint if exists tour_room_locations_role_check;

alter table public.tour_room_locations
  add constraint tour_room_locations_role_check
  check (role in ('customer', 'guide', 'admin', 'driver'));
