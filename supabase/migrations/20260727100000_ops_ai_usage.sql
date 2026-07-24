-- 앱 전반 감사 플랜 §L L0 — LLM 호출 계측
--
-- 배경: §F는 "투어 1건당 LLM 호출 < 30회"를 예산으로 적어놨는데, 그 숫자를
-- 셀 수 있는 코드가 저장소 어디에도 없다. 계측 없는 예산은 문서이지 방어선이
-- 아니다 — 지금까지 "호출을 줄였다"는 주장은 전부 검증 불가능했다.
--
-- 이 테이블은 `lib/ai/router.ts`의 chatCompletion 단 한 곳에서 기록된다.
-- 호출부가 늘어도 계측은 자동으로 따라온다(= 8번째 호출부가 계측을 빠뜨릴
-- 방법이 없다). 기록은 fire-and-forget이라 응답 지연에 0ms를 더한다 —
-- §L-D1("절감이 손님을 기다리게 하면 채택하지 않는다")이 계측 자신에게도
-- 적용된다.
--
-- 🔴 이건 원장이 아니라 텔레메트리다. 그래서:
--   - booking_id는 ON DELETE CASCADE. 예약이 지워지면 같이 지워진다.
--     (ops_entity_ledger가 SET NULL이라 시뮬 정리 후 고아 행을 남긴 전례가
--      있는데 — A-plan-review R8 — 그건 그게 원장이라 그렇다. 텔레메트리를
--      고아로 남기면 집계만 오염된다.)
--   - 30일 퍼지 대상이다(§L L0). 비용 추세는 월 단위면 충분하고, 질문 원문은
--     여기 저장하지 않으므로 장기 보관할 이유가 없다.
--
-- 🔴 질문/응답 본문은 저장하지 않는다. purpose·provider·model·토큰 수·지연만
-- 남긴다. 손님 자유 텍스트가 계측 테이블로 새면 PII 표면이 하나 더 생긴다.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일: additive만, tenant_id 기본값,
-- RLS enabled + 정책 0개(서버 라우트가 service role로만 접근).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값을 각 줄에 적어둔다):
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 0행이어야 한다.
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name='ops_ai_usage';
--
--   -- (b) 참조 대상 확인 → 1행.
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name='bookings';
--
--   -- (c) 이 마이그레이션은 아무 행도 넣지 않는다. 적용 직후 0행.

-- ============================================================================
-- ops_ai_usage — LLM 호출 1건 = 1행
-- ============================================================================
create table if not exists ops_ai_usage (
  id uuid primary key default gen_random_uuid(),
  -- §2 명명 규칙: 모든 ops_* 는 tenant_id DEFAULT 'atockorea'.
  -- 2026-07-24에 이 규칙을 두 번 빠뜨렸다(§14.6 G1 — 다이닝 3테이블·카드세트).
  tenant_id text not null default 'atockorea',

  -- lib/ai/router.ts AiPurpose와 같은 어휘. CHECK을 걸지 않는다 — 새 purpose가
  -- 추가될 때 계측이 먼저 깨지면 안 된다(계측이 기능을 막는 것은 본말전도).
  purpose text not null,
  provider text not null,
  model text not null,

  -- 어느 투어의 비용인가. §F "투어 1건당 호출 수"는 이 컬럼 없이는 못 센다.
  -- 오프라인 배치(POI 영상 스크립트 등)는 NULL이고, 그건 손님 경로 비용이
  -- 아니므로 투어당 예산 집계에서 자연히 빠진다.
  booking_id uuid references bookings(id) on delete cascade,

  -- 프로바이더가 usage를 안 주면 NULL. 추정치를 넣지 않는다 —
  -- 추정 토큰으로 만든 비용 그래프는 틀린 숫자를 확신하게 만든다.
  tokens_in int,
  tokens_out int,

  -- true = LLM을 치지 않고 캐시/사전에서 답한 건. 절감 효과의 분자다.
  -- (히트는 chatCompletion을 통과하지 않으므로 호출부가 직접 기록한다.)
  cache_hit boolean not null default false,

  latency_ms int,

  -- ok = 응답 수신 / failed = 사다리 전부 실패 / skipped = 예산 소진·휴리스틱 차단.
  -- failed와 skipped를 구분해야 "예산이 잘 막았다"와 "장애로 못 썼다"가 갈린다.
  outcome text not null default 'ok',

  created_at timestamptz not null default now()
);

-- 주 조회 두 가지: 기간별 총량, 투어별 총량.
create index if not exists ops_ai_usage_created_idx
  on ops_ai_usage (tenant_id, created_at desc);
create index if not exists ops_ai_usage_booking_idx
  on ops_ai_usage (booking_id) where booking_id is not null;

alter table ops_ai_usage enable row level security;

-- service-role 전용 (기존 ops_* 컨벤션): 정책 0개 + 클라이언트 role 권한 회수.
revoke all on ops_ai_usage from anon, authenticated;

comment on table ops_ai_usage is
  '§L L0 LLM 호출 계측. lib/ai/router.ts chatCompletion 한 곳에서 fire-and-forget 기록. 질문/응답 본문은 저장하지 않는다. 30일 퍼지 대상(플라이휠 크론).';
comment on column ops_ai_usage.booking_id is
  '투어당 예산(§F "1건당 < 30회") 집계 키. 오프라인 배치는 NULL이고 투어당 집계에서 제외된다.';
comment on column ops_ai_usage.cache_hit is
  'true = LLM 미호출(캐시/Tier0 사전). 절감 효과의 분자. 히트는 chatCompletion을 통과하지 않으므로 호출부가 직접 기록한다.';
comment on column ops_ai_usage.outcome is
  'ok | failed(사다리 전부 실패) | skipped(예산 소진·휴리스틱 차단). 예산 방어와 장애를 구분하기 위해 나눈다.';
comment on column ops_ai_usage.tokens_in is
  '프로바이더가 usage를 주지 않으면 NULL. 추정치를 넣지 않는다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select table_name from information_schema.tables
--       where table_schema='public' and table_name='ops_ai_usage';            → 1행
--   2. select relrowsecurity from pg_class where relname='ops_ai_usage';      → t
--      정책은 0개 그대로.
--   3. select count(*) from pg_policies where tablename='ops_ai_usage';       → 0
--   4. select indexname from pg_indexes where tablename='ops_ai_usage';       → pkey + 2
--   5. 적용 직후 행은 0개. 첫 LLM 호출 후 1행이 생기는지로 배선을 확인한다.
-- ============================================================================
