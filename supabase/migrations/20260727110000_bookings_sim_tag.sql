-- 앱 전반 감사 플랜 A0.1 — 시뮬 예약 격리
--
-- 배경 (D8 충돌): `scripts/sim-tour-day.ts`가 라이브 `bookings`에 테스트 예약을
-- 직접 넣는다. 오너가 2026-07-23에 테스트 예약을 전부 지우고 실주문 2건만
-- 남겨둔 상태인데, 시뮬을 돌릴 때마다 그게 되살아난다. 그래서 지금까지
-- UI 검증이 "스크린샷은 의도적 생략"으로 계속 미뤄졌고(§14.6 G9), A5 시뮬과
-- A2 UI 감사가 통째로 막혀 있다.
--
-- 대안 검토 (A-plan-review R8):
--   - 로컬 Supabase: Windows Docker 의존 + 마이그레이션 25개 재현 비용 → 탈락
--   - Supabase 브랜치: 과금이라 오너 승인 전 사용 불가 → 탈락
--   - 날짜 격리(먼 미래 날짜): 앱이 kstToday()로 "오늘의 투어"를 잡기 때문에
--     투어 당일 시나리오 자체가 성립하지 않는다 → 탈락
--   → **행 태깅**. 시뮬 행이 라이브에 살되, 집계와 돈이 그것을 절대 세지 않는다.
--
-- 🔴 이 컬럼의 계약은 "숨기기"가 아니라 "세지 않기"다.
-- 시뮬 예약은 룸·좌석·체크인·명단에서 **정상적으로 보여야 한다** — 그게 시뮬의
-- 목적이다. 배제되는 곳은 딱 두 종류다:
--   ① 집계 (일일보고서 · B1 통합통계 · B2 정원 카운트)
--   ② 돈   (Stripe 캡처 크론 · ops_entity_ledger 법인 원장 · 정산)
-- 30개 가까운 `from('bookings')` 호출부에 전부 필터를 다는 것은 드리프트를
-- 보장하는 설계다(§H-4). 해가 되는 표면만 고른다.
--
-- NULL = 실제 예약. 기본값을 NULL로 두는 이유: 기존 3행과 앞으로 들어올 모든
-- 실주문이 아무것도 안 해도 올바른 쪽에 있어야 한다. 태그는 시뮬이 스스로 붙인다.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--
--   -- (a) 컬럼이 이미 있는가? → 0행이어야 한다.
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='bookings' and column_name='sim_tag';
--
--   -- (b) 기존 데이터 위반 사전 확인 — additive nullable이라 위반 불가.
--   --     참고용으로 현재 예약 수와 과거 시뮬 잔재를 센다.
--   select count(*) as total,
--          count(*) filter (where contact_email like 'sim-%@atockorea.test') as legacy_sim
--     from bookings;

alter table bookings add column if not exists sim_tag text;

-- 실 예약(NULL)만 훑는 부분 인덱스. 집계 쿼리가 타는 쪽이 이쪽이다.
create index if not exists bookings_sim_tag_idx
  on bookings (sim_tag) where sim_tag is not null;

comment on column bookings.sim_tag is
  'A0.1 시뮬 격리. NULL = 실제 예약. 시뮬 시더가 채운다. 룸/좌석/명단에서는 정상 표시되지만 집계(일일보고서·통합통계·정원)와 돈(캡처 크론·법인원장·정산)에서는 제외된다. lib/ops/sim/simScope.ts가 단일 판정 지점.';

-- 과거 시더가 남긴 행(컬럼이 없던 시절)을 소급 태깅한다.
-- 시더가 쓰던 고정 주소 두 개가 유일한 식별자다.
update bookings
   set sim_tag = 'sim'
 where sim_tag is null
   and contact_email in ('sim-tour-mode@atockorea.test', 'sim-tour-ops-admin@atockorea.test');

-- ============================================================================
-- End. Verify after apply:
--   1. select column_name, is_nullable from information_schema.columns
--       where table_schema='public' and table_name='bookings' and column_name='sim_tag';  → 1행 YES
--   2. select count(*) filter (where sim_tag is null) as real,
--             count(*) filter (where sim_tag is not null) as sim from bookings;
--      → real = 실주문 수(적용 시점 3), sim = 소급 태깅된 잔재 수
--   3. select indexname from pg_indexes where tablename='bookings' and indexname='bookings_sim_tag_idx'; → 1행
-- ============================================================================
