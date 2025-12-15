-- ============================================
-- Insert Busan: Top Attractions Authentic One-Day Guided Tour
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
    'Busan: Top Attractions Authentic One-Day Guided Tour',
    'busan-top-attractions-authentic-one-day-tour',
    'Busan',
    'City Tour',
    'Top rated',
    'Explore the key attractions of Busan City with a certified guide, including Gamcheon Culture Village, UN Memorial Cemetery, Haedong Yonggungsa Temple, Cheongsapo, Blue line Park, and Jagalchi Market. If you only have one day in Busan, this is the tour you''ve been waiting for. No complicated choices, no confusing options—unlike other tours, we offer just one carefully designed itinerary. It''s simple, easy, and guaranteed to show you the very best of Busan. From majestic temples by the sea to colorful hillside villages, from skywalks over the ocean to bustling markets, this day tour combines Busan''s most iconic sights with hidden local gems.',
    60750.00,
    67500.00,
    'person',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
    '[
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"
    ]'::jsonb,
    '9.5 hours',
    false,
    true,
    '**Pick up information:** (08:30) Busan Subway Station (Exit 4) Not KTX gate, (08:50) Seomyeon Subway station Exit 4, (9:30) Haeundae Station Exit 5. Please provide accurate contact information so we can reach you for a smooth tour via WhatsApp. Round-trip transfers to and from the meet up location.',
    'Please note: Some attractions may be skipped or adjusted depending on weather, traffic, or capacity. The time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions. End your tour with a special drop-off at Nampo-dong & Jagalchi Market. Official drop-off times and locations: Nampo-dong & Jagalchi Station (17:50), Busan Station (18:00), Seomyeon Station (18:20), Haeundae Station (19:00). The exact ending time can vary daily due to traffic, rush hour conditions, weather, and guest cooperation. Please inform us in advance about any dietary restrictions, allergies, etc.',
    '[
      "Explore Busan''s must-see spots in one simple, all-inclusive day tour",
      "Certified professional guide who speaks English",
      "End your tour with a special drop-off at Nampo-dong & Jagalchi Market",
      "Visit Haedong Yonggungsa, Gamcheon Village, and hidden coastal gems",
      "Exceptional value without compromise"
    ]'::jsonb,
    '[
      "Admission to attractions",
      "English-speaking guide",
      "Professional guide",
      "Round-trip transfers to and from the meet up location",
      "Toll fees",
      "Parking fees",
      "Fuel fees"
    ]'::jsonb,
    '[
      "Meals and beverages",
      "Lunch fees",
      "Other personal expenses",
      "Personal Insurance",
      "Sky Capsule & Beach Train Ticket (on-site purchase, optional)"
    ]'::jsonb,
    '[
      {
        "time": "08:30",
        "title": "Pickup - Busan Subway Station (Exit 4)",
        "description": "First pickup point at Busan Subway Station (Exit 4). Not KTX gate."
      },
      {
        "time": "08:50",
        "title": "Pickup - Seomyeon Subway Station (Exit 4)",
        "description": "Second pickup point at Seomyeon Subway Station (Exit 4)."
      },
      {
        "time": "09:30",
        "title": "Pickup - Haeundae Station (Exit 5)",
        "description": "Third pickup point at Haeundae Station (Exit 5)."
      },
      {
        "time": "10:00-11:20",
        "title": "Haedong Yonggungsa Temple",
        "description": "Start your morning at Busan''s famous seaside temple, a rare and breathtaking place where culture meets the ocean. Visit, Sightseeing (80 minutes)."
      },
      {
        "time": "11:30-12:00",
        "title": "Cheongsapo Daritdol Observatory (Skywalk)",
        "description": "Walk above the waves on a glass-bottom bridge with panoramic coastal views. Visit, Sightseeing (30 minutes)."
      },
      {
        "time": "12:30-13:30",
        "title": "Lunch at Local Restaurant",
        "description": "Recharge with a delicious local meal. Vegetarian, vegan, and special menus are available—just let us know in advance. Lunch (1 hour). Optional, at your own expense."
      },
      {
        "time": "14:00-14:40",
        "title": "Haeundae Blue Line Park - Cheongsapo Station",
        "description": "Free time in Cheongsapo! Ride the Sky Capsule or Beach Train (optional, on-site purchase, guide will assist you). Be aware: during peak season, tickets may sell out quickly. Even without riding the capsule or train, you can still fully enjoy the beautiful scenery, listen to the guide''s explanations, and have a wonderful travel experience. Free time, Sightseeing (40 minutes)."
      },
      {
        "time": "15:00-16:00",
        "title": "United Nations Memorial Cemetery",
        "description": "A moving and respectful visit to honor those who gave their lives during the Korean War. Visit, Sightseeing (1 hour)."
      },
      {
        "time": "16:30-18:00",
        "title": "Gamcheon Culture Village",
        "description": "End the day in Busan''s most colorful neighborhood, famous for its murals, art, and winding alleys. Visit, Sightseeing (1.5 hours)."
      },
      {
        "time": "18:00-18:05",
        "title": "Jagalchi Market",
        "description": "Experience Korea''s largest seafood market. Hop-on Hop-off stop (5 minutes)."
      },
      {
        "time": "17:50-19:00",
        "title": "Drop-off",
        "description": "3 drop-off locations: Nampo-dong & Jagalchi Station (17:50 - first drop-off for those who want to explore like a local), Busan Station (18:00), Seomyeon Station (18:20), Haeundae Station (19:00). The exact ending time can vary daily due to traffic, rush hour conditions, weather, and guest cooperation."
      }
    ]'::jsonb,
    '[
      {
        "question": "Is lunch included?",
        "answer": "No, lunch is not included. Lunch is provided at a local restaurant at your own expense (Optional). Vegetarian, vegan, and special menus are available—just let us know in advance."
      },
      {
        "question": "Are admission fees included?",
        "answer": "Yes, admission to attractions is included. However, Sky Capsule & Beach Train tickets are optional and payable on-site."
      },
      {
        "question": "What should I bring?",
        "answer": "Weather-appropriate clothing is recommended. Comfortable walking shoes are also suggested."
      },
      {
        "question": "Can I cancel my booking?",
        "answer": "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        "question": "How will I be contacted?",
        "answer": "Please provide accurate contact information so we can reach you for a smooth tour via WhatsApp."
      },
      {
        "question": "Can the itinerary change?",
        "answer": "Yes, some attractions may be skipped or adjusted depending on weather, traffic, or capacity. The time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions."
      },
      {
        "question": "What about dietary restrictions?",
        "answer": "Please inform us in advance about any dietary restrictions, allergies, etc. Vegetarian, vegan, and special menus are available at lunch."
      },
      {
        "question": "Where does the tour end?",
        "answer": "The tour ends with special drop-off at Nampo-dong & Jagalchi Market (17:50) for those who want to explore like a local, or at Busan Station (18:00), Seomyeon Station (18:20), or Haeundae Station (19:00). The exact ending time can vary daily due to traffic, rush hour conditions, weather, and guest cooperation."
      }
    ]'::jsonb,
    4.9,
    922,
    3,
    4,
    true,
    true
  )
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  new_tour.id,
  'Busan Subway Station (Exit 4)',
  'Busan Station, Exit 4 (Not KTX gate), Dong-gu, Busan',
  35.1157,
  129.0400,
  '08:30:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Seomyeon Subway Station (Exit 4)',
  'Seomyeon Station, Exit 4, Busanjin-gu, Busan',
  35.1560,
  129.0590,
  '08:50:00'::TIME
FROM new_tour
UNION ALL
SELECT 
  new_tour.id,
  'Haeundae Station (Exit 5)',
  'Haeundae Station, Exit 5, Haeundae-gu, Busan',
  35.1630,
  129.1640,
  '09:30:00'::TIME
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
WHERE t.slug = 'busan-top-attractions-authentic-one-day-tour'
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
WHERE t.slug = 'busan-top-attractions-authentic-one-day-tour'
ORDER BY pp.pickup_time;



