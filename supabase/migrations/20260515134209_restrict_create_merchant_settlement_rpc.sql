-- Restrict settlement creation RPC to trusted server-side callers only.

REVOKE ALL ON FUNCTION public.create_merchant_settlement(uuid, date, date, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_merchant_settlement(uuid, date, date, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_merchant_settlement(uuid, date, date, numeric) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_merchant_settlement(uuid, date, date, numeric) TO service_role;
