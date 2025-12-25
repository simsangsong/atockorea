-- ============================================
-- Insert Jeju: Winter SouthWest Tangerine Pick, Snow, Camellia, Tour
-- ============================================
-- This script creates a tour based on the provided images
-- Run this in Supabase SQL Editor

WITH new_tour AS (
  INSERT INTO tours (
    title,
    slug,
    city,
    tag,
    subtitle,
    description,
    price,
    original_price,
    price_type,
    image_url,
    gallery_images,
    duration,
    lunch_included,
    ticket_included,
    pickup_info,
    notes,
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
    is_featured
  ) VALUES (
    'Jeju: Winter SouthWest Tangerine Pick, Snow, Camellia, Tour',
    'jeju-winter-southwest-tangerine-snow-camellia-tour',
    'Jeju',
    'Winter Special',
    'Top rated',
    'Enjoy the best of winter in Jeju South West on this tour. Marvel at the snow, admire the camellia blossoms, and pick and taste fresh mandarins. with hotel pick up & drop (jeju city inside). Discover the calm beauty of Jeju''s winter on this one-day join-in tour. Walk through snow-covered mountain trails, admire frozen waterfalls, and enjoy the brilliant red camellias that bloom under the winter sky. From Hallasan''s white peaks to golden tangerine orchards, experience the warmth of Jeju even in the coldest season.',
    105200.00,
    131500.00,
    'person',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
    '[
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"
    ]'::jsonb,
    '9 hours',
    false,
    false,
    'Hotel pick up & Drop (jeju city inside). Since multiple customers will be using the service, we will contact you via messenger the day before the tour starts. The day before the tour, our guide will provide vehicle information, exact pick-up time (08:00-09:00), tour itinerary, and tips. The exact time and location can be discussed with the guide through WhatsApp. If there is no contact, please contact (82 1045217582). For Jeju City outside (Seogwipo, Aewol, etc.), additional charges apply. (70,000 won). Hotel pickup is available only within Jeju City. Pick-up is available at the JEJU airport before the tour begins. At the end of the tour, we can drop you off at the JEJU airport. If the pickup location is unclear, please provide the address directly or set a nearby hotel.',
    'The tour may be adjusted depending on weather conditions. Winter clothing is recommended as temperatures can be low. We will provide you with the exact pickup time, location, vehicle number, etc., one to two days before the trip. If you have WhatsApp, it will be even faster and more convenient to use. Please provide WhatsApp or private messenger. If you haven''t received any contact, please install WhatsApp or contact us via WhatsApp. WhatsApp: KR(82) 10 4521 7582. For reference only. Itineraries are subject to change.',
    '[
      "Hotel pick up & Drop (Jeju city inside)",
      "Admire the red, beautiful-petaled camellia flowers in full bloom",
      "Pick and taste fresh mandarins from the trees of Jeju Island",
      "Visit Hallasan Mountain, a famous UNESCO spot in the SouthWest",
      "Watch a Waterfall and explore green tea fields and a tea museum"
    ]'::jsonb,
    '[
      "Hotel pickup and drop-off in Jeju city",
      "Professional Licensed Driver/guide",
      "Jeju''s only winter tour",
      "Combined with UNESCO attractions",
      "Convenient pickup",
      "Clean & air-conditioned vehicle"
    ]'::jsonb,
    '[
      "Entry fees (admission fee)",
      "Food and drinks (Lunch fee)",
      "Personal travel insurance",
      "Jeju City Outside (Seogwipo, Aewol, etc.) Hotel pickup (additional charge of 70,000 won)"
    ]'::jsonb,
    '[
      {
        "time": "08:00-09:00",
        "title": "Hotel pick-up (Jeju City / Airport area)",
        "description": "Pickup location: Jeju-si. We will contact you via messenger the day before the tour starts. The exact time and location can be discussed with the guide through WhatsApp. Pick-up is available at the JEJU airport before the tour begins."
      },
      {
        "time": "Morning",
        "title": "Hallasan Mountain - Eoseungsaengak Trail",
        "description": "Begin your morning with a gentle hike along the Eoseungsaengak Trail on Hallasan. In winter, this path turns into a quiet wonderland blanketed in snow. Breathe in crisp mountain air and admire wide views of Jeju''s volcanic landscape glistening under sunlight. The short trail is easy to walk but unforgettable in its peaceful beauty. Sightseeing, Walk, Hiking."
      },
      {
        "time": "Morning",
        "title": "Cheonjeyeon Waterfall - Winter Mist & Magic",
        "description": "At Cheonjeyeon Waterfall, gentle snow meets flowing water. The three-tiered falls shimmer beneath icy mist and evergreen trees. This is one of Jeju''s most romantic spots in winter — a place where you can truly feel nature''s silence and strength at once. Sightseeing. Extra fee."
      },
      {
        "time": "12:30",
        "title": "Local Lunch - Warm and Cozy",
        "description": "Recharge with a local lunch at your own expense. Enjoy comforting dishes like seafood stew or grilled fish to warm your hands and heart before the afternoon adventures. Lunch (1 hour). Optional, Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "Camellia Hill Botanical Garden - The Heart of Winter Beauty",
        "description": "Camellia Hill is a dreamlike garden where thousands of red blossoms brighten Jeju''s winter. Snowflakes resting on camellia petals create a magical contrast of white and red. Stroll through flower paths, breathe in the soft fragrance, and capture unforgettable photos of Jeju''s most iconic winter scene. Sightseeing. Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "Tangerine Picking - Taste the Sunshine",
        "description": "Winter in Jeju means tangerines! Visit a local orchard, pick ripe fruits directly from the trees, and taste their sweet, refreshing flavor. It''s a joyful moment that connects you to Jeju''s countryside charm — simple, fun, and delicious. Hidden gem. Class. Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "O''sulloc Tea Museum - Tranquil Green Fields",
        "description": "Finish your day surrounded by the calm green of Jeju''s famous tea fields. Light snow covers the rows of tea plants, creating a picture of harmony between nature and culture. Relax with a warm cup of green tea or a sweet dessert while learning about Jeju''s tea-making tradition. Free time, Sightseeing."
      },
      {
        "time": "18:00",
        "title": "Return to hotel",
        "description": "Arrive back at: Jeju-si. Drop-off at your hotel or Jeju Airport."
      }
    ]'::jsonb,
    '[
      {
        "question": "Are admission fees included?",
        "answer": "No, entry fees (admission fees) are not included in the tour price. Additional charges apply for Hallasan Mountain, Cheonjeyeon Waterfall, Camellia Hill Botanical Garden, Tangerine Picking, and O''sulloc Tea Museum."
      },
      {
        "question": "Is lunch included?",
        "answer": "No, lunch is not included. Lunch will be at a local restaurant at your own expense (Optional, Extra fee). Enjoy comforting dishes like seafood stew or grilled fish."
      },
      {
        "question": "What is the pickup location?",
        "answer": "Hotel pickup and drop-off is available in Jeju City only. If your hotel is located outside Jeju City (such as Aewol or Seogwipo), additional charges of 70,000 won apply. Pick-up is also available at the Jeju Airport before the tour begins."
      },
      {
        "question": "When will I receive pickup information?",
        "answer": "We will contact you via messenger the day before the tour starts. Our guide will provide vehicle information, exact pick-up time (08:00-09:00), tour itinerary, and tips. Please provide WhatsApp or private messenger for faster communication."
      },
      {
        "question": "What should I wear?",
        "answer": "Winter clothing is recommended as temperatures can be low. Please dress warmly and wear comfortable shoes for hiking."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "What if the weather is bad?",
        "answer": "The tour may be adjusted depending on weather conditions. Some activities may be modified or substituted based on weather and safety conditions."
      },
      {
        "question": "Why join this tour?",
        "answer": "Perfect blend of snow, flowers, and sunshine in one day. No shopping stops — just pure Jeju nature. Friendly English/Chinese-speaking guide. Easy, comfortable transportation. Let Jeju''s winter charm surround you — snowy trails, blooming camellias, and the sweet scent of tangerines."
      }
    ]'::jsonb,
    4.9,
    150,
    1,
    1,
    true,
    true
  )
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  new_tour.id,
  'Jeju City Hotels',
  'Jeju City, Jeju-do (Hotels within Jeju City)',
  33.4996,
  126.5312,
  '08:30:00'::TIME
FROM new_tour;

-- Verify the tour was created
SELECT 
  t.id,
  t.title,
  t.slug,
  t.price,
  t.original_price,
  t.rating,
  t.review_count,
  COUNT(pp.id) as pickup_points_count
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'jeju-winter-southwest-tangerine-snow-camellia-tour'
GROUP BY t.id, t.title, t.slug, t.price, t.original_price, t.rating, t.review_count;

-- Show pickup points
SELECT 
  pp.id,
  pp.name,
  pp.address,
  pp.lat,
  pp.lng,
  pp.pickup_time,
  t.title as tour_title
FROM pickup_points pp
JOIN tours t ON t.id = pp.tour_id
WHERE t.slug = 'jeju-winter-southwest-tangerine-snow-camellia-tour'
ORDER BY pp.pickup_time;








