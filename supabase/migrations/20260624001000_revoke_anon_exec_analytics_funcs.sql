-- W0.2 (N27) — Revoke anon/authenticated EXECUTE on over-privileged
-- SECURITY DEFINER analytics functions.
--
-- LIVE-CONFIRMED: these SECURITY DEFINER functions were executable by
-- anon/authenticated via /rest/v1/rpc, letting anyone trigger PII anonymization,
-- a heavy matview refresh, or read the analytics health snapshot. All legitimate
-- callers use the service_role (cron + admin health routes), so only the
-- service_role needs EXECUTE. handle_new_user is an auth.users trigger and fires
-- regardless of EXECUTE grants.
--
-- Mirrors the settlement RPC restrict pattern. Idempotent.

REVOKE EXECUTE ON FUNCTION public.anonymize_old_analytics(integer)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_health_snapshot()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.anonymize_old_analytics(integer)       TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_health_snapshot()            TO service_role;
