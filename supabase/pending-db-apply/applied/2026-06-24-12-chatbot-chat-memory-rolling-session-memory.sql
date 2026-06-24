-- 2026-06-24-12 · Chatbot Track 3.2 — rolling cross-session memory.
--
-- Status:  ALREADY APPLIED to production on 2026-06-24 via Supabase MCP
--          apply_migration (recorded as migration 20260624033518).
--          Idempotent — re-running is a safe no-op. Kept here for batch/rebuild
--          completeness. Standalone (no dependency on other files in this folder).
--
-- One durable, PII-excluded 1-2 sentence summary per identity:
--   * logged-in visitor -> keyed by user_id
--   * anonymous visitor -> keyed by session_token (the chat cookie)
-- Written only by the server via the service-role client; RLS denies all direct
-- anon/authenticated access (matches chat_sessions / chat_messages).

begin;

create table if not exists public.chat_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  session_token text,
  summary       text not null,
  turn_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One row per logged-in user.
create unique index if not exists chat_memory_user_id_key
  on public.chat_memory (user_id) where user_id is not null;

-- One row per anonymous session (only when not tied to a user).
create unique index if not exists chat_memory_session_token_key
  on public.chat_memory (session_token) where user_id is null and session_token is not null;

alter table public.chat_memory enable row level security;

commit;

-- Verification.
select
  to_regclass('public.chat_memory')                                                  as table_exists,
  (select count(*) from pg_indexes where tablename = 'chat_memory')                   as index_count,        -- expect 3
  (select relrowsecurity from pg_class where oid = 'public.chat_memory'::regclass)     as rls_enabled;        -- expect true
