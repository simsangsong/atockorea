-- ============================================
-- Insert Jeju: West & South Full-Day Authentic Bus Tour
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
    'Jeju: West & South Full-Day Authentic Bus Tour',
    'jeju-west-south-full-day-bus-tour',
    'Jeju',
    'Full Day',
    'Top rated',
    'Explore Jeju''s west and south in one day with a licensed guide. Enjoy scenic trails, green tea views, local activities, and coastal waterfalls while experiencing Jeju''s nature and culture. Discover the natural wonders, cultural treasures, and modern charms of Jeju Island on this Western Highlights Day Tour. From breathtaking UNESCO World Heritage sites to trendy seaside cafes, this full-day journey offers the perfect mix of nature, culture, and relaxation.',
    70000.00,
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
    '**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport 3rd Floor, Gate 3 (Domestic Departures) at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. You can start your journey immediately with your luggage at the airport. We have selected 4 pick-up locations that are most easily accessible to those traveling to Jeju Island. Please aim to arrive 10 minutes early as it may be crowded. If you do not show up for more than 10 minutes, it will be considered a no-show and you may not receive a refund. You can arrive at the airport early in the morning, start traveling right away with your luggage. Please let us know the amount of luggage in advance. Please refer to the full description for the detailed itinerary!',
    'This location is a drop-off point and is not related to shopping in any way. We never force any shopping. Tour ending time may vary based on traffic or weather. If dropped off at Dongmun Market, it''s a 5-minute walk to Black Pork Street. Whistle Lark and Regent Marine hotels are about a 10-minute walk away. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide. Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information.',
    '[
      "Travel the south & west in just one day with a certified guide",
      "Convenient 4 pickup locations & 5 drop-off locations (No Shopping)",
      "Experience Jeju''s stunning nature and culture in one unforgettable day",
      "Enjoy a hassle-free trip with all admission fees included in one booking",
      "Combining it with the eastern tour is the best choice"
    ]'::jsonb,
    '[
      "All entry tickets (admission fees)",
      "UNESCO guided tour licensed",
      "English speaking guide",
      "Toll fee",
      "Parking fee",
      "Fuel fee",
      "A comfortable vehicle with air conditioning",
      "No Shopping stops"
    ]'::jsonb,
    '[
      "Lunch (Fees)",
      "Personal expenses",
      "Personal travel insurance",
      "Black Pig Feeding Experience (Optional, KRW 2,000 on-site)",
      "Tangerine Picking Experience (Pay on-site)"
    ]'::jsonb,
    '[
      {
        "time": "08:30",
        "title": "Pickup - Ocean Suites Jeju",
        "description": "First pickup point. Please arrive 10 minutes early."
      },
      {
        "time": "08:45",
        "title": "Pickup - Jeju Airport 3rd Floor, Gate 3",
        "description": "Second pickup point. You can start your journey immediately with your luggage at the airport."
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
        "time": "09:30-11:00",
        "title": "Mt. Halla - Eoseungsaengak Trail",
        "description": "Enjoy an easy trail offering beautiful views of Hallasan and Jeju''s volcanic landscape. Weather-dependent: may change to the 1100 Altitude Wetland or Saebyeol Oreum. Guided tour, Sightseeing."
      },
      {
        "time": "11:30-12:30",
        "title": "O''sulloc Tea Museum & Green Tea Fields",
        "description": "Explore Jeju''s most famous tea museum, stroll through wide green tea fields, and enjoy green tea desserts. Free time, Sightseeing."
      },
      {
        "time": "13:00-14:00",
        "title": "Lunch at Local Restaurant",
        "description": "Enjoy authentic Korean dishes with various menu options. Please inform your guide of any dietary restrictions. Lunch (1 hour). Optional. BBQ, local cuisine, and other options available. We accommodate all dietary needs."
      },
      {
        "time": "14:30-15:30",
        "title": "Jusangjeollidae (Jusangjeolli Cliff)",
        "description": "Dramatic volcanic rock pillars, shaped into geometric patterns, formed centuries ago when lava flows met the ocean. Guided tour, Sightseeing."
      },
      {
        "time": "16:00-17:00",
        "title": "Hueree Nature Life Park",
        "description": "A peaceful nature park famous for seasonal flowers and countryside charm. Optional: Jeju Black Pig Feeding Experience available on-site (KRW 2,000). Guided tour, Sightseeing."
      },
      {
        "time": "17:00-17:30",
        "title": "Tangerine Picking Experience",
        "description": "Visit a nearby orchard to pick fresh Jeju tangerines by hand. Pay on-site."
      },
      {
        "time": "17:30-18:00",
        "title": "Jeongbang Waterfall",
        "description": "A rare coastal waterfall dropping directly into the sea. If closed due to weather, this stop will be replaced with Cheonjiyeon Waterfall. Free time, Sightseeing."
      },
      {
        "time": "18:00+",
        "title": "Drop-off at 5 locations",
        "description": "Shilla Duty Free Jeju, LOTTE City Hotel Jeju, Jeju Airport (CJU), Ocean Suites Jeju Hotel, Jeju Dongmun Traditional Market (Self-Guided, Only drop). This location is a drop-off point and is not related to shopping in any way. We never force any shopping."
      }
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "Lunch is provided at a local restaurant, but the cost is not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide."
      },
      {
        "question": "Are admission fees included?",
        "answer": "Yes, all entry tickets (admission fees) are included in the tour price."
      },
      {
        "question": "What about optional activities?",
        "answer": "Black Pig Feeding Experience at Hueree Nature Life Park is optional and costs KRW 2,000 on-site. Tangerine Picking Experience is also available and payment is made on-site."
      },
      {
        "question": "What should I bring?",
        "answer": "Comfortable walking shoes, weather-appropriate clothing, and cash for optional activities and lunch."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "When will I receive tour information?",
        "answer": "Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information."
      },
      {
        "question": "What if the weather is bad?",
        "answer": "Timings and locations may vary depending on traffic and weather conditions. Mt. Halla trail may change to 1100 Altitude Wetland or Saebyeol Oreum. If Jeongbang Waterfall is closed due to weather, it will be replaced with Cheonjiyeon Waterfall."
      }
    ]'::jsonb,
    4.9,
    323,
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
  'Jeju Airport 3rd Floor, Gate 3',
  'Jeju International Airport, 2 Gonghang-ro, Jeju-si, Jeju-do',
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
  t.original_price,
  t.rating,
  t.review_count,
  COUNT(pp.id) as pickup_points_count
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'jeju-west-south-full-day-bus-tour'
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
WHERE t.slug = 'jeju-west-south-full-day-bus-tour'
ORDER BY pp.pickup_time;










