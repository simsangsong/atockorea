-- Trigger functions must not be callable via PostgREST RPC (advisor 0028/0029).
-- Applied to live via MCP apply_migration `welcome_coupon_trigger_fn_revoke_exec` on 2026-07-08.
revoke execute on function public.handle_email_confirmed_coupon_grant() from public, anon, authenticated;
