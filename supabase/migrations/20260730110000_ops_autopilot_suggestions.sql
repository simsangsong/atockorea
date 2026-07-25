-- 관제 W5 — 오토파일럿 제안 큐 (`docs/ops-center-settlement-upgrade-plan-2026-07-25.md` §6)
--
-- ⚠️ `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인**이다. 재사용 금지.
--
-- 설계 원칙(설계안 §1-7): **오토파일럿은 실행하지 않고 제안한다.**
--   제안 큐 → 사람이 승인 → 사람이 실행. 자동 실행은 MVP에서 제외한다.
--   이유는 취향이 아니다: 자동 배정이 틀리면 손님에게 직접 노출되고, 이 저장소가
--   방금 겪은 사고(광범위 자동 변경)와 같은 실패 모드다. 자동화의 이득보다
--   오배정 1건의 비용이 크다.
--
-- 멱등: UNIQUE(tenant_id, subject_key). "지금 점검"을 열 번 눌러도 같은 제안이
-- 열 줄로 쌓이지 않는다. 이미 사람이 처리(done/dismissed)한 제안은 재점검 때
-- 되살아나지 않는다 — 무시한 항목이 매번 돌아오면 큐 전체를 안 보게 된다.
-- 다시 살아나야 하는 것은 **사실이 바뀐 경우**뿐이고, 그때는 subject_key가 같아도
-- detail/severity 가 갱신되며 status는 사람이 되돌린다.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--   select to_regclass('public.ops_autopilot_suggestions');   -- 기대: NULL
-- 적용 후:
--   select relname, relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c where relname = 'ops_autopilot_suggestions';   -- RLS on, 정책 0
-- ─────────────────────────────────────────────────────────────────────────────

create table ops_autopilot_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'atockorea',

  -- 'guide_unassigned' | 'vehicle_unassigned' | 'capacity_over'
  -- | 'rate_missing' | 'settlement_pending'
  kind text not null,
  severity text not null default 'medium' check (severity in ('high', 'medium', 'low')),

  -- 이 제안이 가리키는 대상의 안정 키(예: 'guide_unassigned:<room_id>').
  -- 멱등의 축이자 "같은 문제인가"의 판정 기준.
  subject_key text not null,

  -- 언제의 문제인가. 목록 정렬과 "임박순" 판단에 쓴다.
  tour_date date,

  title text not null,
  detail text,

  -- 화면이 어디로 보낼지, 무엇을 채울지 아는 데 필요한 최소 사실.
  -- 🔴 손님 PII를 넣지 않는다 — 큐는 운영자 여러 명이 보는 화면이다.
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'suggested' check (status in ('suggested', 'done', 'dismissed')),
  resolved_at timestamptz,
  resolved_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, subject_key)
);

-- 큐의 기본 조회 = 미처리 건을 임박순으로.
create index ops_autopilot_suggestions_open_idx
  on ops_autopilot_suggestions (tenant_id, status, tour_date);

comment on table ops_autopilot_suggestions is
  '오토파일럿 제안 큐 (관제 W5). 실행하지 않고 제안한다 — 사람이 승인하고 사람이 실행한다(설계안 §1-7). UNIQUE(tenant_id, subject_key)가 재점검 멱등을 보장한다.';
comment on column ops_autopilot_suggestions.subject_key is
  '제안 대상의 안정 키. 재점검이 같은 제안을 새 행으로 쌓지 않게 하는 축.';
comment on column ops_autopilot_suggestions.payload is
  '화면이 이동·자동채움에 쓰는 최소 사실. 손님 PII 금지 — 운영자 공용 화면이다.';
comment on column ops_autopilot_suggestions.status is
  'suggested = 미처리. done/dismissed 는 사람의 처리 기록이며, 재점검이 이를 suggested 로 되돌리지 않는다(무시한 항목이 매번 돌아오면 큐를 안 보게 된다).';

alter table ops_autopilot_suggestions enable row level security;
revoke all on ops_autopilot_suggestions from anon, authenticated;
