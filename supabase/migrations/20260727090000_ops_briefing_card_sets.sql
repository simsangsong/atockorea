-- AtoC 통합 플랜 §5.4 C-17 — 시작 브리핑 카드 세트 사전 설정
--
-- 배경: C-16이 시작 게이트를 캡슐 1장 → 5장 스택으로 만들면서 스택을
-- `lib/ops/seating/cards/stack.ts`의 선언적 배열 한 곳에 몰아뒀다. C-17이
-- 요구하는 것은 그 배열을 "설정"으로 구동하는 것이다:
--   "카드 내용은 사전 설정: /admin/tour-ops 룸 설정에서 카드 세트·순서·포함
--    여부 편집 (기본값 = 투어 상품별 기본 세트, 룸 단위 오버라이드)"
--
-- 즉 레벨이 정확히 둘이다 — 투어 상품 기본값과 룸 오버라이드. 한 테이블에
-- scope 판별자로 담는다(두 테이블로 나누면 리졸버가 두 벌이 된다):
--
--   scope='tour', scope_id=tours.id       → 그 상품의 기본 세트
--   scope='room', scope_id=tour_rooms.id  → 그 룸만의 오버라이드
--
-- 🔴 코드 기본값이 최종 폴백이다. 행이 없거나 card_ids가 NULL/빈 배열이면
-- 애플리케이션은 DEFAULT_BRIEFING_CARD_IDS(출고 5장, 출고 순서)를 쓴다.
-- 설정 행 하나가 빠졌다고 브리핑이 통째로 사라지는 일은 있을 수 없다.
-- (그래서 card_ids에 NOT NULL을 걸지 않는다 — NULL = "이 레벨은 세트를
-- 정의하지 않음"이라는 1급 상태다. 옵션만 오버라이드하고 순서는 상속받는
-- 케이스가 실제로 흔하다.)
--
-- 편집 가능한 것: 포함 여부 · 순서 · 카드별 옵션 2개
--   options.safety.skip_repeat_boarding (bool) — 재탑승 손님 요약본 (§5.4 C-16 ②)
--   options.lunch.lunch_included        (bool) — tours.lunch_included 오버라이드
-- 편집 불가: 5로케일 문구(사전 번역 상수, LLM 0 — 자유 텍스트로 열면 번역되지
-- 않은 한국어 운영자 문장이 손님에게 그대로 나간다) · push 여부 · subject_key.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일: additive만, RLS enabled + 정책 0개
-- (서버 라우트가 service role로만 접근하고 requireAdmin으로 인가한다).
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 사람 검토 후.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검 (기대값을 각 줄에 적어둔다):
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 0행이어야 한다.
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name='ops_briefing_card_sets';
--
--   -- (b) 참조 대상 테이블 확인 → 2행.
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name in ('tours','tour_rooms');
--
--   -- (c) 시딩 대상 모집단(참고용 — 이 마이그레이션은 아무 행도 넣지 않는다).
--   select count(*) as tours from tours;

