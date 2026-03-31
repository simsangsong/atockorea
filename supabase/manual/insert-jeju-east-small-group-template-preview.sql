-- =============================================================================
-- Preview tour: Jeju East small-group style (DB seed for future template wiring)
-- =============================================================================
-- Slug: jeju-east-small-group-template-preview
--
-- Run in: Supabase Dashboard → SQL Editor (recommended), or psql against your
--         production/staging Postgres that already has the full `tours` shape
--         used by the app (see insert-east-signature-nature-core-join.sql).
--
-- Depends on: `tours` columns used below (badges, highlight, difficulty,
--             group_size, translations, itinerary_details, etc.). If
--             `itinerary_details` is missing, run:
--             supabase/tours-seo-and-details-schema.sql first, or remove the
--             itinerary_details line from the INSERT column list and VALUES.
--
-- Idempotent: upserts by slug, replaces pickup_points for this tour only.
-- Safe if this slug has no bookings referencing pickup_points (preview slug).
-- =============================================================================

BEGIN;

INSERT INTO tours (
  title,
  slug,
  city,
  tag,
  subtitle,
  description,
  highlight,
  price,
  original_price,
  price_type,
  image_url,
  gallery_images,
  duration,
  difficulty,
  group_size,
  lunch_included,
  ticket_included,
  pickup_info,
  notes,
  badges,
  highlights,
  includes,
  excludes,
  schedule,
  itinerary_details,
  faqs,
  rating,
  review_count,
  pickup_points_count,
  dropoff_points_count,
  is_active,
  is_featured,
  translations,
  seo_title,
  meta_description
) VALUES (
  'East Jeju Small Group Scenic Day Tour · Template Preview',
  'jeju-east-small-group-template-preview',
  'Jeju',
  'Small group · East Jeju · Preview',
  'A first-time visitor-friendly East Jeju route with balanced scenery, culture, and a calm day flow - preview listing for the new detail template.',
  'A stable East Jeju route that moves naturally from sea and village character to dramatic coastal views near Seongsan, then finishes with a relaxed shoreline stop. Stop order may shift slightly for weather, wind, and crowds while keeping the same overall experience.',
  'Balanced East Jeju in one day — small group, steady pacing.',
  189000.00,
  229000.00,
  'person',
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=85',
  '[
    "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop"
  ]'::jsonb,
  'Approx. 8 hours · East Jeju',
  'Moderate',
  'Small group',
  false,
  false,
  'Pickup time and exact meeting point are confirmed after booking and again the evening before or morning of the tour. Times may vary slightly by hotel area and traffic.',
  'Preview product row for UI/template work. This route is weather- and crowd-aware; your guide may adjust stop order or timing for safety and comfort. Lunch policy follows the fare you book — check the checkout page.',
  '["Join", "Small group", "East Jeju", "First-time friendly", "Template preview"]'::jsonb,
  '[
    "Hamdeok · Seongeup · Lunch stop · Seongsan Ilchulbong area · Seopjikoji · Woljeongri",
    "Designed for first-time East Jeju visitors who want scenery without a rushed pace",
    "Operated with small-group comfort and on-day flexibility"
  ]'::jsonb,
  '[
    "Licensed / professional guide (small group)",
    "Round-trip transport for the scheduled route",
    "Weather-aware routing and pacing"
  ]'::jsonb,
  '[
    "Meals and drinks unless your fare states otherwise",
    "Attraction entrance fees unless explicitly included in your fare",
    "Personal expenses, tips, and travel insurance"
  ]'::jsonb,
  '[
    {"time": "09:00", "title": "Hamdeok Beach", "description": "Bright East Jeju shoreline — an easy, scenic start to the day."},
    {"time": "10:30", "title": "Seongeup Folk Village", "description": "Traditional stone-wall village atmosphere and Jeju heritage."},
    {"time": "12:00", "title": "Lunch", "description": "Midday break before the main afternoon highlights (meal per your fare)."},
    {"time": "13:30", "title": "Seongsan Ilchulbong (area)", "description": "Iconic volcanic crater and coastal drama — one of Jeju''s signature views."},
    {"time": "15:00", "title": "Seopjikoji", "description": "Dramatic cliffs and open ocean — strong photo value; wind possible."},
    {"time": "16:30", "title": "Woljeongri Beach", "description": "Calm coastal finish with café-lined shore and turquoise shallows."}
  ]'::jsonb,
  '[
    {"time": "09:00", "activity": "Hamdeok Beach", "description": "Start with East Jeju''s open shoreline and clear sea colors — gentle walking, high photo value.", "images": ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop"]},
    {"time": "10:30", "activity": "Seongeup Folk Village", "description": "Stone walls, thatched roofs, and a slower village rhythm — cultural context between coastal stops.", "images": ["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop"]},
    {"time": "12:00", "activity": "Lunch", "description": "A timed break to reset before the Seongsan-area afternoon. What''s included depends on your booked fare.", "images": ["https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=600&fit=crop"]},
    {"time": "13:30", "activity": "Seongsan Ilchulbong (area)", "description": "UNESCO-listed volcanic scenery rising from the sea — pacing may vary with crowds and conditions.", "images": ["https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=600&fit=crop"]},
    {"time": "15:00", "activity": "Seopjikoji", "description": "Coastal promontory with wide ocean views; can be windy — dress in light layers.", "images": ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop"]},
    {"time": "16:30", "activity": "Woljeongri Beach", "description": "Relaxed finish with shallow turquoise water and a calm café atmosphere.", "images": ["https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop"]}
  ]'::jsonb,
  '[
    {"question": "Is this tour good for first-time visitors?", "answer": "Yes — the route is designed as a balanced introduction to East Jeju''s signature scenery and pacing."},
    {"question": "Can the stop order change?", "answer": "Yes. Guides may adjust order or timing for weather, wind, traffic, and crowd flow while keeping the same overall experience."},
    {"question": "Is lunch included?", "answer": "It depends on the fare you purchase. This preview row always includes a lunch window in the flow; check your booking product details."},
    {"question": "How many people are in the group?", "answer": "This listing is intended for small-group operation; exact capacity follows the live product settings at booking time."}
  ]'::jsonb,
  4.85,
  127,
  2,
  0,
  true,
  false,
  jsonb_build_object(
    'en', jsonb_build_object(
      'title', 'East Jeju Small Group Scenic Day Tour · Template Preview',
      'subtitle', 'A first-time visitor-friendly East Jeju route with balanced scenery, culture, and calm pacing.',
      'description', 'A stable East Jeju route from shoreline and village character to dramatic coastal views, finishing with a relaxed beach stop. Order may shift slightly for weather and crowds.',
      'pickup_info', 'Pickup time and meeting point are confirmed after booking and again before the tour day.',
      'badges', jsonb_build_array('Join', 'Small group', 'East Jeju', 'Template preview')
    ),
    'ko', jsonb_build_object(
      'title', '제주 동부 소그룹 일일 투어 · 템플릿 프리뷰',
      'subtitle', '첫 방문자도 부담 없이, 동부의 바다·마을·절경을 하루에 담는 균형 잡힌 코스입니다.',
      'description', '해변과 전통 마을의 분위기에서 성산 일대의 절경, 섭지코지 해안, 여유로운 마무리 해변까지 이어지는 동부 코스입니다. 날씨·교통·혼잡도에 따라 순서가 일부 조정될 수 있습니다.',
      'pickup_info', '예약 후 확정되며, 전날 또는 당일 아침에 다시 안내됩니다.',
      'badges', jsonb_build_array('조인', '소그룹', '제주 동부', '템플릿 프리뷰')
    )
  ),
  'East Jeju Small Group Day Tour | Template Preview | AtoCKorea',
  'Preview: small-group East Jeju day tour — Hamdeok, folk village, Seongsan area, Seopjikoji, Woljeongri. Book when live.'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  city = EXCLUDED.city,
  tag = EXCLUDED.tag,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  highlight = EXCLUDED.highlight,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  price_type = EXCLUDED.price_type,
  image_url = EXCLUDED.image_url,
  gallery_images = EXCLUDED.gallery_images,
  duration = EXCLUDED.duration,
  difficulty = EXCLUDED.difficulty,
  group_size = EXCLUDED.group_size,
  lunch_included = EXCLUDED.lunch_included,
  ticket_included = EXCLUDED.ticket_included,
  pickup_info = EXCLUDED.pickup_info,
  notes = EXCLUDED.notes,
  badges = EXCLUDED.badges,
  highlights = EXCLUDED.highlights,
  includes = EXCLUDED.includes,
  excludes = EXCLUDED.excludes,
  schedule = EXCLUDED.schedule,
  itinerary_details = EXCLUDED.itinerary_details,
  faqs = EXCLUDED.faqs,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  pickup_points_count = EXCLUDED.pickup_points_count,
  dropoff_points_count = EXCLUDED.dropoff_points_count,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  translations = EXCLUDED.translations,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  updated_at = NOW();

DELETE FROM pickup_points
WHERE tour_id = (SELECT id FROM tours WHERE slug = 'jeju-east-small-group-template-preview');

INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT
  t.id,
  v.name,
  v.address,
  v.lat,
  v.lng,
  v.pickup_time::TIME
FROM tours t
CROSS JOIN (VALUES
  (
    'Jeju Airport — domestic terminal (example)',
    'Jeju International Airport — meet at the agreed domestic gate/area (confirmed after booking)',
    33.51130000::numeric,
    126.49300000::numeric,
    '08:30:00'
  ),
  (
    'Jeju City hotels (example zone)',
    'Jeju-si hotel zone — exact lobby pickup confirmed after booking',
    33.49960000::numeric,
    126.53120000::numeric,
    '08:45:00'
  )
) AS v(name, address, lat, lng, pickup_time)
WHERE t.slug = 'jeju-east-small-group-template-preview';

COMMIT;

-- Optional verification
SELECT
  t.id,
  t.slug,
  t.title,
  t.is_active,
  COUNT(pp.id) AS pickup_point_rows
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'jeju-east-small-group-template-preview'
GROUP BY t.id, t.slug, t.title, t.is_active;
