-- =============================================================================
-- East Signature Nature Core — small-group (join) day tour
-- =============================================================================
-- Run in Supabase SQL Editor (or psql). Creates one active tour + pickup points.
--
-- After insert:
--   • Web: /tour/<uuid>  or  /tour/east-signature-nature-core-jeju
--   • Page uses SmallGroupTourDetailTemplate + mergeEastSignatureNatureCoreContent
--
-- Adjust price, merchant_id, images, and related slugs as needed.
-- =============================================================================

WITH new_tour AS (
  INSERT INTO tours (
    title,
    slug,
    city,
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
    faqs,
    rating,
    review_count,
    pickup_points_count,
    dropoff_points_count,
    is_active,
    is_featured,
    translations
  ) VALUES (
    'East Signature Nature Core',
    'east-signature-nature-core-jeju',
    'Jeju',
    'A first-time visitor-friendly course that balances East Jeju''s signature scenery with the island''s unique atmosphere.',
    'A core East Jeju route with a stable flow throughout the day — from the sea and a traditional village to dramatic coastal scenery, iconic Seongsan views, and a calm finish at Jeju Stone Park. Stops may be reordered for weather, wind, and crowds.',
    'A first-visit East Jeju course that captures the region''s signature scenery in a balanced, stable way.',
    95000.00,
    NULL,
    'person',
    'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80',
    '[
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop"
    ]'::jsonb,
    'Full day · East Jeju',
    'Moderate',
    'Small group',
    false,
    false,
    'Final pickup time and meeting point are sent after booking and confirmed again the day before or morning of the tour. Times may vary slightly by pickup location and traffic.',
    'This is a small-group scenic route. Order of Seopjikoji / Seongsan-area stops may change for wind, crowds, and road conditions. Lunch cost depends on product setup — see booking page.',
    '["Join", "Small group", "East Jeju", "First-time friendly", "Weather-aware"]'::jsonb,
    '[
      "Hamdeok beach · Seongeup Folk Village · Lunch · Seopjikoji · Seongsan area · Jeju Stone Park",
      "Balanced flow for first-time East Jeju visitors",
      "On-site adjustments for weather and crowds"
    ]'::jsonb,
    '[
      "Professional guide (small group)",
      "Transport for the itinerary",
      "Jeju Stone Park admission if included in your product setup — confirm on booking page"
    ]'::jsonb,
    '[
      "Lunch (unless your fare states otherwise)",
      "Personal expenses",
      "Tips",
      "Travel insurance"
    ]'::jsonb,
    '[
      {"time": "Morning", "title": "Hamdeok Beach", "description": "East Jeju shoreline start."},
      {"time": "Late morning", "title": "Seongeup Folk Village", "description": "Traditional village atmosphere."},
      {"time": "Midday", "title": "Lunch", "description": "Meal break before the Seongsan-area afternoon."},
      {"time": "Afternoon", "title": "Seopjikoji", "description": "Signature coastal grassland and sea."},
      {"time": "Afternoon", "title": "Seongsan area viewpoint", "description": "Symbolic Seongsan Ilchulbong-area scenery."},
      {"time": "Late afternoon", "title": "Jeju Stone Park", "description": "Calmer stone-culture finish."}
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "Depends on how this product is sold — check the booking page. The route always includes a mid-day meal stop."
      },
      {
        "question": "Can the route order change?",
        "answer": "Yes. Seopjikoji and Seongsan-area stops are sensitive to wind, traffic, and crowds; order may shift to protect same-day comfort."
      }
    ]'::jsonb,
    0,
    0,
    2,
    2,
    true,
    false,
    jsonb_build_object(
      'ko', jsonb_build_object(
        'title', '동부 시그니처 네이처 코어',
        'subtitle', '제주 첫 방문에도 부담 없이, 동부 시그니처 풍경과 섬의 분위기를 균형 있게 담은 코스입니다.',
        'highlight', '동부 시그니처를 하루에 안정적으로',
        'badges', jsonb_build_array('소그룹', '제주 동부', '첫 방문 추천', '날씨 반영 운영')
      )
    )
  )
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT
  new_tour.id,
  v.name,
  v.address,
  v.lat,
  v.lng,
  v.pickup_time::TIME
FROM new_tour
CROSS JOIN (VALUES
  (
    'Jeju International Airport (example)',
    'Jeju International Airport — domestic terminal area (confirm after booking)',
    33.5113::numeric,
    126.4930::numeric,
    '08:30:00'
  ),
  (
    'Jeju City hotel zone (example)',
    'Downtown Jeju City — exact hotel pickup confirmed after booking',
    33.4996::numeric,
    126.5312::numeric,
    '08:45:00'
  )
) AS v(name, address, lat, lng, pickup_time);

-- Verify
SELECT
  t.id,
  t.title,
  t.slug,
  t.price,
  t.badges,
  t.translations->'ko'->>'title' AS title_ko,
  COUNT(pp.id) AS pickup_rows
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'east-signature-nature-core-jeju'
GROUP BY t.id, t.title, t.slug, t.price, t.badges, t.translations;