-- ============================================================================
-- ops_briefing_card_sets — 카드 세트 사전 설정 (상품 기본값 + 룸 오버라이드)
-- ============================================================================
create table if not exists ops_briefing_card_sets (
  id uuid primary key default gen_random_uuid(),
  -- §2 명명 규칙: 모든 ops_* 는 tenant_id DEFAULT 'atockorea' (B2B 발라내기 대비).
  -- 2026-07-25 감사 G1에서 다이닝 3테이블이 이걸 빠뜨린 채 적용됐던 전례가 있다.
  tenant_id text not null default 'atockorea',

  -- 'tour' = 투어 상품 기본 세트(scope_id=tours.id)
  -- 'room' = 룸 단위 오버라이드(scope_id=tour_rooms.id)
  scope text not null check (scope in ('tour', 'room')),
  -- 🔴 FK를 걸지 않는다: 한 컬럼이 두 테이블을 가리키기 때문(폴리모픽).
  -- 고아 행은 리졸버에서 자연히 무시된다(해당 룸/상품을 조회할 일이 없음).
  scope_id uuid not null,

  -- 보낼 카드 id와 그 순서. NULL = 이 레벨은 세트를 정의하지 않음(상속).
  -- 알 수 없는 id는 애플리케이션이 무시하고, 빈 배열은 NULL과 동일 취급한다
  -- (= 브리핑 0장이 되는 경로를 만들지 않는다).
  card_ids text[],

  -- 카드별 옵션. 정의된 그룹만 오버라이드되고 나머지는 상속된다.
  --   {"safety": {"skip_repeat_boarding": true},
  --    "lunch":  {"lunch_included": null}}
  options jsonb not null default '{}'::jsonb,

  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 레벨당 행 1개 — upsert(onConflict: scope,scope_id)의 대상.
  constraint ops_briefing_card_sets_scope_unique unique (scope, scope_id)
);

-- 카드 세트가 비어 있는 배열로 저장되는 것을 DB에서도 막는다.
-- (애플리케이션이 1차로 막지만, 직접 SQL로 들어오는 경로가 남아 있다.)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ops_briefing_card_sets_card_ids_not_empty'
  ) then
    alter table ops_briefing_card_sets
      add constraint ops_briefing_card_sets_card_ids_not_empty
      check (card_ids is null or array_length(card_ids, 1) >= 1);
  end if;
end $$;

create index if not exists ops_briefing_card_sets_scope_idx
  on ops_briefing_card_sets (scope, scope_id);

alter table ops_briefing_card_sets enable row level security;

-- service-role 전용 (기존 ops_* 컨벤션): 정책 0개 + 클라이언트 role 권한 회수.
revoke all on ops_briefing_card_sets from anon, authenticated;

comment on table ops_briefing_card_sets is
  '§5.4 C-17 시작 브리핑 카드 세트 사전 설정. 2레벨(scope=tour 상품 기본값 / scope=room 룸 오버라이드)이고, 둘 다 없으면 코드 기본값(DEFAULT_BRIEFING_CARD_IDS)이 최종 폴백이다.';
comment on column ops_briefing_card_sets.scope_id is
  'scope=tour면 tours.id, scope=room이면 tour_rooms.id. 폴리모픽이라 FK 없음.';
comment on column ops_briefing_card_sets.card_ids is
  '보낼 카드 id와 순서 (start|safety|schedule|lunch|etiquette). NULL = 이 레벨은 세트를 정의하지 않음 → 다음 레벨/코드 기본값 상속. 빈 배열 금지(CHECK).';
comment on column ops_briefing_card_sets.options is
  '카드별 옵션. safety.skip_repeat_boarding(재탑승 요약본) · lunch.lunch_included(tours.lunch_included 오버라이드). 5로케일 문구는 여기에 저장하지 않는다 — 문구는 사전 번역 상수다.';

-- ============================================================================
-- End. Verify after apply:
--   1. select table_name from information_schema.tables
--       where table_schema='public' and table_name='ops_briefing_card_sets';  → 1행
--   2. select conname from pg_constraint
--       where conname in ('ops_briefing_card_sets_scope_unique',
--                         'ops_briefing_card_sets_card_ids_not_empty');       → 2행
--   3. 빈 배열 거부 확인:
--      insert into ops_briefing_card_sets (scope, scope_id, card_ids)
--        values ('tour', gen_random_uuid(), '{}');  → 반드시 실패해야 한다.
--   4. select relrowsecurity from pg_class where relname='ops_briefing_card_sets'; → t
--      정책은 0개 그대로 (이 마이그레이션은 정책을 만들지 않는다).
--   5. 적용 직후 행은 0개다 — 모든 투어가 코드 기본 5장 스택을 그대로 받는다.
-- ============================================================================
