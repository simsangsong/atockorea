-- 앱 전반 감사 플랜 §L L2 — Tier 1 컨시어지 응답 캐시
--
-- 같은 투어의 12명이 같은 질문을 하면 지금은 LLM을 12번 친다.
-- 손님 질문은 실제로 겹친다("화장실 어디예요", "몇 시에 출발해요").
--
-- 🔴 L-D1 — 절감은 **더 빨라지면서** 이뤄져야 한다. 히트 = LLM 0콜 + 인덱스
-- 조회 한 번(수십 ms). 미스면 현행과 완전히 동일한 경로다.
--
-- 🔴 L-D3 — 키에 컨텍스트 버전이 들어간다. 컨텍스트를 무시한 캐시는 "이미
-- 지난 스팟의 답"을 다음 손님에게 주고, 그건 절감이 아니라 오정보 생산이다.
-- 버전이 바뀌면 키가 바뀌므로 무효화 코드가 따로 필요 없다.
--
-- 🔴 질문 원문을 저장하지 않는다. 저장하는 것은 sha256 키·로케일·답변뿐이다.
-- 손님 자유 텍스트가 캐시 테이블로 새면 PII 표면이 하나 더 생긴다.
-- (답변에는 손님 정보가 없다 — Tier 1 프롬프트의 컨텍스트가 투어 단위이고
--  이름·연락처·예약번호를 포함하지 않는다. `conciergeCache.ts` 주석 참조.)
--
-- 보존: 컨텍스트 버전에 시각 버킷이 들어가 행이 자연히 낡는다 → 7일 퍼지.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='ops_concierge_cache';   → 0

create table if not exists ops_concierge_cache (
  id uuid primary key default gen_random_uuid(),
  -- §2 명명 규칙: 모든 ops_* 는 tenant_id DEFAULT 'atockorea'.
  tenant_id text not null default 'atockorea',

  -- sha256(정규화질문 + locale + contextVersion). 질문 원문은 저장하지 않는다.
  cache_key text not null,
  locale text not null,
  -- 디버깅용(어떤 상황의 답인지). 판정은 cache_key가 한다.
  context_version text not null,
  answer text not null,

  created_at timestamptz not null default now(),

  constraint ops_concierge_cache_key_unique unique (cache_key)
);

create index if not exists ops_concierge_cache_created_idx
  on ops_concierge_cache (created_at);

alter table ops_concierge_cache enable row level security;

-- service-role 전용 (기존 ops_* 컨벤션): 정책 0개 + 클라이언트 role 권한 회수.
revoke all on ops_concierge_cache from anon, authenticated;

comment on table ops_concierge_cache is
  '§L L2 Tier 1 컨시어지 응답 캐시. 키 = sha256(정규화질문+locale+contextVersion). 질문 원문 미저장. 컨텍스트(투어·스팟·라이프사이클·자유시간·30분 시각버킷)가 바뀌면 키가 바뀌므로 별도 무효화가 없다. 7일 퍼지.';
comment on column ops_concierge_cache.context_version is
  '디버깅용 원문(어떤 상황의 답인가). 히트 판정은 cache_key만 본다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select count(*) from information_schema.tables
--       where table_schema='public' and table_name='ops_concierge_cache';   → 1
--   2. select relrowsecurity from pg_class where relname='ops_concierge_cache'; → t
--   3. select count(*) from pg_policies where tablename='ops_concierge_cache';  → 0
--   4. select has_table_privilege('anon','ops_concierge_cache','SELECT');       → false
--   5. 적용 직후 0행. 첫 Tier1 질문 후 1행, 같은 질문 재시도 시 여전히 1행이면
--      캐시가 실제로 히트한 것이다(ops_ai_usage.cache_hit=true도 함께 확인).
-- ============================================================================
