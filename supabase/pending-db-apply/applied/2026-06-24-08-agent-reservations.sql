-- ============================================================================
-- 2026-06-24-08 — agent_reservations (AI Agent Channel, Phase 3)
-- ============================================================================
-- Isolated table for reservation leads created via the agent channel
-- (/api/agent/v1/book and the MCP create_booking tool).
--
-- Deliberately DECOUPLED from the live `bookings` / `product_inventory`
-- pipeline: the agent path never charges a card and never holds inventory.
-- A reservation here is a "traveller is about to pay at hosted checkout" lead,
-- keyed by an idempotency key so an agent that retries gets the same handoff.
--
-- Writes are service-role only (the agent API uses the service client). RLS is
-- enabled with NO anon/auth policies → denied by default to public clients.
--
-- Idempotent (CREATE … IF NOT EXISTS) and transactional — safe to re-run.
-- The agent `book` path persists best-effort and degrades gracefully until
-- this table exists, so applying it is safe to do at any time.
-- ============================================================================

begin;

create table if not exists public.agent_reservations (
  id                   uuid primary key default gen_random_uuid(),
  idempotency_key      text unique,
  channel              text not null default 'rest',         -- 'rest' | 'mcp'
  slug                 text not null,
  tour_date            date not null,
  guests               integer not null check (guests >= 1),
  unit_price_usd       numeric(10,2),
  estimated_total_usd  numeric(10,2),
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  checkout_url         text,
  status               text not null default 'awaiting_traveller_confirmation',
  api_key_label        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists agent_reservations_created_at_idx
  on public.agent_reservations (created_at desc);
create index if not exists agent_reservations_slug_idx
  on public.agent_reservations (slug);

-- Lock the table down: only the service role (which bypasses RLS) may touch it.
alter table public.agent_reservations enable row level security;

comment on table public.agent_reservations is
  'Reservation leads from the AI agent channel. Decoupled from bookings/inventory; payment happens at hosted checkout. Service-role only.';

commit;

-- ── Verification ────────────────────────────────────────────────────────────
-- Expect: table present, rowsecurity = true.
select
  (to_regclass('public.agent_reservations') is not null) as table_exists,
  relrowsecurity as rls_enabled
from pg_class
where oid = 'public.agent_reservations'::regclass;
