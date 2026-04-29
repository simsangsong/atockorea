-- =============================================================================
-- delete-deprecated-tours-2026-04-27.sql
-- =============================================================================
-- Purpose: 제주 스몰그룹 3개만 남기고 나머지 7개 투어 정리
--
--   Keep:
--     - east-signature-nature-core
--     - jeju-grand-highlights-loop
--     - southwest-hallasan-osulloc-aewol
--
--   Delete (7):
--     - east-jeju-classic-bus-tour                    (bus)
--     - south-jeju-classic-bus-tour                   (bus)
--     - southwest-jeju-scenic-bus-tour                (bus)
--     - jeju-cruise-shore-excursion-bus-tour          (bus)
--     - jeju-cruise-shore-excursion-small-group-tour  (jeju small-group, deprecated)
--     - busan-top-attractions-authentic-one-day-tour  (busan small-group)
--     - busan-city-tour-shore-excursion-cruise-guests (busan small-group)
--
-- Run in Supabase SQL Editor. Wrapped in BEGIN/COMMIT — review the result panes
-- of the pre-check (step 0) and post-verify (step 5) selects before issuing
-- COMMIT. To dry-run, change `COMMIT;` to `ROLLBACK;` at the bottom.
--
-- Cascade behavior (verified against archived migrations):
--   tours              → pickup_points, product_inventory, reviews,
--                        wishlist, cart_items   (ON DELETE CASCADE)
--                      → bookings.tour_id       (SET NULL or RESTRICT
--                        depending on schema variant — pre-NULL'd in step 1)
--   tour_product_pages → tour_product_offers    (ON DELETE CASCADE)
--   tour_matching_profiles                      (no FK to tours — manual)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Pre-check — confirm exactly 7 rows match before deleting
-- ---------------------------------------------------------------------------
SELECT
  'tours-to-delete' AS label,
  slug,
  city,
  tag,
  is_active
FROM public.tours
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
)
ORDER BY slug;

-- bookings 잔존 여부 — RESTRICT FK 변형 스키마면 사전 NULL 처리 필수
SELECT
  t.slug,
  COUNT(b.id) AS booking_count
FROM public.tours t
LEFT JOIN public.bookings b ON b.tour_id = t.id
WHERE t.slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
)
GROUP BY t.slug
ORDER BY t.slug;

-- ---------------------------------------------------------------------------
-- 1) bookings.tour_id → NULL  (history 보존 + RESTRICT FK 회피)
--    SET NULL 스키마면 무해, RESTRICT 스키마면 다음 단계 실패 방지를 위해 필수.
-- ---------------------------------------------------------------------------
UPDATE public.bookings
SET tour_id = NULL
WHERE tour_id IN (
  SELECT id FROM public.tours
  WHERE slug IN (
    'east-jeju-classic-bus-tour',
    'south-jeju-classic-bus-tour',
    'southwest-jeju-scenic-bus-tour',
    'jeju-cruise-shore-excursion-bus-tour',
    'jeju-cruise-shore-excursion-small-group-tour',
    'busan-top-attractions-authentic-one-day-tour',
    'busan-city-tour-shore-excursion-cruise-guests'
  )
);

-- ---------------------------------------------------------------------------
-- 2) tour_matching_profiles — FK 없음, product_id (= slug) 로 수동 삭제
-- ---------------------------------------------------------------------------
DELETE FROM public.tour_matching_profiles
WHERE product_id IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);

-- ---------------------------------------------------------------------------
-- 3) tour_product_pages — slug 로 삭제 (tour_product_offers 로 CASCADE)
--    tour_id 가 ON DELETE SET NULL 이라 tours 만 지우면 페이지가 NULL 로 남음.
-- ---------------------------------------------------------------------------
DELETE FROM public.tour_product_pages
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);

-- ---------------------------------------------------------------------------
-- 4) tours — pickup_points/product_inventory/reviews/wishlist/cart_items 로 CASCADE
-- ---------------------------------------------------------------------------
DELETE FROM public.tours
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);

-- ---------------------------------------------------------------------------
-- 5) Post-verify — 유지 3개만 남았는지 확인
-- ---------------------------------------------------------------------------
SELECT 'remaining tours' AS label, slug, city, tag
FROM public.tours
ORDER BY slug;

SELECT 'remaining tour_product_pages' AS label, slug, locale, is_published
FROM public.tour_product_pages
ORDER BY slug, locale;

SELECT 'remaining tour_matching_profiles' AS label, product_id, product_type, region_type
FROM public.tour_matching_profiles
ORDER BY product_id;

-- 결과 확인 후 직접 COMMIT 하세요. 잘못됐다면 ROLLBACK.
COMMIT;
-- ROLLBACK;
