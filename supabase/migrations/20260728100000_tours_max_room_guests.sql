-- 앱 전반 감사 플랜 §K B2.1 — 스몰그룹 정원 (숫자 컬럼)
--
-- 요구: 스몰그룹 투어는 투어룸당 인원 최대 12인.
--
-- 🔴 B2-D1 — **정원은 판매 차단이 아니라 운영 캡이다.** 초과해도 사이트에
-- "매진"을 띄우지 않는다. 확정 결정이 이미 있다: *온디맨드 = 무한,
-- `product_inventory`가 비어 있는 것은 의도, 희소성 UI 금지*. 이 컬럼으로
-- 재고를 만들면 그 결정을 조용히 뒤집는 것이다. 초과분은 2호차로 분리하고
-- 운영자에게 경고한다.
--
-- 🔴 B2-D2 — **캡의 단위는 `tour_rooms` 행이 아니다.** `tour_rooms.booking_id`가
-- NOT NULL UNIQUE라 룸은 **예약당 1개**다. 순진하게 "룸당 12"로 만들면 예약
-- 1건당 12명이 되어 캡이 사실상 없다. 단위는 B0의 마스터 룸(`ops_tour_groups`)이다.
--
-- 왜 `tours.group_size`를 못 쓰나 (2026-07-24 라이브 실측):
--   select price_type, group_size, count(*) from tours where is_active is not false
--   → person/'Small group' 8건, vehicle/'Small group' 4건.
--   활성 상품 **12개 전부** 같은 자유 텍스트다. 즉 이 컬럼의 정보량은 **0**이고,
--   파싱해봐야 나오는 숫자가 없다. 기계가 읽을 숫자 컬럼이 따로 필요하다.
--   ⚠ `lib/agent/catalog.ts`의 `max_group_size`는 **머천트 카탈로그 필드**이지
--   tours 컬럼이 아니다 — 이름이 비슷해 "이미 있다"고 오판하기 쉽다.
--
-- 기본값은 코드 상수(lib/ops/seating/capacity.ts)가 갖는다. 여기서는 컬럼만
-- 만들고 **명시적으로 정한 상품만** 시딩한다 — NULL은 "이 상품은 값을 정하지
-- 않음"이라는 1급 상태이고, 그때 코드가 price_type 기본값을 쓴다.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 적용 전 점검:
--   -- (a) 컬럼이 이미 있는가? → 0
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='tours' and column_name='max_room_guests';
--   -- (b) 시딩 대상 확인 → 활성 person 상품들
--   select slug, price_type from tours where is_active is not false order by price_type, slug;

alter table tours add column if not exists max_room_guests int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tours_max_room_guests_positive') then
    alter table tours
      add constraint tours_max_room_guests_positive
      check (max_room_guests is null or max_room_guests > 0);
  end if;
end $$;

comment on column tours.max_room_guests is
  'B2.1 스몰그룹 운영 캡(그룹당 최대 인원). NULL = 미설정 → price_type 코드 기본값. 🔴 판매 재고가 아니다 — 초과해도 매진 표시를 만들지 않는다(B2-D1). 해석 순서: ops_tour_groups.capacity → 이 값 → price_type 기본값(lib/ops/seating/capacity.ts).';

-- 스몰그룹(1인당 과금) 활성 상품에 12를 시딩한다.
-- price_type='vehicle'(전세/프라이빗)은 **의도적으로 비운다** — 그쪽 실효 정원은
-- 상품 캡이 아니라 배정 차량의 좌석수다(B2-D4).
update tours
   set max_room_guests = 12
 where max_room_guests is null
   and price_type = 'person'
   and is_active is not false;

-- ============================================================================
-- End. Verify after apply:
--   1. select column_name from information_schema.columns
--       where table_schema='public' and table_name='tours' and column_name='max_room_guests';  → 1행
--   2. select price_type, count(*) filter (where max_room_guests = 12) as capped,
--             count(*) filter (where max_room_guests is null) as unset
--        from tours where is_active is not false group by price_type;
--      → person: capped=8, unset=0 / vehicle: capped=0, unset=4
--   3. select conname from pg_constraint where conname='tours_max_room_guests_positive';       → 1행
--   4. 🔴 판매 표면 회귀는 B2.5가 코드로 증명한다 — 이 마이그레이션만으로는
--      "매진 문구가 안 생겼다"를 보증하지 않는다.
-- ============================================================================
