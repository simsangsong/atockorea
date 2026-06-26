-- inbox realtime completion: add received_emails to the supabase_realtime
-- publication so the unified inbox gets live email events too (alongside
-- bookings / contact_inquiries / support_tickets). received_emails has an
-- admin-only SELECT RLS policy, so realtime subscribers (admins) only receive
-- what they can already read — no anon / non-owner leakage. Additive +
-- idempotent. Applied live 2026-06-26 (user-approved) via apply_migration;
-- committed here for repo<->live parity. Rollback:
--   alter publication supabase_realtime drop table public.received_emails;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'received_emails'
  ) then
    alter publication supabase_realtime add table public.received_emails;
  end if;
end $$;
