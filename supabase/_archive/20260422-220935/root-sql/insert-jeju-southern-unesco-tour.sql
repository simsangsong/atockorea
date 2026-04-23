-- ============================================
-- Insert Jeju: Southern Top UNESCO Spots Bus Tour
-- ============================================
-- This script creates a tour matching the reference image
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
    'Jeju: Southern Top UNESCO Spots Bus Tour',
    'jeju-southern-top-unesco-spots-bus-tour',
    'Jeju',
    'UNESCO',
    'Top rated',
    'Explore the UNESCO sites in the southern part of Jeju on this guided tour. Starting with Mt. Hallasan, experience the Jusangjeolli cliff, waterfalls, green tea fields, and even a local market.',
    70000.00,
    80000.00,
    'person',
    'https://images.unsplash.com/photo-1604999333679-b86d54738315?w=800&h=600&fit=crop',
    '[
      "https://images.unsplash.com/photo-1604999333679-b86d54738315?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"
    ]'::jsonb,
    '10 hours',
    false,
    true,
    'Pickup 4point: -**Pick up information:*** 1.Ocean Suites Jeju 08:30 * 2.Jeju Airport 3gate 3rd Floor at 8:45 * 3.Lotte city Hotel jeju 08:55 * 4.Shilla Duty-Free Jeju Store at 09;05 We have selected four pick-up locations that are most easily accessible to those traveling to Jeju Island. You can enjoy the tour comfortably because there are various pick-up points, and the price is reasonable. Please aim to arrive 10 minutes early as it may be crowded. If you do not show up for more than 10 minutes, it will be considered a no-show and you may not receive a refund. You can arrive at the airport early in the morning, start traveling right away with your luggage. Please let us know the amount of luggage in advance.',
    'This location is a drop-off point and is not related to shopping in any way. We never force any shopping. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide.',
    '[
      "See panoramic views while hiking on an exciting trail along Mount Hallasan",
      "4 Pickup and 5 drop-off system (Just drop point, No Shopping)",
      "Gaze at natural volcanic rock formations created by lava at Jusangjeolli Cliff",
      "Walk past beautiful plants on a trail leading to the Cheonjeyeon Waterfall",
      "Visit Camellia Hill Jeju''s garden with blooms and a brief tangerine experience"
    ]'::jsonb,
    '[
      "All entry tickets (admission fees)",
      "UNESCO bus tour",
      "English and Chinese-speaking guide",
      "Toll fee",
      "Parking fee",
      "Fuel fee"
    ]'::jsonb,
    '[
      "Food (Lunch Fees)",
      "Personal Expenses",
      "Personal travel insurance"
    ]'::jsonb,
    '[
      {
        "time": "08:30",
        "title": "Pickup - Ocean Suites Jeju",
        "description": "First pickup point"
      },
      {
        "time": "08:45",
        "title": "Pickup - Jeju Airport 3rd Floor, Gate 3",
        "description": "Second pickup point"
      },
      {
        "time": "08:55",
        "title": "Pickup - Lotte City Hotel Jeju",
        "description": "Third pickup point"
      },
      {
        "time": "09:05",
        "title": "Pickup - Shilla Duty-Free Jeju Store",
        "description": "Fourth pickup point"
      },
      {
        "time": "09:30-11:00",
        "title": "Mount Hallasan - Eoseungsangak Trail",
        "description": "South Korea''s highest mountain, a shield volcano rising 6,388 ft (1,947 m). Short trek along the Eoseungsangak Trail, climbing wooden stairs amidst fresh greenery, offering panoramic views of this UNESCO Natural Heritage Site."
      },
      {
        "time": "11:30-12:30",
        "title": "Camellia Hill - Jeju''s Blossoming Paradise",
        "description": "Home to over 6,000 camellia trees, this garden blooms from winter to spring. Optional tangerine-picking experience available."
      },
      {
        "time": "13:00-14:00",
        "title": "Lunch at Local Restaurant",
        "description": "Optional, Extra fee. BBQ, local cuisine, and other options available. We accommodate all dietary needs."
      },
      {
        "time": "14:30-15:30",
        "title": "Cheonjeyeon Waterfall - The Pond of the Gods",
        "description": "Known as \"The Pond of the Gods,\" this waterfall features three graceful tiers surrounded by lush forest and unique rock formations. The clear water from Hallasan creates a calm, sacred atmosphere."
      },
      {
        "time": "16:00-17:00",
        "title": "Jusangjeolli Cliff",
        "description": "Dramatic volcanic rock pillars, shaped into geometric patterns, formed centuries ago when lava flows met the ocean."
      },
      {
        "time": "17:30-18:00",
        "title": "O''sulloc Tea Museum & Green Tea Fields",
        "description": "Learn about the art of tea-making, stroll through extensive green tea fields, and taste Jeju''s renowned green tea desserts."
      },
      {
        "time": "18:00+",
        "title": "Drop-off at 5 locations",
        "description": "Shilla Duty Free Jeju, LOTTE City Hotel Jeju, Jeju Airport (CJU), Ocean Suites Jeju Hotel, Jeju Dongmun Traditional Market (Self-Guided, Only drop)"
      }
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "Lunch is provided at a local restaurant, but the cost is not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals."
      },
      {
        "question": "What should I bring?",
        "answer": "Comfortable shoes, warm clothing, sunscreen, comfortable clothes, cash, and weather-appropriate clothing."
      },
      {
        "question": "Is the tour suitable for wheelchair users?",
        "answer": "No, this tour is not suitable for wheelchair users."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "When will I receive tour information?",
        "answer": "Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information."
      }
    ]'::jsonb,
    4.9,
    637,
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
  33.4996,
  126.5312,
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
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
GROUP BY t.id, t.title, t.slug, t.price, t.rating, t.review_count;
