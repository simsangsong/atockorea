-- W6.1 (ops-center app track) — Web Push subscriptions for the ops console.
-- Applied to live 2026-07-15 via mcp apply_migration (create_push_subscriptions).
-- Service-role only: the subscribe/unsubscribe API runs requireAdmin and uses
-- the service client; RLS is enabled with NO policies so anon/authenticated
-- roles cannot touch endpoints (they contain capability URLs).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'guide')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.push_subscriptions enable row level security;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_role_idx
  on public.push_subscriptions (role);

comment on table public.push_subscriptions is
  'Web Push subscriptions for the ops-center PWA (W6). Service-role only; endpoint is a capability URL. Pruned on 404/410 push responses.';
