-- ============================================================================
-- 2026-06-24-11 — agent_reservations.updated_at trigger (AI Agent Channel)
-- ============================================================================
-- The agent_reservations table (file 08) has an `updated_at` column that is set
-- on insert but never refreshed. This adds a BEFORE UPDATE trigger so any later
-- status change (e.g. ops marking a lead converted/cancelled) stamps it.
--
-- Uses a DEDICATED trigger function (not a shared/global name) so it can't
-- clobber an existing set_updated_at() used by other tables.
--
-- Depends on file 08 (agent_reservations). Idempotent and transactional.
-- ============================================================================

begin;

create or replace function public.agent_reservations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agent_reservations_set_updated_at on public.agent_reservations;

create trigger agent_reservations_set_updated_at
  before update on public.agent_reservations
  for each row
  execute function public.agent_reservations_touch_updated_at();

commit;

-- ── Verification ────────────────────────────────────────────────────────────
-- Expect: one row naming the trigger on agent_reservations.
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname = 'agent_reservations_set_updated_at';
