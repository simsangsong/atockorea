-- ============================================
-- Insert Jeju: Southern UNESCO Geopark Day Tour
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
    'Jeju: Southern UNESCO Geopark Day Tour',
    'jeju-southern-unesco-geopark-day-tour',
    'Jeju',
    'UNESCO',
    'Top rated',
    'Enjoy a comfortable bus tour of the UNESCO area of Jeju Island. Visit Hallasan Mountain, the O''sulloc Tea Museum, the Jusangjeolli Cliff, and the Cheonjiyeon Waterfall. Discover UNESCO Jeju South - One Perfect Day of Beauty and Wonder. Experience Jeju''s UNESCO Treasures in Comfort: an all-inclusive one-day tour through the UNESCO-designated southern region of Jeju Island. This journey combines breathtaking scenery, cultural heritage, and natural wonders with ease, comfort, and convenience. Licensed guides, air-conditioned vehicles, and admission fees included.',
    80000.00,
    80000.00,
    'person',
    'https://images.unsplash.com/photo-1604999333679-b86d54738315?w=1200&q=80',
    '[
      "https://images.unsplash.com/photo-1604999333679-b86d54738315?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
    ]'::jsonb,
    '10 hours',
    false,
    true,
    '**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport Gate 1st Floor at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. A guide or vehicle holding a LOVE KOREA sign will be waiting for you at the designated location. Please arrive at least 10 minutes early. Thank you! Once your reservation is confirmed, we will contact you one day before the tour with detailed information about pick-up, vehicle, and guide via Whatsapp. If you have WhatsApp, we can conveniently create a group chat there. If you haven''t received any contact, please install WhatsApp or contact us via WhatsApp.',
    'Relax. Explore. Fall in Love with Jeju. Discover the heart of Jeju''s UNESCO heritage with us — a perfect blend of culture, nature, and comfort. Book now and experience why travelers around the world fall in love with the southern beauty of Jeju Island. We recommend that you bring personal travel insurance. Outdoor activities involve various risks and dangers. Tour ending time may vary based on traffic or weather.',
    '[
      "Discover Jeju''s UNESCO wonders — World Heritage, Biosphere Reserve, Geopark",
      "Hike Hallasan''s Eoseungsangak Trail and feel Jeju''s calm volcanic beauty",
      "Relax at O''sulloc Tea Museum with vast green tea fields and gentle scenery",
      "Marvel at Jusangjeolli Cliff''s hexagonal lava pillars and dramatic coast",
      "End at Cheonjiyeon Falls, where sky and land meet in peaceful harmony"
    ]'::jsonb,
    '[
      "Admission fees: all",
      "Parking Fees",
      "Air-conditioned vehicle",
      "Licensed guides",
      "Convenient pickup and drop-off"
    ]'::jsonb,
    '[
      "Lunch (Meal)",
      "Personal Expenses",
      "Personal travel insurance"
    ]'::jsonb,
    '[
      {
        "time": "08:30",
        "title": "Pickup - Ocean Suites Jeju",
        "description": "First pickup point. A guide or vehicle holding a LOVE KOREA sign will be waiting for you. Please arrive at least 10 minutes early."
      },
      {
        "time": "08:45",
        "title": "Pickup - Jeju Airport Gate 1st Floor",
        "description": "Second pickup point at Jeju Airport Gate 1st Floor."
      },
      {
        "time": "08:55",
        "title": "Pickup - Lotte City Hotel Jeju",
        "description": "Third pickup point."
      },
      {
        "time": "09:05",
        "title": "Pickup - Shilla Duty-Free Jeju Store",
        "description": "Fourth pickup point."
      },
      {
        "time": "09:30-10:30",
        "title": "Eoseungsaengak Trail - Hike Hallasan",
        "description": "Start your day with a peaceful hike on the Eoseungsaengak Trail, one of Hallasan Mountain''s most scenic and beginner-friendly routes. Duration: about 40 minutes to 1.2 hours. Experience the fresh air and beauty of Jeju''s volcanic nature. Hallasan is a UNESCO World Heritage Site. Guided tour, Sightseeing, Walk."
      },
      {
        "time": "11:00-11:30",
        "title": "Camellia Hill Botanical Garden - Jeju''s Garden of Blossoms",
        "description": "Home to over 6,000 camellia trees from around the world. Blooms in red, pink, and white from November to April. Symbolizes love and warmth in winter. A peaceful garden with scenic paths, a must-visit for nature and photo lovers. Sightseeing."
      },
      {
        "time": "12:30-13:30",
        "title": "Lunch at Local Restaurant",
        "description": "Enjoy authentic Korean dishes at a local restaurant. Optional, Extra fee. Lunch (1 hour)."
      },
      {
        "time": "14:00-14:30",
        "title": "Cheonjeyeon Falls - The Pond of the Gods",
        "description": "Known as \"The Pond of the Gods,\" this waterfall features three graceful tiers surrounded by lush forest and unique rock formations. The clear water from Hallasan creates a calm, sacred atmosphere. Seonimgyo Bridge with its seven nymph carvings adds mythical charm. Sightseeing."
      },
      {
        "time": "15:00-15:30",
        "title": "Jusangjeolli Cliff - Nature''s Volcanic Masterpiece",
        "description": "Dramatic Jusangjeolli Hexagonal Cliffs formed by cooling lava. Features towering 30-40 meter columns, struck by waves soaring over 20 meters high. Creates one of Korea''s most spectacular coastal views. Recognized as Natural Monument No. 443 and a must-see highlight of Jeju''s UNESCO Geopark. Photo stop, Guided tour."
      },
      {
        "time": "16:00-17:00",
        "title": "O''sulloc Tea Museum - Taste Jeju''s Green Serenity",
        "description": "O''sulloc Tea Museum and Innisfree House. Vast green tea fields stretch across the horizon. Taste freshly brewed green tea, explore the museum''s exhibits, and discover the art of Jeju''s tea culture. A perfect place to rest, sip, and take beautiful photos. Visit, Guided tour, Sightseeing."
      },
      {
        "time": "17:30",
        "title": "Shilla Duty Free Jeju Store (Optional)",
        "description": "Hop-on Hop-off stop. Optional stop for shopping. (2 minutes)"
      },
      {
        "time": "18:00+",
        "title": "Drop-off at 5 locations",
        "description": "1. Shilla Duty Free Jeju, 2. LOTTE City Hotel Jeju, 3. Jeju Airport (CJU), 4. Ocean Suites Jeju Hotel, 5. Jeju Dongmun Traditional Market (Self-Guided, Jeju''s most popular and vibrant market, loved by travelers!)"
      }
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "No, lunch is not included. Lunch will be at a local restaurant at your own expense (Optional, Extra fee)."
      },
      {
        "question": "Are admission fees included?",
        "answer": "Yes, all admission fees are included in the tour price."
      },
      {
        "question": "What should I bring?",
        "answer": "Comfortable shoes are recommended. We also recommend that you bring personal travel insurance as outdoor activities involve various risks and dangers."
      },
      {
        "question": "Is the tour suitable for wheelchair users?",
        "answer": "No, this tour is not suitable for wheelchair users or people with low level of fitness."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "When will I receive tour information?",
        "answer": "Once your reservation is confirmed, we will contact you one day before the tour with detailed information about pick-up, vehicle, and guide via WhatsApp. If you have WhatsApp, we can conveniently create a group chat there."
      },
      {
        "question": "What is included in the tour?",
        "answer": "Admission fees (all), parking fees, air-conditioned vehicle, and licensed guides are included. Lunch, personal expenses, and personal travel insurance are not included."
      }
    ]'::jsonb,
    5.0,
    62,
    4,
    5,
    true,
    true
  )
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  new_tour.id,
  'Ocean Suites Jeju',
  'Ocean Suites Jeju, 263, Yeon-dong, Jeju-si, Jeju-do',
  33.4996,
  126.5312,
  '08:30:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Jeju Airport Gate 1st Floor',
  'Jeju International Airport, Gate 1st Floor, 2 Gonghang-ro, Jeju-si, Jeju-do',
  33.5113,
  126.4930,
  '08:45:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Lotte City Hotel Jeju',
  'Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do',
  33.4878,
  126.4886,
  '08:55:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Shilla Duty-Free Jeju Store',
  'Shilla Duty-Free Jeju Store, Jeju-si, Jeju-do',
  33.4996,
  126.5312,
  '09:05:00'::TIME
FROM new_tour;

-- Verify the tour was created
SELECT 
  t.id,
  t.title,
  t.slug,
  t.price,
  t.rating,
  t.review_count,
  COUNT(pp.id) as pickup_points_count
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'jeju-southern-unesco-geopark-day-tour'
GROUP BY t.id, t.title, t.slug, t.price, t.rating, t.review_count;

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
WHERE t.slug = 'jeju-southern-unesco-geopark-day-tour'
ORDER BY pp.pickup_time;

