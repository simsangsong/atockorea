-- =============================================================================
-- DANGER: 영구 격리·레거시 투어 행을 DB에서 삭제 (코드: lib/tour-consumer-visibility.ts 와 동기)
--
-- 실행 전:
--   1) Supabase 백업 / 스테이징에서 먼저 검증
--   2) 해당 tour_id 를 참조하는 예약(bookings)이 있으면 함께 삭제됨 (주문·정산 정책 확인)
--
-- 포함:
--   A) CONSUMER_BLOCKED_TOUR_IDS / CONSUMER_BLOCKED_TOUR_SLUGS + 접두 slug 패턴
--   B) 동부 시그니처 «중복 / 조인용» SKU (slug 패턴) + tour_matching_profiles 의 east 상품 키
--   C) [주석] 동부 플래그십 marketing 행(tour_product_pages)까지 제거 — /tour-product/east-signature-nature-core 가 DB 없이도
--      앱 정적 번들로만 동작하게 할 때만 주석 해제
--
-- 트랜잭션으로 한 번에 실행하는 것을 권장합니다.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 대상 tour UUID 집합 (앱 blocklist + slug/LIKE 로 추가)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _tours_to_delete (id UUID PRIMARY KEY) ON COMMIT DROP;

-- A1) 고정 UUID (lib/tour-consumer-visibility.ts CONSUMER_BLOCKED_TOUR_IDS)
INSERT INTO _tours_to_delete (id) VALUES
  ('97877063-e982-4754-a4d9-daa8688a5455'::uuid),
  ('59877dce-5425-42f4-bd59-cc4e816fdc39'::uuid),
  ('0288eb78-b741-4bcf-821f-523518906753'::uuid),
  ('d7187d55-a482-4d5c-9d5a-ab6992448d82'::uuid),
  ('dd4a604c-e328-4d24-b060-f6f4e31266ad'::uuid),
  ('357e63a6-59fd-4e55-a5f7-11d766ed1aa5'::uuid),
  ('b0bd462c-a1a8-4ec6-92d7-f275335f8762'::uuid),
  ('592ac1da-9ea2-4ac0-8cd5-26efbbf75699'::uuid)
ON CONFLICT DO NOTHING;

-- A2) 정확 slug (CONSUMER_BLOCKED_TOUR_SLUGS)
INSERT INTO _tours_to_delete (id)
SELECT t.id FROM public.tours t
WHERE lower(t.slug) IN (
  'busan-top-attractions-authentic-one-day-guided-tour',
  'busan-city-tour-shore-excursion-cruise-guests',
  'jeju-southern-top-unesco-spots-bus-tour',
  'jeju-island-full-day-tour-cruise-passengers',
  'jeju-eastern-unesco-spots-bus-tour'
)
ON CONFLICT DO NOTHING;

-- A3) 접두 기반 레거시 (isTourSlugBlockedFromConsumerSurfaces 와 동일 정책)
INSERT INTO _tours_to_delete (id)
SELECT t.id FROM public.tours t
WHERE lower(t.slug) LIKE 'private-busan-tour-discover-top-sights%'
   OR lower(t.slug) LIKE 'jeju-private-car-charter-tour%'
   OR lower(t.slug) LIKE 'busan-top-attractions-authentic-one-day-guided-tour%'
ON CONFLICT DO NOTHING;

-- B1) 동부 시그니처 «패밀리» 중복 SKU (카탈로그에서 숨김 처리되던 slug 들). canonical catalog slug 는 아래 B2에서 선택적으로만 제거.
INSERT INTO _tours_to_delete (id)
SELECT t.id FROM public.tours t
WHERE lower(t.slug) = 'jeju-east-small-group-template-preview'
   OR lower(t.slug) LIKE 'east-signature-nature-core-%'
   OR (
        lower(t.slug) LIKE 'east-jeju-signature-small-group%'
        AND lower(t.slug) <> 'east-jeju-signature-small-group'
     )
ON CONFLICT DO NOTHING;

-- B2) [선택] 동부 카탈로그용 단일 행(east-signature-nature-core / east-jeju-signature-small-group)까지 DB에서 없애려면
--      아래 두 줄의 주석을 해제하세요. (/tour/[id] 예약·체크아웃만 쓰던 행이 사라집니다.)
-- INSERT INTO _tours_to_delete (id)
-- SELECT t.id FROM public.tours t
-- WHERE lower(t.slug) IN ('east-signature-nature-core', 'east-jeju-signature-small-group')
-- ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 의존 행 삭제 (bookings 가 tours 에 ON DELETE RESTRICT 인 스키마 기준)
-- ---------------------------------------------------------------------------
DELETE FROM public.reviews r
  USING _tours_to_delete d
 WHERE r.tour_id = d.id;

DELETE FROM public.pickup_points p
  USING _tours_to_delete d
 WHERE p.tour_id = d.id;

DELETE FROM public.wishlist w
  USING _tours_to_delete d
 WHERE w.tour_id = d.id;

DELETE FROM public.cart_items c
  USING _tours_to_delete d
 WHERE c.tour_id = d.id;

DELETE FROM public.bookings b
  USING _tours_to_delete d
 WHERE b.tour_id = d.id;

DELETE FROM public.tours t
  USING _tours_to_delete d
 WHERE t.id = d.id;

-- ---------------------------------------------------------------------------
-- B3) 매칭 프로필에서 동부 논리 상품 키 제거 (앱 시드와 동일 product_id)
--     다른 상품(southwest, jeju-grand-highlights-loop)은 건드리지 않음.
-- ---------------------------------------------------------------------------
DELETE FROM public.tour_matching_profiles
WHERE product_id = 'east-signature-nature-core';

-- ---------------------------------------------------------------------------
-- C) [주석] tour_product 마케팅 행까지 삭제 — /tour-product/east-signature-nature-core 가 Supabase 없이만 돌릴 때
--     실행 시 tour_product_offers 가 FK 로 페이지에 묶여 있으므로 offers 먼저 삭제.
-- ---------------------------------------------------------------------------
-- DELETE FROM public.tour_product_offers o
--   USING public.tour_product_pages p
--  WHERE o.tour_product_page_id = p.id
--    AND p.product_id = 'east-signature-nature-core';
--
-- DELETE FROM public.tour_product_pages
--  WHERE product_id = 'east-signature-nature-core';

COMMIT;

-- =============================================================================
-- 실행 후 검증 예시
-- =============================================================================
-- SELECT id, slug, title FROM public.tours
--  WHERE id IN (
--    '97877063-e982-4754-a4d9-daa8688a5455'::uuid,
--    ...
--  );
-- SELECT * FROM public.tour_matching_profiles WHERE product_id = 'east-signature-nature-core';
