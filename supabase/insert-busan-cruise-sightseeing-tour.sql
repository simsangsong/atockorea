-- ============================================
-- Insert Busan: Sightseeing Tour for Cruise Passengers
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
    'Busan: Sightseeing Tour for Cruise Passengers',
    'busan-sightseeing-tour-cruise-passengers',
    'Busan',
    'Cruise',
    'Top rated',
    'Explore Busan on a tour designed exclusively for cruise passengers. Discover the city''s top attractions with a certified local guide and enjoy the flexibility of a Busan city tour. Please read this message carefully. This tour is designed exclusively for cruise layover passengers arriving in Busan. We can arrange pickup and drop-off at any time based on your cruise ship schedule. No matter what time your ship arrives or departs, we will adjust accordingly. We always schedule the tour according to the cruise ship''s arrival and departure times. No exceptions! Pickup is always at the cruise ship''s arrival time, and drop-off is always before the ship departs.',
    82560.00,
    96000.00,
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
    true,
    'Pickup is always at the cruise ship''s arrival time, and drop-off is always before the ship departs. The guide will be waiting at Busan Port 1 hour before the cruise arrival time, holding a "Love Korea" sign inside the terminal. If you cannot find the guide, wait inside the terminal and look for the "Love Korea" team. If you still cannot find the guide, connect to Wi-Fi and contact via WhatsApp. It is recommended to create a group chat with the guide the day before the tour. Pickup and drop-off times are adjusted to the cruise ship''s arrival and departure times, typically from 7:00 AM to 10:00 PM. Early pickup (6:00 AM) is possible but may incur an additional guide fee (KRW 10,000 per person).',
    'This tour is tailored to the cruise schedule, so the duration may vary, which means time spent at each attraction might be shorter or longer. Also, if a tourist site is located far away and the return time to the cruise becomes tight, that stop may be skipped. The guide will make accurate adjustments on-site as needed. Even if you cannot select an option for the cruise arrival time, we will communicate with you via messenger and adjust the tour schedule to match your cruise ship''s timing. Lunch is provided at a local restaurant. Please inform us of any dietary restrictions in advance. For quick response, please contact via WhatsApp: +82 10 4521 7582. Tourist sites and tour duration may be extended or shortened at the guide''s discretion based on local conditions such as traffic and weather.',
    '[
      "Enjoy a Busan city tour designed exclusively for cruise passengers",
      "Discover Busan''s top attractions with a certified local guide",
      "Explore the city''s history, culture, and local markets",
      "Visit the city''s top attractions and enjoy the flexibility",
      "Benefit from a tour schedule that is precisely aligned with the cruise itinerary"
    ]'::jsonb,
    '[
      "Busan Cruise Port pickup and drop-off",
      "Entrance fees to attractions",
      "Experienced, certified guide",
      "No Shopping stops"
    ]'::jsonb,
    '[
      "Lunch (Meal) and Personal expenses",
      "Personal travel insurance",
      "Busan Tower entrance fee (Pay on-site, Optional)",
      "Songdo Sky Cable Car entrance fee (Pay on-site, Optional)"
    ]'::jsonb,
    '[
      {
        "time": "Variable",
        "title": "Pickup - Busan International Passenger Terminal",
        "description": "Pickup at 부산항국제여객터미널 크루즈탑승장 (Busan International Passenger Terminal Cruise Boarding Gate). The guide will be waiting 1 hour before cruise arrival time, holding a \"Love Korea\" sign inside the terminal. Pickup time adjusts to cruise ship arrival time."
      },
      {
        "time": "Variable",
        "title": "Yonggungsa Temple",
        "description": "Visit the beautiful seaside temple, one of Busan''s most famous Buddhist temples with stunning ocean views. Guided tour, Sightseeing (1 hour)."
      },
      {
        "time": "Variable",
        "title": "United Nations Memorial Cemetery",
        "description": "Pay respects at this solemn memorial cemetery dedicated to UN soldiers who died during the Korean War. Guided tour, Sightseeing (1 hour)."
      },
      {
        "time": "Variable",
        "title": "Songdo Beach",
        "description": "Enjoy the beautiful coastal scenery at Busan''s first public beach. Optional: Songdo Sky Cable Car (pay on-site). Guided tour, Sightseeing (1.5 hours)."
      },
      {
        "time": "Variable",
        "title": "Lunch at Local Restaurant",
        "description": "Enjoy authentic Korean dishes at a local restaurant. Please inform us of any dietary restrictions in advance. Lunch (1 hour). Optional, Extra fee."
      },
      {
        "time": "Variable",
        "title": "Gamcheon Culture Village",
        "description": "Explore the colorful hillside village known as the \"Machu Picchu of Busan\" with its vibrant painted houses and art installations. Guided tour, Sightseeing (1.5 hours)."
      },
      {
        "time": "Variable",
        "title": "Yongdusan Park",
        "description": "Visit this park located in the heart of Busan, offering panoramic city views. Guided tour, Sightseeing."
      },
      {
        "time": "Variable",
        "title": "Nampo-dong",
        "description": "Explore Busan''s bustling shopping and cultural district, known for its shopping streets and traditional markets. Guided tour, Sightseeing."
      },
      {
        "time": "Variable",
        "title": "Jagalchi Market",
        "description": "Experience Korea''s largest seafood market, where you can see a wide variety of fresh seafood and local vendors. Guided tour, Sightseeing."
      },
      {
        "time": "Variable",
        "title": "Drop-off - Busan International Passenger Terminal",
        "description": "Return to 부산항국제여객터미널 크루즈탑승장 (Busan International Passenger Terminal Cruise Boarding Gate). 100% guaranteed return before cruise ship departure time."
      }
    ]'::jsonb,
    '[
      {
        "question": "What time can I be picked up?",
        "answer": "We can arrange pickup at any time based on your cruise ship schedule. I arrive at 12 PM. Can I be picked up? - Absolutely! Pickup time adjusts to cruise ship arrival time, typically from 7:00 AM to 10:00 PM. Early pickup (6:00 AM) is possible but may incur an additional guide fee (KRW 10,000 per person)."
      },
      {
        "question": "Will we be back at the port in time?",
        "answer": "Our ship departs at 3 PM. Will we be back at the port by 2:30 PM? - 100% guaranteed! We always schedule the tour according to the cruise ship''s arrival and departure times. Drop-off is always before the ship departs."
      },
      {
        "question": "Is lunch included?",
        "answer": "No, lunch is not included. Lunch is provided at a local restaurant at your own expense (Optional, Extra fee). Please inform us of any dietary restrictions in advance."
      },
      {
        "question": "Are entrance fees included?",
        "answer": "Yes, entrance fees to attractions are included. However, Busan Tower entrance fee and Songdo Sky Cable Car entrance fee are optional and payable on-site."
      },
      {
        "question": "What should I bring?",
        "answer": "Comfortable shoes, camera, and sunscreen are recommended."
      },
      {
        "question": "How do I find the guide?",
        "answer": "The guide will be waiting at Busan Port 1 hour before the cruise arrival time, holding a \"Love Korea\" sign inside the terminal. If you cannot find the guide, wait inside the terminal and look for the \"Love Korea\" team. Connect to Wi-Fi and contact via WhatsApp if needed: +82 10 4521 7582."
      },
      {
        "question": "Can the itinerary change?",
        "answer": "Yes, since this tour is tailored to the cruise schedule, the duration may vary, and time spent at each attraction might be shorter or longer. Also, if a tourist site is located far away and the return time to the cruise becomes tight, that stop may be skipped. The guide will make accurate adjustments on-site as needed."
      },
      {
        "question": "What if my cruise arrival time is not listed?",
        "answer": "Even if you cannot select an option for the cruise arrival time, we will communicate with you via messenger and adjust the tour schedule to match your cruise ship''s timing. It is recommended to create a group chat with the guide the day before the tour."
      }
    ]'::jsonb,
    4.8,
    223,
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
  'Busan International Passenger Terminal',
  '부산항국제여객터미널 크루즈탑승장, 206, Jungang-daero, Jung-gu, Busan',
  35.0974,
  129.0327,
  NULL
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
WHERE t.slug = 'busan-sightseeing-tour-cruise-passengers'
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
WHERE t.slug = 'busan-sightseeing-tour-cruise-passengers'
ORDER BY pp.pickup_time;








