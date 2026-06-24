-- Track 3.2 — rolling cross-session memory for the chatbot.
--
-- Authored: 2026-06-24 (chatbot agent roadmap, Track 3.2).
-- Status:   ALREADY APPLIED to production on 2026-06-24 via Supabase MCP
--           apply_migration (recorded as migration 20260624033518).
--           Fully idempotent — re-running this file is a safe no-op. Kept here
--           as the version-controlled record and for any DB rebuild / batch run.
--
-- One durable, PII-excluded 1-2 sentence summary per identity:
--   * logged-in visitor -> keyed by user_id
--   * anonymous visitor -> keyed by session_token (the chat cookie)
-- Written only by the server via the service-role client; RLS denies all direct
-- anon/authenticated access (matches chat_sessions / chat_messages).

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
