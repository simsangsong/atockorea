-- AtoC 통합 Phase 1 slice 1 — ops parse stack (kursoflow 5-layer parser port)
-- Consolidation plan §2 (ops_* prefix + tenant_id text DEFAULT 'atockorea'),
-- §3 파이프라인 A (인박스 → 파싱 → 커밋), §11.D D1 (ops_channel_product_map.tour_kind).
--
-- DDL ported from kursoflow migrations (20260518110000_parse_cache /
-- 20260518120000_parse_learning / 20260521090000_parse_failures /
-- 20260521100000_parse_rule_governance / 20260604120000_parse_rule_shadow_stats)
-- with three deliberate changes:
--   1. ops_ table prefix (D2 — 기존 tour_room_* / bookings 절대 무변경, additive만).
--   2. tenant_id uuid REFERENCES tenants → tenant_id text NOT NULL DEFAULT 'atockorea'
--      (atockorea에는 tenants 테이블이 없음; B2B 발라내기 대비 컬럼만 유지).
--   3. RLS: service-role 전용 — RLS enabled, 정책 0개, anon/authenticated 권한 회수.
--      모든 접근은 서버측 service-role 클라이언트(RLS bypass)로만 이루어진다.
--
-- ⚠ 적용 금지 상태로 파일만 커밋 (이번 슬라이스 범위). 적용은 다음 슬라이스에서
--   사람 확인 후 진행.

-- ============================================================================
-- ops_parse_cache — full-blob fingerprint cache (funnel L0)
-- Same raw paste/email body → previously-parsed result. Keyed by
-- SHA-256(tenant_id || raw)  (lib/ops/parse/fingerprint.ts).
-- ============================================================================
create table ops_parse_cache (
  fingerprint text primary key,
  tenant_id text not null default 'atockorea',
  parsed jsonb not null,
  model_used text,
  hit_count int not null default 1,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now()
);

create index ops_parse_cache_tenant_idx
  on ops_parse_cache (tenant_id, last_hit_at desc);

comment on table ops_parse_cache is
  'Ops parse L0 cache: whole-input fingerprint lookup. Skips L1-L4 when an identical input re-parses.';

-- ============================================================================
-- ops_parse_row_cache — per-row fingerprint cache (L0 partial)
-- ============================================================================
create table ops_parse_row_cache (
  row_hash text primary key,
  tenant_id text not null default 'atockorea',
  parsed jsonb not null,
  model_used text,
  created_at timestamptz not null default now()
);

create index ops_parse_row_cache_tenant_idx
  on ops_parse_row_cache (tenant_id, created_at desc);

comment on table ops_parse_row_cache is
  'Ops parse L0 partial cache: per-row fingerprint lookup for mixed inputs where only some rows changed.';

