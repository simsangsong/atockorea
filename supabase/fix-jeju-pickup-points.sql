-- Fix pickup points for Jeju tour
-- Update names and coordinates to match the correct locations

-- First, delete existing pickup points for this tour
DELETE FROM pickup_points 
WHERE tour_id IN (
  SELECT id FROM tours WHERE slug = 'jeju-southern-top-unesco-spots-bus-tour'
);

-- Insert correct pickup points with proper names and coordinates
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  t.id,
  'Ocean suites Hotel',
  'Ocean Suites Jeju, 263, Yeon-dong, Jeju-si, Jeju-do',
  33.4996,
  126.5312,
  '08:30:00'::TIME
FROM tours t
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
UNION ALL
SELECT 
  t.id,
  'Jeju international airport',
  'Jeju International Airport, 2 Gonghang-ro, Jeju-si, Jeju-do',
  33.5113,
  126.4930,
  '08:45:00'::TIME
FROM tours t
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
UNION ALL
SELECT 
  t.id,
  'Lotte city hotel jeju',
  'Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do',
  33.4878,
  126.4886,
  '08:55:00'::TIME
FROM tours t
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
UNION ALL
SELECT 
  t.id,
  'Shilla duty free shop jeju',
  'Shilla Duty-Free Jeju Store, 255 Jungang-ro, Jeju-si, Jeju-do',
  33.5097,
  126.5237,
  '09:05:00'::TIME
FROM tours t
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour';

-- Verify the update
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
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
ORDER BY pp.pickup_time;

