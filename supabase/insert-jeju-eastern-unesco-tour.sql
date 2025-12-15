-- ============================================
-- Insert Jeju: Eastern Jeju UNESCO Spots Day Bus Tour
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
    'Jeju: Eastern Jeju UNESCO Spots Day Bus Tour',
    'jeju-eastern-unesco-spots-bus-tour',
    'Jeju',
    'UNESCO',
    'Top rated',
    'Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island. Learn about the island''s legendary Haenyeo and discover Micheongul Cave. Discover the enchanting beauty of Jeju Island with our all-inclusive Eastern Euphoria One Day Tour. Jeju, the largest island in Korea, is filled with breathtaking landscapes, UNESCO World Heritage Sites, and unique cultural treasures—and we bring them all to you in one seamless journey.',
    80000.00,
    80000.00,
    'person',
    'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80',
    '[
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop"
    ]'::jsonb,
    '10 hours',
    false,
    true,
    '**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport 3rd Floor, Gate 3 (Domestic Departures) at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. You can start your journey immediately with your luggage at the airport. We have selected 4 pick-up locations that are most easily accessible to those traveling to Jeju Island. Please aim to arrive 10 minutes early as it may be crowded. If you do not show up for more than 10 minutes, it will be considered a no-show and you may not receive a refund. You can arrive at the airport early in the morning, start traveling right away with your luggage. Please let us know the amount of luggage in advance.',
    'The order of the itinerary may be adjusted or substituted depending on local conditions such as traffic, site availability, or weather. Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information. Our tour ends at Same Pickup Location and Jeju Dongmun Market. These are places most loved by visitors, and they are not related to any forced shopping activities. Our tour does not include any shopping stops—we focus entirely on providing you with the best sightseeing experience. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide.',
    '[
      "Experience Jeju''s UNESCO World Heritage Sites in one unforgettable day",
      "Enjoy a hassle-free trip with all admission fees included in one booking",
      "Explore the wonders of a lava tube cave system, a rare geological treasure",
      "Join easily from 4 convenient pickup locations across Jeju City",
      "Learn more with insights from our professional English-speaking guide"
    ]'::jsonb,
    '[
      "Admission to all UNESCO sites (all admission fees)",
      "English-speaking professional guide",
      "A vehicle (Van or Bus) & Driver",
      "Toll fees",
      "Parking fees",
      "Fuel fees",
      "No Shopping stops"
    ]'::jsonb,
    '[
      "Lunch (food) Fees",
      "Personal expenses",
      "Tips or additional fees",
      "Personal travel insurance"
    ]'::jsonb,
    '[
      {
        "time": "08:30",
        "title": "Pickup - Ocean Suites Jeju",
        "description": "Pickup from Ocean Suites Jeju Hotel. Please arrive 10 minutes early."
      },
      {
        "time": "08:45",
        "title": "Pickup - Jeju International Airport",
        "description": "Pickup from Jeju Airport 3rd Floor, Gate 3 (Domestic Departures). You can start your journey immediately with your luggage at the airport."
      },
      {
        "time": "08:55",
        "title": "Pickup - Lotte City Hotel Jeju",
        "description": "Pickup from Lotte City Hotel Jeju."
      },
      {
        "time": "09:05",
        "title": "Pickup - Shilla Duty-Free Jeju Store",
        "description": "Pickup from Shilla Duty-Free Jeju Store."
      },
      {
        "time": "09:45",
        "title": "Hamdeok Seoubong Beach",
        "description": "Start your day at one of Jeju''s top three beaches, famous for its dazzling ocean colors. In spring, Seoubong hill is blanketed with rapeseed flowers, offering a panoramic seaside view. Break time, Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        "time": "10:45",
        "title": "Haenyeo Museum",
        "description": "Learn about Jeju''s legendary ''Haenyeo''—female divers who collect seafood from the ocean floor. Their resilience and unique culture are recognized by UNESCO as an Intangible Cultural Heritage. Photo stop, Visit, Guided tour, Sightseeing, Walk, Scenic views on the way, Arts & crafts market visit."
      },
      {
        "time": "12:30",
        "title": "Lunch at Local Restaurant",
        "description": "Lunch is provided at a local restaurant. (Lunch cost not included; BBQ, local cuisine, and other options are available.) We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals."
      },
      {
        "time": "13:30",
        "title": "Seongsan Ilchulbong (Haenyeo Show spot)",
        "description": "A UNESCO World Natural Heritage site, this iconic volcanic tuff cone offers spectacular views and is one of Jeju''s most beloved landmarks. Photo stop, Visit, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        "time": "14:30",
        "title": "Micheongul Cave at Sunrise Land (Ilchul Land)",
        "description": "A fascinating lava tube system, visited instead of Manjanggul (currently closed). Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        "time": "15:30",
        "title": "Seongeup Folk Village",
        "description": "Step back in time as you explore this well-preserved traditional village, where you''ll discover the history and culture of Jeju Island. Photo stop, Visit, Guided tour, Free time, Sightseeing, Class, Scenic views on the way."
      },
      {
        "time": "18:00",
        "title": "Drop-off",
        "description": "4 drop-off locations: Jeju Dongmun Traditional Market, Ocean Suites Jeju Hotel, Jeju Airport (CJU), Shilla Duty-Free Jeju Store. This location is a drop-off point and is not related to shopping in any way. We never force any shopping."
      }
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "Lunch is provided at a local restaurant, but the cost is not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide."
      },
      {
        "question": "What should I bring?",
        "answer": "Comfortable shoes, warm clothing, comfortable clothes, cash, and weather-appropriate clothing."
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
        "question": "What makes this tour special?",
        "answer": "All Admission Fees Included - Transparent pricing, no hidden costs. No Shopping, No Pressure - We never waste your time with souvenir stops or forced shopping. Every moment is dedicated to sightseeing. Professional English-Speaking Guides - Knowledgeable, friendly, and committed to your safe travel. Comfort & Quality - Travel in a clean, air-conditioned vehicle with guaranteed top-rated service."
      }
    ]'::jsonb,
    4.9,
    1006,
    4,
    4,
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
  'Jeju International Airport',
  'Jeju International Airport, 3rd Floor, Gate 3 (Domestic Departures), 2 Gonghang-ro, Jeju-si, Jeju-do',
  33.5113,
  126.4930,
  '08:45:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Lotte city hotel jeju',
  'Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do',
  33.4878,
  126.4886,
  '08:55:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Shilla duty free shop jeju',
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
WHERE t.slug = 'jeju-eastern-unesco-spots-bus-tour'
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
WHERE t.slug = 'jeju-eastern-unesco-spots-bus-tour'
ORDER BY pp.pickup_time;
