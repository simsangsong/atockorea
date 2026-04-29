-- =============================================================================
-- wipe-all-tour-data-2026-04-27.sql
-- =============================================================================
-- 목적: 모든 투어 데이터 (10건) 전부 삭제. 테이블 스키마(템플릿)만 남기고
--       비웁니다. 이후 새 JSON 파일에서 재시드할 준비 완료 상태로 만듭니다.
--
-- 실행 방법: 각 SECTION 을 순서대로 하나씩 실행하세요. (Supabase SQL Editor 가
--           긴 멀티-스테이트먼트를 거부하는 케이스 회피)
--
-- 처리 대상 (행은 모두 비우고 테이블은 유지):
--   - tours                    → CASCADE: pickup_points, product_inventory,
--                                          reviews, wishlist, cart_items
--   - tour_product_pages       → CASCADE: tour_product_offers
--   - tour_matching_profiles   → FK 없음, 직접 삭제 (매칭 프로필)
--   - parsed_intent_cache      → 매칭 쿼리 캐시 — 새 JSON 기반 시스템 위해 wipe
--   - bookings                 → tour_id 만 NULL 처리 (예약 history 보존)
--                                Section 7 로 완전 wipe 옵션 제공
-- =============================================================================


-- =============================================================================
-- SECTION 0 — 시작 전 카운트 (현재 상태 스냅샷)
-- =============================================================================
SELECT 'tours'                        AS table_name, COUNT(*) AS rows FROM public.tours
UNION ALL SELECT 'tour_product_pages',                COUNT(*) FROM public.tour_product_pages
UNION ALL SELECT 'tour_product_offers',               COUNT(*) FROM public.tour_product_offers
UNION ALL SELECT 'tour_matching_profiles',            COUNT(*) FROM public.tour_matching_profiles
UNION ALL SELECT 'pickup_points',                     COUNT(*) FROM public.pickup_points
UNION ALL SELECT 'product_inventory',                 COUNT(*) FROM public.product_inventory
UNION ALL SELECT 'reviews',                           COUNT(*) FROM public.reviews
UNION ALL SELECT 'bookings (total)',                  COUNT(*) FROM public.bookings
UNION ALL SELECT 'bookings (tour_id NOT NULL)',       COUNT(*) FROM public.bookings WHERE tour_id IS NOT NULL;


-- =============================================================================
-- SECTION 1 — bookings.tour_id → NULL (예약 history 보존, RESTRICT FK 회피)
--             예약 자체도 wipe 하려면 SECTION 7 사용
-- =============================================================================
UPDATE public.bookings
SET tour_id = NULL
WHERE tour_id IS NOT NULL;


-- =============================================================================
-- SECTION 2 — tour_matching_profiles 전체 삭제 (FK 없음)
-- =============================================================================
DELETE FROM public.tour_matching_profiles;


-- =============================================================================
-- SECTION 3 — tour_product_pages 전체 삭제
--             CASCADE 로 tour_product_offers 도 함께 비워짐
-- =============================================================================
DELETE FROM public.tour_product_pages;


-- =============================================================================
-- SECTION 4 — tours 전체 삭제
--             CASCADE 로 pickup_points / product_inventory / reviews /
--             wishlist / cart_items 도 함께 비워짐
-- =============================================================================
DELETE FROM public.tours;


-- =============================================================================
-- SECTION 5 — 검증: 모든 테이블이 0 인지
-- =============================================================================
SELECT 'tours'                        AS table_name, COUNT(*) AS rows FROM public.tours
UNION ALL SELECT 'tour_product_pages',                COUNT(*) FROM public.tour_product_pages
UNION ALL SELECT 'tour_product_offers',               COUNT(*) FROM public.tour_product_offers
UNION ALL SELECT 'tour_matching_profiles',            COUNT(*) FROM public.tour_matching_profiles
UNION ALL SELECT 'pickup_points',                     COUNT(*) FROM public.pickup_points
UNION ALL SELECT 'product_inventory',                 COUNT(*) FROM public.product_inventory
UNION ALL SELECT 'reviews',                           COUNT(*) FROM public.reviews
UNION ALL SELECT 'wishlist',                          COUNT(*) FROM public.wishlist
UNION ALL SELECT 'cart_items',                        COUNT(*) FROM public.cart_items;


-- =============================================================================
-- SECTION 6 — 매칭 쿼리 캐시 wipe (테이블 존재할 때만)
--             parsed_intent_cache: "사용자 검색어 → parsed intent JSON" 글로벌 캐시
--             환경에 따라 migration 이 적용 안 된 경우가 있어 IF EXISTS 가드.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'parsed_intent_cache'
  ) THEN
    DELETE FROM public.parsed_intent_cache;
    RAISE NOTICE 'parsed_intent_cache wiped';
  ELSE
    RAISE NOTICE 'parsed_intent_cache 테이블 없음 — 스킵 (정상)';
  END IF;
END $$;


-- =============================================================================
-- SECTION 7 — 선택 (위험): bookings 도 완전 삭제 (history 까지 wipe)
--             완전 새출발 원할 때만. 일반적으로 SECTION 1 만 실행하고 여긴 스킵.
-- =============================================================================
-- DELETE FROM public.bookings;


-- =============================================================================
-- SECTION 8 — 검증: 남은 행이 정확히 0 인지 한 줄 확인
--             (parsed_intent_cache 는 환경에 따라 없을 수 있어 제외)
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM public.tours)                  AS tours,
  (SELECT COUNT(*) FROM public.tour_product_pages)     AS pages,
  (SELECT COUNT(*) FROM public.tour_product_offers)    AS offers,
  (SELECT COUNT(*) FROM public.tour_matching_profiles) AS matching,
  (SELECT COUNT(*) FROM public.pickup_points)          AS pickups,
  (SELECT COUNT(*) FROM public.product_inventory)      AS inventory,
  (SELECT COUNT(*) FROM public.reviews)                AS reviews;
