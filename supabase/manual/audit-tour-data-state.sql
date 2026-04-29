-- =============================================================================
-- audit-tour-data-state.sql
-- =============================================================================
-- 현재 Supabase DB의 투어 관련 테이블 전수 감사.
-- 각 SECTION을 개별 실행해서 결과를 확인하세요. 데이터 변경 없음 (SELECT only).
--
-- 목적: 어떤 잔재가 남아있는지 시각화
--   - 어떤 slug 들이 어느 테이블에 흩어져 있는지
--   - 고아(orphan) 행 (다른 테이블엔 있는데 tours에는 없는 product_id/slug)
--   - 비활성/숨김 처리된 옛날 투어
--   - 서로 다른 테이블 간 slug 불일치
-- =============================================================================


-- =============================================================================
-- A. tours 테이블 — 모든 행 (활성/비활성 포함)
-- =============================================================================
SELECT
  slug,
  city,
  tag,
  is_active,
  is_featured,
  created_at,
  updated_at
FROM public.tours
ORDER BY is_active DESC, created_at DESC;


-- =============================================================================
-- B. tour_product_pages — slug 기준 그룹별 (locale 다국어 행 카운트)
-- =============================================================================
SELECT
  slug,
  COUNT(*) AS locale_rows,
  ARRAY_AGG(locale ORDER BY locale) AS locales,
  BOOL_OR(is_published) AS any_published,
  MAX(updated_at) AS latest_update
FROM public.tour_product_pages
GROUP BY slug
ORDER BY latest_update DESC;


-- =============================================================================
-- C. tour_matching_profiles — 모든 product_id
-- =============================================================================
SELECT
  product_id,
  product_type,
  region_type,
  is_active,
  updated_at
FROM public.tour_matching_profiles
ORDER BY updated_at DESC;


-- =============================================================================
-- D. ORPHANS: tour_product_pages 중 tours.slug 에 없는 것
--    (= 페이지는 남았는데 본 투어는 사라진 것)
-- =============================================================================
SELECT
  p.slug,
  p.locale,
  p.is_published,
  p.tour_id,
  p.created_at,
  p.updated_at
FROM public.tour_product_pages p
LEFT JOIN public.tours t ON t.slug = p.slug
WHERE t.slug IS NULL
ORDER BY p.slug, p.locale;


-- =============================================================================
-- E. ORPHANS: tour_matching_profiles 중 tours.slug 에 없는 것
--    (= 매칭 프로필만 남고 투어는 사라진 것)
-- =============================================================================
SELECT
  m.product_id,
  m.product_type,
  m.region_type,
  m.is_active,
  m.updated_at
FROM public.tour_matching_profiles m
LEFT JOIN public.tours t ON t.slug = m.product_id
WHERE t.slug IS NULL
ORDER BY m.product_id;


-- =============================================================================
-- F. ORPHANS: tour_product_offers 중 tour_product_pages 에 없는 것
--    (CASCADE 가 잘 되었으면 0 이어야 함)
-- =============================================================================
SELECT o.id, o.tour_product_page_id, o.label, o.amount_minor, o.currency, o.created_at
FROM public.tour_product_offers o
LEFT JOIN public.tour_product_pages p ON p.id = o.tour_product_page_id
WHERE p.id IS NULL;


-- =============================================================================
-- G. INVERSE: tours 에는 있는데 tour_product_pages 가 없는 슬러그
--    (= 투어 DB는 있지만 마케팅 페이지가 없는 것 — 보통 신규 투어이거나 누락)
-- =============================================================================
SELECT
  t.slug,
  t.is_active,
  t.created_at
FROM public.tours t
LEFT JOIN public.tour_product_pages p ON p.slug = t.slug
WHERE p.slug IS NULL
ORDER BY t.slug;


-- =============================================================================
-- H. INVERSE: tours 에는 있는데 tour_matching_profiles 가 없는 슬러그
-- =============================================================================
SELECT
  t.slug,
  t.is_active,
  t.created_at
FROM public.tours t
LEFT JOIN public.tour_matching_profiles m ON m.product_id = t.slug
WHERE m.product_id IS NULL
ORDER BY t.slug;


-- =============================================================================
-- I. 비활성 (is_active = FALSE) 또는 숨김 처리된 tours — 옛날 투어 잔재 후보
-- =============================================================================
SELECT slug, city, tag, is_active, created_at, updated_at
FROM public.tours
WHERE is_active = FALSE
ORDER BY updated_at DESC;


-- =============================================================================
-- J. 비활성 tour_product_pages — 미공개 페이지
-- =============================================================================
SELECT slug, locale, is_published, tour_id, updated_at
FROM public.tour_product_pages
WHERE is_published = FALSE
ORDER BY slug, locale;


-- =============================================================================
-- K. 카운트 요약 — 전체 그림
-- =============================================================================
SELECT 'tours (total)'                     AS metric, COUNT(*) AS count FROM public.tours
UNION ALL SELECT 'tours (active)',                    COUNT(*) FROM public.tours WHERE is_active = TRUE
UNION ALL SELECT 'tour_product_pages (rows)',         COUNT(*) FROM public.tour_product_pages
UNION ALL SELECT 'tour_product_pages (distinct slug)', COUNT(DISTINCT slug) FROM public.tour_product_pages
UNION ALL SELECT 'tour_product_pages (published)',    COUNT(*) FROM public.tour_product_pages WHERE is_published = TRUE
UNION ALL SELECT 'tour_product_offers',               COUNT(*) FROM public.tour_product_offers
UNION ALL SELECT 'tour_matching_profiles',            COUNT(*) FROM public.tour_matching_profiles
UNION ALL SELECT 'pickup_points',                     COUNT(*) FROM public.pickup_points
UNION ALL SELECT 'product_inventory',                 COUNT(*) FROM public.product_inventory
UNION ALL SELECT 'bookings (total)',                  COUNT(*) FROM public.bookings
UNION ALL SELECT 'bookings (orphan tour_id IS NULL)', COUNT(*) FROM public.bookings WHERE tour_id IS NULL;