-- ============================================================================
-- ops_parse_rules — template-mined regex rules (shadow → candidate → active)
-- Includes the governance columns (promotion metadata — Hard Rule "no silent
-- active rule") and stats columns used by lib/ops/parse/rules.ts + shadow.ts +
-- rule-governance.ts.
-- ============================================================================
create table ops_parse_rules (
  id uuid primary key default gen_random_uuid(),
  -- NULL tenant_id = platform-scope rule (rules.ts: tenant_id.eq.X OR tenant_id.is.null)
  tenant_id text default 'atockorea',
  scope text not null,
  template_pattern text not null,
  slot_map jsonb not null,
  postprocess jsonb,

  source text not null check (source in ('manual','auto_mined','imported')),
  match_count int not null default 0,
  success_count int not null default 0,
  conflict_count int not null default 0,

  status text not null default 'shadow'
    check (status in ('shadow','candidate','active','retired')),

  -- governance metadata (promotion audit trail)
  promoted_by uuid,
  promotion_reason text,
  validated_fixture text,

  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  retired_at timestamptz,
  notes text
);

create index ops_parse_rules_active_idx on ops_parse_rules (tenant_id, status, scope);

comment on table ops_parse_rules is
  'Ops parse L2.5 rules: mined templates. Shadow runs alongside LLM; promotion to active requires promotion metadata (governance).';

-- Shadow-stat accrual RPC (shadow.ts persistShadowStats). tenant_id is text here
-- (kursoflow original was uuid).
create or replace function increment_ops_parse_rule_stats(
  p_tenant_id text,
  p_stats jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if p_tenant_id is null or p_stats is null then
    return;
  end if;
  for r in select * from jsonb_array_elements(p_stats)
  loop
    update ops_parse_rules
       set match_count   = coalesce(match_count, 0)   + greatest(0, coalesce((r->>'matched')::int, 0)),
           success_count = coalesce(success_count, 0) + greatest(0, coalesce((r->>'agreed')::int, 0))
     where id = (r->>'rule_id')::uuid
       and tenant_id = p_tenant_id
       and status = 'shadow';
  end loop;
end;
$$;

revoke all on function increment_ops_parse_rule_stats(text, jsonb) from public;
grant execute on function increment_ops_parse_rule_stats(text, jsonb) to service_role;

comment on function increment_ops_parse_rule_stats(text, jsonb) is
  'Atomically accrue shadow-rule match/agreement stats (tenant-scoped, shadow-only). Service-role only.';

-- ============================================================================
-- ops_parse_failures — masked failure corpus (PII 마스킹 구조 유지)
-- raw_line_masked is PII-free (maskLine().masked output) — no encrypted column,
-- no retention job needed. Powers failure TOP-N analytics + parser autopilot.
-- ============================================================================
create table ops_parse_failures (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- PII-free excerpt — email/phone/known-locations tokenized by maskLine().
  raw_line_masked text not null,

  -- Provenance hint from the shape classifier (ParsedInputContext.shape).
  shape text,
  -- Where the failure was detected: 'final_leftover' | 'partial'.
  layer text not null,
  -- Field that was missing/partial (NULL for a whole-block leftover).
  failed_field text,
  reason text,
  -- ops_parse_rules.id when a rule was involved (no FK — rules get retired/deleted).
  rule_id uuid,
  source_platform text,
  -- Did the source block carry a signal for the failed field? Distinguishes
  -- "we missed extractable data" (enrich/review) from "genuinely absent".
  source_signal_present boolean not null default false,

  created_at timestamptz not null default now()
);

create index ops_parse_failures_tenant_idx on ops_parse_failures (tenant_id, created_at desc);
create index ops_parse_failures_field_idx on ops_parse_failures (tenant_id, failed_field, created_at desc);
create index ops_parse_failures_signal_idx on ops_parse_failures (tenant_id, source_signal_present, created_at desc);

comment on table ops_parse_failures is
  'Masked failure corpus (PII-free via maskLine). Final unparsed leftover + source-signal-present partials.';

-- ============================================================================
-- ops_email_parse_logs — 인박스 파이프라인 감사 추적 (plan §3 A-8)
-- 원문 이메일은 절대 저장하지 않는다 (인메모리 처리 후 폐기 — A-2).
-- masked_summary는 maskLine() 마스킹본만 담는다.
-- ============================================================================
create table ops_email_parse_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 채널 식별 (A-3): klook | viator | gyg | kkday | atoc | unknown
  channel text not null default 'unknown',
  -- 의도 분류 (A-4): confirm | cancel | change | unrelated
  intent text,
  -- inbound provider message id (Resend email id) — 멱등 처리 키.
  message_id text,
  -- 발신자/제목/본문 fingerprint (A-3).
  fingerprint text,
  confidence numeric(3,2),
  -- 커밋 결과 (A-6/A-7): auto_committed | review_queued | failed | ignored
  commit_result text,
  booking_id uuid references bookings(id) on delete set null,
  external_booking_id text,
  -- PII-마스킹된 요약만 (원문 금지).
  masked_summary jsonb,
  error text,

  created_at timestamptz not null default now()
);

create unique index ops_email_parse_logs_message_idx
  on ops_email_parse_logs (message_id) where message_id is not null;
create index ops_email_parse_logs_tenant_idx
  on ops_email_parse_logs (tenant_id, created_at desc);
create index ops_email_parse_logs_channel_idx
  on ops_email_parse_logs (tenant_id, channel, created_at desc);

comment on table ops_email_parse_logs is
  '인박스 자동수집 감사 로그 (plan §3 A-8). 원문 이메일 미저장 — 마스킹 요약만.';

-- ============================================================================
-- ops_channel_product_map — OTA 상품명 → tours.id 매핑 (plan §3 A-7b, §11.D D1)
-- 미매핑 상품은 자동 커밋 금지 → 리뷰 큐 강등 (오배치 방지).
-- tour_kind: 파싱 커밋 시 룸에 각인할 프라이빗/조인(버스) 구분 (D1).
-- ============================================================================
create table ops_channel_product_map (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- klook | viator | gyg | kkday | atoc
  channel text not null,
  -- OTA 상품명 원문 (exact-match 키).
  product_name_raw text not null,
  -- 소문자/공백·구두점 제거 정규화 키 (lookup용; normalizeForLookup과 동일 규칙).
  product_name_normalized text not null,
  tour_id uuid not null references tours(id) on delete cascade,
  -- §11.D D1 — 프라이빗 vs 조인(버스)투어 구분. tours.price_type과 별개로
  -- 채널 상품 단위 확정값 (버스투어 = 'join').
  tour_kind text not null default 'join' check (tour_kind in ('join','private')),

  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ops_channel_product_map_key_idx
  on ops_channel_product_map (tenant_id, channel, product_name_normalized);
create index ops_channel_product_map_tour_idx
  on ops_channel_product_map (tour_id);

comment on table ops_channel_product_map is
  'OTA 상품명 → tours.id 매핑 + tour_kind(D1). 미매핑 상품은 자동 커밋 금지.';

-- ============================================================================
-- RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
-- service_role은 RLS를 bypass하므로 서버 코드만 접근 가능.
-- ============================================================================
alter table ops_parse_cache enable row level security;
alter table ops_parse_row_cache enable row level security;
alter table ops_parse_rules enable row level security;
alter table ops_parse_failures enable row level security;
alter table ops_email_parse_logs enable row level security;
alter table ops_channel_product_map enable row level security;

revoke all on ops_parse_cache from anon, authenticated;
revoke all on ops_parse_row_cache from anon, authenticated;
revoke all on ops_parse_rules from anon, authenticated;
revoke all on ops_parse_failures from anon, authenticated;
revoke all on ops_email_parse_logs from anon, authenticated;
revoke all on ops_channel_product_map from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 6 tables exist, RLS enabled, no policies (service-role only)
--   2. anon/authenticated cannot select any ops_* table
--   3. increment_ops_parse_rule_stats executable by service_role only
-- ============================================================================
