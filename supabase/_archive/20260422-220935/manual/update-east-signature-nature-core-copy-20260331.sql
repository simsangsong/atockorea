-- =============================================================================
-- East Signature Nature Core — align listing / API fields with March 2026 copy
-- Route (cards): Stone Park → Ilchulland (Micheongul) → Seongeup → Seongsan → Seopjikoji
-- Lunch operational between Seongeup and Seongsan (not listed as an itinerary card in app)
-- =============================================================================
-- Run after the base product exists (see insert-east-signature-nature-core-product.sql).
-- Idempotent-friendly: UPDATE by slug only.
-- =============================================================================

BEGIN;

UPDATE tours
SET
  tag = 'Small group · East Jeju',
  subtitle =
    'A structured East Jeju route that starts with geology, moves through a lava cave, adds village texture, and finishes on the coast.',
  description =
    'A geology-to-coast East Jeju day: stone culture and museum context, lava cave, folk village, then Seongsan (free coastal side or paid summit) and Seopjikoji ridge.',
  highlight =
    'Stone Park → Micheongul Cave → Seongeup Folk Village → Seongsan Ilchulbong → Seopjikoji',
  meta_description =
    'East Jeju small-group day: Jeju Stone Park, Micheongul lava cave, Seongeup Village, Seongsan Ilchulbong (route choice), Seopjikoji. Lunch between village and Seongsan.',
  schedule = '[
    {"time":"09:00","title":"Jeju Stone Park","description":"Stone culture, rows of figures, underground museum context."},
    {"time":"10:35","title":"Ilchulland (Micheongul Cave)","description":"Lava-tube interior — cooler, geology follow-up to Stone Park."},
    {"time":"12:05","title":"Seongeup Folk Village","description":"Thatched roofs, lava-stone walls, village texture before the coast."},
    {"time":"14:20","title":"Seongsan Ilchulbong","description":"Crater UNESCO site — easier free coastal side or paid summit stairs."},
    {"time":"16:10","title":"Seopjikoji","description":"Ridge coastal walk, lighthouse line, exposed sea — final east coast stretch."}
  ]'::jsonb,
  itinerary_details = '[
    {"time":"60–75 min","activity":"Jeju Stone Park","description":"Opening geology and stone culture: outdoor stone rows, reflective water area, underground museum. Restrooms at entrance/museum. Mondays closed.","images":["https://images.unsplash.com/photo-1544077960-604201fe74bc?w=800&h=600&fit=crop"]},
    {"time":"55–70 min","activity":"Ilchulland (Micheongul Cave)","description":"Visitor lava-tube experience; dimmer and cooler than coast. Grip-friendly shoes.","images":["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop"]},
    {"time":"35–50 min","activity":"Seongeup Folk Village","description":"Traditional village layout, stone walls, thatched roofs. Free entry.","images":["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop"]},
    {"time":"70–90 min","activity":"Seongsan Ilchulbong","description":"Decision stop: free coastal path vs paid summit. Wind-exposed; first Monday of month closed.","images":["https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=800&h=600&fit=crop"]},
    {"time":"40–55 min","activity":"Seopjikoji","description":"Ridge walk, lighthouse, black volcanic shore. Free; very wind-sensitive.","images":["https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&h=600&fit=crop"]}
  ]'::jsonb,
  faqs = '[
    {"question":"What time does the tour start and end?","answer":"Pickup is usually between 8:20–9:00 AM depending on guest area, and return time depends on traffic and the final coastal stop."},
    {"question":"Does this exact route run every day?","answer":"Not always. Stone Park is closed on Mondays, and Seongsan Ilchulbong is closed on the first Monday of each month."},
    {"question":"Is the Seongsan summit climb mandatory?","answer":"No. Seongsan can be handled via the easier free side or the paid summit route."},
    {"question":"How hard is Seongsan Ilchulbong?","answer":"It is the hardest walking point of the day if guests choose the paid summit stairs. The easier side is much lighter."},
    {"question":"Can we see the haenyeo performance at Seongsan?","answer":"Treat it as a variable bonus, not a fixed promise. Seongsan-area haenyeo activity depends on season and weather conditions."},
    {"question":"Is Micheongul Cave difficult?","answer":"It is manageable for most guests, but darker and slightly more uneven than a normal museum path."},
    {"question":"Is this good for children?","answer":"Yes, especially for children around 8 and up."},
    {"question":"What happens if it rains?","answer":"The morning half remains more usable because of the museum and cave, while the final coastal stops may be shortened."}
  ]'::jsonb,
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core';

COMMIT;

SELECT slug, subtitle, updated_at FROM tours WHERE slug = 'east-signature-nature-core';
