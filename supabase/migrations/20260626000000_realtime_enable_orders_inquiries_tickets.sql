-- U-1 (admin realtime live feed): add the orders / inquiries / tickets tables
-- to the supabase_realtime publication so INSERT/UPDATE/DELETE are broadcast to
-- subscribed admin clients. Additive + idempotent. Realtime still enforces
-- SELECT RLS, so a subscriber only receives rows it is already allowed to read:
--   - bookings:          own user / own merchant / admin
--   - contact_inquiries: admin only
--   - support_tickets:   admin only
-- Applied live 2026-06-26 (user-approved) via mcp apply_migration; committed
-- here for repo<->live parity. Rollback: alter publication ... drop table ...
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'contact_inquiries'
  ) then
    alter publication supabase_realtime add table public.contact_inquiries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
