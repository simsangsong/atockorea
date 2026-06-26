-- U-6 (destructive undo): soft-delete for merchants. Instead of a hard DELETE
-- (irreversible + FK-cascade), the admin DELETE now sets deleted_at and the row
-- is hidden from the management list; a restore endpoint clears it (and
-- re-promotes the linked user to 'merchant'). Additive + idempotent. The
-- partial index keeps the active-merchants list scan cheap. Applied live
-- 2026-06-26 (user-approved) via apply_migration; committed for repo<->live
-- parity. Rollback: alter table public.merchants drop column deleted_at.
alter table public.merchants add column if not exists deleted_at timestamptz;

create index if not exists idx_merchants_active
  on public.merchants (created_at)
  where deleted_at is null;
