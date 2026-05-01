-- ============================================================================
-- Function search_path hardening — 2026-05-01
-- ----------------------------------------------------------------------------
-- Closes WARN-level finding "function_search_path_mutable" from supabase
-- advisors. A mutable search_path lets a user with CREATE on any schema
-- shadow built-in functions (e.g. lower(), now()) and hijack the body of
-- a SECURITY DEFINER trigger.
--
-- Pinning to "public, pg_temp" keeps everything resolving from public/extensions
-- while making the path immutable per call.
-- ============================================================================

ALTER FUNCTION public.match_set_updated_at()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_codes()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_synonym_groups()               SET search_path = public, pg_temp;
ALTER FUNCTION public.update_booking_settlement_status()        SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()                SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_intent_examples()              SET search_path = public, pg_temp;
ALTER FUNCTION public.update_tour_rating()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.tour_product_pages_default_product_id()   SET search_path = public, pg_temp;
ALTER FUNCTION public.reviews_sync_is_shadow_from_rating()      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_phrase_rules()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.qa_pairs_set_updated_at()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.set_jeju_kor_tourapi_places_updated_at()  SET search_path = public, pg_temp;
ALTER FUNCTION public.support_set_updated_at()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_review_reaction_counts()           SET search_path = public, pg_temp;
ALTER FUNCTION public.user_profiles_set_updated_at()            SET search_path = public, pg_temp;
ALTER FUNCTION public.update_booking_merchant_id()              SET search_path = public, pg_temp;
ALTER FUNCTION public.update_settlement_updated_at()            SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_poi_search_document()             SET search_path = public, pg_temp;

-- match_catalog_candidates / get_poi_candidates take arguments — need exact signatures.
-- Use ALTER FUNCTION ... (signature) form. Adjust if signatures differ.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_catalog_candidates', 'get_poi_candidates')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      fn.schema, fn.name, fn.args
    );
  END LOOP;
END $$;

-- ============================================================================
-- handle_new_user(): SECURITY DEFINER trigger function — should not be callable
-- as an RPC by anon/authenticated. It runs from the auth.users insert trigger.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM anon, authenticated;
-- (postgres / supabase_admin / service_role keep EXECUTE; the trigger fires
-- under the table-owner role anyway.)
