-- =============================================================================
-- 예시: tour_product_pages + tour_product_offers UPSERT 뼈대
-- =============================================================================
-- 실제 detail_payload 본문은 정적 데이터를 JSON으로 덤프해 채움
-- (스크립트 또는 수동) — 구조는 lib/tour-product/detailPayloadV1.ts 참고.
--
-- 기존 투어와 동일 슬러그로 예약/리뷰를 묶으려면 tour_id 를 채운다.
--   SELECT id FROM tours WHERE slug = 'east-signature-nature-core';
-- =============================================================================

/*
BEGIN;

INSERT INTO public.tour_product_pages (
  slug,
  locale,
  is_published,
  sort_order,
  tour_id,
  title,
  subtitle,
  region_label,
  duration_label,
  stops_count,
  rating_avg,
  review_count,
  badges,
  hero_image_url,
  thumbnail_url,
  card_short_description,
  seo_title,
  meta_description,
  headline_line_1,
  headline_line_2,
  price_amount_label,
  price_currency,
  price_per,
  detail_payload
) VALUES (
  'east-signature-nature-core',
  'en',
  TRUE,
  0,
  (SELECT id FROM public.tours WHERE slug = 'east-signature-nature-core' LIMIT 1),
  'Jeju East Volcano, Coast & Village Small Group Tour',
  'Geology to coast. Cave to village to sea.',
  'East Jeju',
  '8 hrs',
  6,
  4.8,
  127,
  ARRAY['First-Time Friendly', 'East Jeju'],
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80',
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80',
  'A structured East Jeju day: geology, lava cave, village texture, and the coast—in one calm sequence.',
  'Jeju East Volcano, Coast & Village Small Group Tour | AtoCKorea',
  'Stone to coast — small-group East Jeju day tour.',
  'Jeju East Volcano, Coast & Village',
  'Small Group Tour',
  '87576',
  'KRW',
  'person',
  '{"schema_version": 1}'::jsonb
)
ON CONFLICT (slug, locale) DO UPDATE SET
  is_published = EXCLUDED.is_published,
  tour_id = EXCLUDED.tour_id,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  region_label = EXCLUDED.region_label,
  duration_label = EXCLUDED.duration_label,
  stops_count = EXCLUDED.stops_count,
  rating_avg = EXCLUDED.rating_avg,
  review_count = EXCLUDED.review_count,
  badges = EXCLUDED.badges,
  hero_image_url = EXCLUDED.hero_image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  card_short_description = EXCLUDED.card_short_description,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  headline_line_1 = EXCLUDED.headline_line_1,
  headline_line_2 = EXCLUDED.headline_line_2,
  price_amount_label = EXCLUDED.price_amount_label,
  price_currency = EXCLUDED.price_currency,
  price_per = EXCLUDED.price_per,
  updated_at = NOW();

-- INSERT INTO public.tour_product_offers (...)
--   ON CONFLICT DO NOTHING;

COMMIT;
*/

SELECT 'Uncomment and paste JSON into detail_payload before running.' AS note;
