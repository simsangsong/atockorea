-- ============================================================================
-- 2026-06-24-09 — agent_channel_events (AI Agent Channel, Phase 5)
-- ============================================================================
-- Observability for the AI agent channel: which assistants discover us, which
-- tours they look at, and how the quote → booking-handoff funnel performs. This
-- is how we measure (and then improve) "being discovered and trusted by AI".
--
-- Append-only telemetry. No PII beyond the bot User-Agent string (we never
-- store the raw client IP). Decoupled from analytics_events / the consumer
-- funnel tables — this is purely the agent surface.
--
-- Writes are service-role only (the agent API uses the service client). RLS is
-- enabled with NO anon/auth policies → denied by default to public clients.
--
-- Idempotent (CREATE … IF NOT EXISTS) and transactional — safe to re-run.
-- The agent endpoints log best-effort and degrade gracefully until this table
-- exists, so applying it is safe to do at any time.
-- ============================================================================

begin;

create table if not exists public.agent_channel_events (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,        -- e.g. quote_issued | booking_handoff
                                         --      | availability_checked
                                         --      | mcp_tool_call | tour_viewed
  channel         text not null default 'rest',   -- 'rest' | 'mcp'
  slug            text,
  tour_date       date,
  guests          integer,
  api_key_label   text,
  user_agent      text,
  props           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists agent_channel_events_created_at_idx
  on public.agent_channel_events (created_at desc);
create index if not exists agent_channel_events_type_idx
  on public.agent_channel_events (event_type);
create index if not exists agent_channel_events_slug_idx
  on public.agent_channel_events (slug);

alter table public.agent_channel_events enable row level security;

comment on table public.agent_channel_events is
  'Append-only telemetry for the AI agent channel (discover/quote/book funnel). Service-role only; no raw IP stored.';

commit;

-- ── Verification ────────────────────────────────────────────────────────────
-- Expect: table present, rowsecurity = true.
select
  (to_regclass('public.agent_channel_events') is not null) as table_exists,
  relrowsecurity as rls_enabled
from pg_class
where oid = 'public.agent_channel_events'::regclass;
