-- ============================================
-- Insert Jeju: Winter East Snow, Camellia, Tangerine Picking Tour
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
    'Jeju: Winter East Snow, Camellia, Tangerine Picking Tour',
    'jeju-winter-east-snow-camellia-tangerine-tour',
    'Jeju',
    'Winter Special',
    'Top rated',
    'Enjoy the best of winter in Jeju East on this tour. Marvel at the snow, admire the camellia blossoms, and pick and taste fresh Tangerines. with hotel pick up & drop (jeju city inside). Experience the most heartwarming side of Jeju this winter! When snowflakes rest gently on stone walls and golden tangerines brighten the fields, the island turns into a dreamy paradise. This one-day join-in tour captures the essence of Jeju''s winter — colorful camellias, sweet citrus orchards, and peaceful volcanic landscapes wrapped in quiet beauty.',
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
    'Hotel pick up & Drop (jeju city inside). Since multiple customers will be using the service, we will contact you via messenger the day before the tour starts. The day before the tour, our guide will provide vehicle information, exact pick-up time (08:00-09:00), tour itinerary, and tips. The exact time and location can be discussed with the guide through WhatsApp. If there is no contact, please contact (82 1045217582). For Jeju City outside (Seogwipo, Aewol, etc.), additional charges apply. (70,000 won). Hotel pickup is available only within Jeju City. If your hotel is located outside Jeju City (such as Aewol or Seogwipo), additional charges may apply (70,000won).',
    'The tour may be adjusted depending on weather conditions. Winter clothing is recommended as temperatures can be low. Pick-up is available at the JEJU airport before the tour begins. At the end of the tour, we can drop you off at the JEJU airport. If the pickup location is unclear, please provide the address directly or set a nearby hotel. Then, you can contact us. We will provide you with the exact pickup time, location, vehicle number, etc., one to two days before the trip. If you have WhatsApp, it will be even faster and more convenient to use. Please provide WhatsApp or private messenger. If you haven''t received any contact, please install WhatsApp or contact us via WhatsApp. WhatsApp: KR(82) 10 4521 7582. For reference only. Itineraries are subject to change.',
    '[
      "Hotel pick up & Drop (jeju city inside)",
      "Admire the red, beautiful-petaled camellia flowers in full bloom",
      "Pick and taste fresh mandarins from the trees of Jeju Island",
      "Visit Seongsan Ilchulbong, a famous UNESCO spot in the east",
      "Watch a haenyeo (female diver) show and explore a lava tube cave"
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
        "description": "Pickup location: Jeju-si. We will contact you via messenger the day before the tour starts. The exact time and location can be discussed with the guide through WhatsApp."
      },
      {
        "time": "Morning",
        "title": "Hueree Nature Life Park - Camellia Paradise",
        "description": "Start your day in a floral wonderland. Hueree Nature Park bursts into red and pink blooms during winter, creating a warm contrast against Jeju''s cool air. Walk through flower tunnels, enjoy gentle breezes, and take photos surrounded by the island''s most beloved winter symbol — the camellia. Sightseeing. Extra fee."
      },
      {
        "time": "Morning",
        "title": "Seongeup Folk Village - Timeless Winter Beauty",
        "description": "Step into Jeju''s living history. The snow-dusted thatched roofs and basalt fences of Seongeup Folk Village capture the island''s humble charm. Meet locals, learn stories of old Jeju, and feel the slow rhythm of village life that has remained unchanged for generations. Sightseeing."
      },
      {
        "time": "12:30",
        "title": "Local Lunch - Warm Taste of Jeju",
        "description": "Take a short break to enjoy a local meal of your choice. Warm soups, grilled fish, and spicy stews will comfort your heart and hands. Lunch (1 hour). Optional, Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "Seongsan Ilchulbong - UNESCO Sunrise Peak",
        "description": "Witness Jeju''s iconic symbol in its most peaceful form. Seongsan Ilchulbong, with its crater rising above calm winter seas, glows beautifully at sunrise. On clear days, you might also see the Haenyeo show — Jeju''s brave women divers. (The show may be canceled due to rest days or weather.) Sightseeing. Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "Tangerine Picking - A Sweet Winter Memory",
        "description": "Jeju''s winter wouldn''t be complete without tangerines! Visit a local orchard, pick ripe fruits straight from the tree, and taste their sunlit sweetness. This fun, hands-on activity lets you feel the joy of Jeju''s countryside life — loved by travelers of all ages. Hidden gem. Class, Food tasting. Extra fee."
      },
      {
        "time": "Afternoon",
        "title": "Ilchul Land - Camellias & Caves",
        "description": "End your journey at Ilchul Land, where nature and art meet. Explore Micheon Lava Cave and stroll through gardens glowing with red camellias. The vivid petals against dark rock create the perfect winter contrast — a scene you''ll never forget. Sightseeing. Extra fee."
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
        "answer": "No, entry fees (admission fees) are not included in the tour price. Additional charges apply for Hueree Nature Life Park, Seongsan Ilchulbong, Hidden gem tangerine picking, and Ilchul Land."
      },
      {
        "question": "Is lunch included?",
        "answer": "No, lunch is not included. Lunch will be at a local restaurant at your own expense (Optional, Extra fee). Warm soups, grilled fish, and spicy stews are available."
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
        "answer": "Winter clothing is recommended as temperatures can be low. Please dress warmly and wear comfortable shoes."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "What if the weather is bad?",
        "answer": "The tour may be adjusted depending on weather conditions. The Haenyeo show may be canceled due to rest days or weather."
      }
    ]'::jsonb,
    5.0,
    1,
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
WHERE t.slug = 'jeju-winter-east-snow-camellia-tangerine-tour'
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
WHERE t.slug = 'jeju-winter-east-snow-camellia-tangerine-tour'
ORDER BY pp.pickup_time;










