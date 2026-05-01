-- ============================================================================
-- Security RLS Hardening — 2026-04-30
-- ----------------------------------------------------------------------------
-- Closes ERROR/INFO-level findings from supabase advisors:
--   1. received_emails had RLS DISABLED → anon could read every inbound email
--   2. request_intent_*, poi_search_profile had RLS disabled (ERROR)
--   3. chat_sessions, chat_messages, qa_pairs, support_tickets, support_messages,
--      telegram_webhook_log, match_queries, merchant_settings, pickup_points,
--      product_inventory, promo_codes, settlement_bookings were RLS-on but had
--      ZERO policies → only the service_role could touch them. That broke admin
--      access from authenticated sessions and forced service-role from every
--      admin page (which we're now eliminating).
--
-- All admin-side reads/writes from API routes still go through createServerClient
-- (service_role) and therefore continue to bypass RLS. The new policies cover
-- direct authenticated access (e.g. when the chatbot widget eventually queries
-- chat_sessions for the current user).
-- ============================================================================

------------------------------------------------------------------------------
-- 1. Enable RLS on tables that were public-readable (ERROR level)
------------------------------------------------------------------------------
ALTER TABLE public.received_emails        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_intent_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_phrase_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_synonym_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_intent_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_search_profile     ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- 2. received_emails: admin-only reads/updates/deletes
--    INSERTs come exclusively from the Resend webhook handler which uses
--    service_role and bypasses RLS. No anon INSERT policy is created.
------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all emails"  ON public.received_emails;
CREATE POLICY "Admins can view all emails"
  ON public.received_emails FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can update emails" ON public.received_emails;
CREATE POLICY "Admins can update emails"
  ON public.received_emails FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can delete emails" ON public.received_emails;
CREATE POLICY "Admins can delete emails"
  ON public.received_emails FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
  ));

------------------------------------------------------------------------------
-- 3. Chatbot / support pipeline: admin-all, plus session-scoped read for the
--    end user when (eventually) chat widget reads its own session.
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_chat_sessions_all ON public.chat_sessions;
CREATE POLICY p_admins_chat_sessions_all
  ON public.chat_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_chat_messages_all ON public.chat_messages;
CREATE POLICY p_admins_chat_messages_all
  ON public.chat_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_qa_pairs_all ON public.qa_pairs;
CREATE POLICY p_admins_qa_pairs_all
  ON public.qa_pairs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Approved Q&A pairs are public knowledge base content — anon can read.
DROP POLICY IF EXISTS p_anon_qa_pairs_select_active ON public.qa_pairs;
CREATE POLICY p_anon_qa_pairs_select_active
  ON public.qa_pairs FOR SELECT TO anon, authenticated
  USING (is_active = TRUE AND review_status = 'approved');

DROP POLICY IF EXISTS p_admins_support_tickets_all ON public.support_tickets;
CREATE POLICY p_admins_support_tickets_all
  ON public.support_tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_support_messages_all ON public.support_messages;
CREATE POLICY p_admins_support_messages_all
  ON public.support_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_telegram_webhook_log_all ON public.telegram_webhook_log;
CREATE POLICY p_admins_telegram_webhook_log_all
  ON public.telegram_webhook_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

------------------------------------------------------------------------------
-- 4. Match analytics: service-role + admin only
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_match_queries_all ON public.match_queries;
CREATE POLICY p_admins_match_queries_all
  ON public.match_queries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

------------------------------------------------------------------------------
-- 5. Merchant settings — merchant owns their row, admin manages all
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_merchant_settings_all ON public.merchant_settings;
CREATE POLICY p_admins_merchant_settings_all
  ON public.merchant_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_merchants_merchant_settings_own ON public.merchant_settings;
CREATE POLICY p_merchants_merchant_settings_own
  ON public.merchant_settings FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

------------------------------------------------------------------------------
-- 6. Pickup points — public read (booking flow needs it), admin/merchant write
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_anon_pickup_points_select ON public.pickup_points;
CREATE POLICY p_anon_pickup_points_select
  ON public.pickup_points FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS p_admins_pickup_points_all ON public.pickup_points;
CREATE POLICY p_admins_pickup_points_all
  ON public.pickup_points FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

------------------------------------------------------------------------------
-- 7. Product inventory — public read (availability), admin/merchant write
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_anon_product_inventory_select ON public.product_inventory;
CREATE POLICY p_anon_product_inventory_select
  ON public.product_inventory FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS p_admins_product_inventory_all ON public.product_inventory;
CREATE POLICY p_admins_product_inventory_all
  ON public.product_inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

------------------------------------------------------------------------------
-- 8. Promo codes — public read of active codes only, admin manages
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_anon_promo_codes_select_active ON public.promo_codes;
CREATE POLICY p_anon_promo_codes_select_active
  ON public.promo_codes FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS p_admins_promo_codes_all ON public.promo_codes;
CREATE POLICY p_admins_promo_codes_all
  ON public.promo_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

------------------------------------------------------------------------------
-- 9. Settlement bookings — merchants see theirs, admins see all
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_settlement_bookings_all ON public.settlement_bookings;
CREATE POLICY p_admins_settlement_bookings_all
  ON public.settlement_bookings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_merchants_settlement_bookings_own ON public.settlement_bookings;
CREATE POLICY p_merchants_settlement_bookings_own
  ON public.settlement_bookings FOR SELECT TO authenticated
  USING (settlement_id IN (
    SELECT id FROM public.settlements
    WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  ));

------------------------------------------------------------------------------
-- 10. Match catalog (request_intent_*, poi_search_profile)
--     Service-role / admin only (server-side reads via service_role bypass RLS).
------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admins_request_intent_catalog_all ON public.request_intent_catalog;
CREATE POLICY p_admins_request_intent_catalog_all
  ON public.request_intent_catalog FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_request_phrase_rules_all ON public.request_phrase_rules;
CREATE POLICY p_admins_request_phrase_rules_all
  ON public.request_phrase_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_request_synonym_groups_all ON public.request_synonym_groups;
CREATE POLICY p_admins_request_synonym_groups_all
  ON public.request_synonym_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_request_intent_examples_all ON public.request_intent_examples;
CREATE POLICY p_admins_request_intent_examples_all
  ON public.request_intent_examples FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS p_admins_poi_search_profile_all ON public.poi_search_profile;
CREATE POLICY p_admins_poi_search_profile_all
  ON public.poi_search_profile FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));
