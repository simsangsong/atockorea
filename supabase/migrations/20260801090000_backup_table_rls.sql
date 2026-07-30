-- ============================================================================
-- FA-012 (full-app audit 2026-07-30) — a backup table was reachable over the API.
--
-- `__tpp_payload_backup_20260729` was left behind by the tour-product translation
-- cleanup. It holds 54 rows of product payload, it sits in `public`, and it had
-- RLS DISABLED — the only ERROR-level finding in the security advisors. Any table
-- in `public` is exposed through PostgREST, so with RLS off the anon key could
-- read it, and (depending on grants) write it.
--
-- Enabling RLS with NO policies is the right shape here rather than a DROP:
--   * it takes the table off the API immediately (deny-by-default),
--   * the service role still reaches it, so it remains a usable backup,
--   * and nothing is destroyed, so the decision to delete stays with the owner.
--
-- 🔴 Do not add a policy to this table. If something legitimately needs the
-- rows, read them with the service role; if nothing does, drop the table.
-- ============================================================================

alter table if exists public.__tpp_payload_backup_20260729 enable row level security;

comment on table public.__tpp_payload_backup_20260729 is
  'Backup taken 2026-07-29 by the tour-product translation cleanup. RLS enabled with no policies (FA-012) so it is not reachable over the API — service role only. Safe to drop once the cleanup is confirmed.';

-- Verify after apply:
--   1. select relrowsecurity from pg_class where relname='__tpp_payload_backup_20260729'; → true
--   2. select count(*) from pg_policies where tablename='__tpp_payload_backup_20260729'; → 0
--   3. get_advisors('security') → the rls_disabled_in_public ERROR is gone
