-- =============================================================================
-- READ-ONLY: 투어 상품 관련 스키마·데이터 점검 (삭제 없음)
-- Supabase SQL Editor 에서 실행 — 운영 DB 정리 전후 스냅샷 비교용
-- =============================================================================

-- 1) 플래그십 페이지·로케일별 행 수
SELECT product_id, locale, slug, is_published, tour_id IS NOT NULL AS has_tour_fk
  FROM public.tour_product_pages
 ORDER BY product_id, locale;

-- 2) 논리 상품당 매칭 프로필 1행인지
SELECT product_id, is_active, profile_version
  FROM public.tour_matching_profiles
 ORDER BY product_id;

-- 3) tour_product_pages.tour_id 가 가리키는 tours 가 없는 고아 행(이상 징후)
SELECT p.id, p.slug, p.locale, p.tour_id
  FROM public.tour_product_pages p
  LEFT JOIN public.tours t ON t.id = p.tour_id
 WHERE p.tour_id IS NOT NULL AND t.id IS NULL;

-- 4) 삭제 대상 슬러그에 대한 예약·리뷰 존재 여부 (tours 삭제 가능 여부)
SELECT t.slug,
       (SELECT COUNT(*) FROM public.bookings b WHERE b.tour_id = t.id) AS bookings,
       (SELECT COUNT(*) FROM public.reviews r WHERE r.tour_id = t.id) AS reviews,
       (SELECT COUNT(*) FROM public.cart_items c WHERE c.tour_id = t.id) AS cart_items
  FROM public.tours t
 WHERE lower(t.slug) IN ('southwest-hallasan-osulloc-aewol', 'jeju-grand-highlights-loop');

-- 5) intent 캐시 행 수 (투어별 아님 — 전역). 오래된 캐시만 정리하려면 별도 정책
SELECT COUNT(*) AS parsed_intent_cache_rows FROM public.parsed_intent_cache;

-- 6) 컬럼 목록 (DROP 전 앱·타입 생성기와 대조)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'tour_product_pages'
 ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'tour_matching_profiles'
 ORDER BY ordinal_position;

-- =============================================================================
-- 선택적 정리 (주석 해제 전 검토)
-- =============================================================================
-- -- 오래된 intent 캐시 전부 비우기 (파서 버전 올릴 때와 함께 권장)
-- TRUNCATE public.parsed_intent_cache;

-- =============================================================================
-- 컬럼 DROP 에 대해
-- tour_product_pages 의 스칼라 컬럼(title, hero_image_url, headline_line_1 등)은
-- 앱 loadTourProductPage / SEO / OG 에서 폴백으로 사용 중입니다.
-- detail_payload JSONB 와 중복이 있어도 운영·시드 호환을 위해 임의 DROP 하지 마세요.
-- Stripe 연동 시 tour_product_offers.stripe_price_id 등은 결제 플로우에서 사용 가능.
-- DROP COLUMN 은 마이그레이션 + `lib/supabase.ts` Database 타입 + 모든 쿼리 수정이 필요합니다.
-- =============================================================================
