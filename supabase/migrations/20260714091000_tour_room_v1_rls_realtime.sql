-- Tour Mode v1 — M-6: RLS for the new tables + realtime publication.
-- Master plan: docs/tour-mode-master-plan-2026-07-14.md §C M-6.
-- NOT applied live yet — live apply is ticket T0.3 (requires explicit user approval).
--
-- Security design (deliberate): NO anon policies are created on any tour-room
-- table. Guest/token participants always go through service-role API routes
-- (which bypass RLS after their own authorization checks in
-- lib/tour-room/access.ts), and client realtime for customers/guests uses
-- Broadcast channels, not Postgres-Changes (D-1). The only direct-subscription
-- consumer is the admin ops console (Postgres-Changes on tour_room_messages),
-- which is why tour_room_messages gets an admin SELECT policy + publication
-- membership below.

------------------------------------------------------------------------------
-- 1. Enable RLS on the new tables (deny-by-default until policies below).
------------------------------------------------------------------------------
ALTER TABLE public.tour_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_room_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_room_tts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_translation_cache ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- 2. Admin-all policies (ops console + admin tooling).
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_tour_room_participants_all ON public.tour_room_participants;
CREATE POLICY p_admins_tour_room_participants_all
  ON public.tour_room_participants FOR ALL TO authenticated
  USING (private.current_profile_role() = 'admin')
  WITH CHECK (private.current_profile_role() = 'admin');

DROP POLICY IF EXISTS p_admins_tour_room_invites_all ON public.tour_room_invites;
CREATE POLICY p_admins_tour_room_invites_all
  ON public.tour_room_invites FOR ALL TO authenticated
  USING (private.current_profile_role() = 'admin')
  WITH CHECK (private.current_profile_role() = 'admin');

DROP POLICY IF EXISTS p_admins_tour_room_locations_all ON public.tour_room_locations;
CREATE POLICY p_admins_tour_room_locations_all
  ON public.tour_room_locations FOR ALL TO authenticated
  USING (private.current_profile_role() = 'admin')
  WITH CHECK (private.current_profile_role() = 'admin');

DROP POLICY IF EXISTS p_admins_tour_room_tts_cache_all ON public.tour_room_tts_cache;
CREATE POLICY p_admins_tour_room_tts_cache_all
  ON public.tour_room_tts_cache FOR ALL TO authenticated
  USING (private.current_profile_role() = 'admin')
  WITH CHECK (private.current_profile_role() = 'admin');

DROP POLICY IF EXISTS p_admins_tour_translation_cache_all ON public.tour_translation_cache;
CREATE POLICY p_admins_tour_translation_cache_all
  ON public.tour_translation_cache FOR ALL TO authenticated
  USING (private.current_profile_role() = 'admin')
  WITH CHECK (private.current_profile_role() = 'admin');

------------------------------------------------------------------------------
-- 3. Merchant-guide read on participants/locations — a logged-in merchant may
-- read rooms of their own bookings (guide console for account-holding guides).
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_merchants_tour_room_participants_select ON public.tour_room_participants;
CREATE POLICY p_merchants_tour_room_participants_select
  ON public.tour_room_participants FOR SELECT TO authenticated
  USING (booking_id IN (
    SELECT b.id FROM public.bookings b
    WHERE b.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id = (SELECT auth.uid()))
  ));

DROP POLICY IF EXISTS p_merchants_tour_room_locations_select ON public.tour_room_locations;
CREATE POLICY p_merchants_tour_room_locations_select
  ON public.tour_room_locations FOR SELECT TO authenticated
  USING (booking_id IN (
    SELECT b.id FROM public.bookings b
    WHERE b.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id = (SELECT auth.uid()))
  ));

------------------------------------------------------------------------------
-- 4. Admin read on tour_room_messages (table pre-exists with RLS enabled and
-- zero policies) — required for the ops-console Postgres-Changes subscription:
-- realtime enforces SELECT RLS, so without this policy an admin subscriber
-- receives nothing (silent failure, R-4).
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_tour_room_messages_select ON public.tour_room_messages;
CREATE POLICY p_admins_tour_room_messages_select
  ON public.tour_room_messages FOR SELECT TO authenticated
  USING (private.current_profile_role() = 'admin');

------------------------------------------------------------------------------
-- 5. Publication membership for the admin live feed (customer/guest realtime
-- is Broadcast-only and needs no publication).
------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'tour_room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_room_messages;
  END IF;
END $$;
