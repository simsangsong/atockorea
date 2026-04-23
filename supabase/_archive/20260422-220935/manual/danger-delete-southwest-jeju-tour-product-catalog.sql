-- =============================================================================
-- DANGER: 제거된 앱 SKU — 서남·환도 플래그십 상품 DB 행 삭제
--
-- 앱: /tour-product/southwest-hallasan-osulloc-aewol, /tour-product/jeju-grand-highlights-loop
--      라우트 및 정적 번들 삭제 후 DB 정리용.
--
-- 실행 전:
--   1) Supabase 백업
--   2) 스테이징에서 SELECT 검증 블록 먼저 실행
--   3) east-signature-nature-core 행은 절대 삭제하지 않음
--
-- 순서:
--   tour_product_offers → tour_product_pages 에 ON DELETE CASCADE 이므로 pages 삭제 시 함께 삭제됨
--   tour_matching_profiles 는 product_id PK
--   public.tours 는 예약·장바구니·리뷰 FK 가 있을 수 있음 → 의존 행이 있으면 tours 삭제 스킵
-- =============================================================================

BEGIN;

-- 대상 논리 상품 ID (slug 와 동일)
CREATE TEMP TABLE _drop_products (product_id TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _drop_products (product_id) VALUES
  ('southwest-hallasan-osulloc-aewol'),
  ('jeju-grand-highlights-loop');

-- ---------------------------------------------------------------------------
-- 1) 매칭 프로필 (앱 시드에서도 제거됨)
-- ---------------------------------------------------------------------------
DELETE FROM public.tour_matching_profiles p
 USING _drop_products d
 WHERE p.product_id = d.product_id;

-- ---------------------------------------------------------------------------
-- 2) 투어 상품 페이지 + 오퍼(CASCADE)
-- ---------------------------------------------------------------------------
DELETE FROM public.tour_product_pages p
 WHERE p.product_id IN (SELECT product_id FROM _drop_products)
    OR lower(p.slug) IN ('southwest-hallasan-osulloc-aewol', 'jeju-grand-highlights-loop');

-- ---------------------------------------------------------------------------
-- 3) tours 행 — 의존성 없을 때만 삭제 (bookings / cart / reviews / wishlist / pickup_points)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _tour_ids_to_drop (id UUID PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _tour_ids_to_drop (id)
SELECT t.id
  FROM public.tours t
  JOIN _drop_products d ON lower(t.slug) = lower(d.product_id)
 WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.tour_id = t.id)
   AND NOT EXISTS (SELECT 1 FROM public.cart_items c WHERE c.tour_id = t.id)
   AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.tour_id = t.id)
   AND NOT EXISTS (SELECT 1 FROM public.wishlist w WHERE w.tour_id = t.id)
   AND NOT EXISTS (SELECT 1 FROM public.pickup_points pp WHERE pp.tour_id = t.id)
ON CONFLICT DO NOTHING;

-- 의존 행이 남아 있으면 _tour_ids_to_drop 이 비어 있음 — 아래 DELETE 는 no-op
DELETE FROM public.tours t
 USING _tour_ids_to_drop x
 WHERE t.id = x.id;

COMMIT;

-- =============================================================================
-- 실행 후 검증
-- =============================================================================
-- SELECT product_id FROM public.tour_matching_profiles
--  WHERE product_id IN ('southwest-hallasan-osulloc-aewol','jeju-grand-highlights-loop');
-- SELECT slug, locale, product_id FROM public.tour_product_pages
--  WHERE slug IN ('southwest-hallasan-osulloc-aewol','jeju-grand-highlights-loop')
--     OR product_id IN ('southwest-hallasan-osulloc-aewol','jeju-grand-highlights-loop');
-- SELECT id, slug, title FROM public.tours
--  WHERE slug IN ('southwest-hallasan-osulloc-aewol','jeju-grand-highlights-loop');
