-- =============================================================================
-- Supplement: East Signature Nature Core — full English (+ KO badges) copy
-- =============================================================================
-- Targets slug: jeju-east-small-group-template-preview
-- Run AFTER: insert-jeju-east-small-group-template-preview.sql
--
-- Replaces route order with: Stone Park → Seongeup → Lunch → Seopjikoji →
-- Seongsan Ilchulbong → Hamdeok Beach, and loads FAQs / practical / seasonal
-- text from the product brief. Idempotent UPDATE by slug.
-- =============================================================================

BEGIN;

UPDATE tours
SET
  title = 'East Signature Nature Core',
  tag = 'Small group · East Jeju',
  subtitle = $s$
A well-paced East Jeju route that begins with Jeju’s stone heritage and village culture, then opens into dramatic coastal scenery, Seongsan’s iconic views, and a refreshing beach finish.
$s$,
  description = $d$
A balanced East Jeju course that moves naturally from Jeju’s cultural texture to its most iconic eastern coastal highlights.
$d$,
  highlight = $h$
A classic East Jeju route designed to build gradually from calm cultural stops to the region’s most recognizable scenery.
$h$,
  badges = $json$
[
  "First-Time Friendly",
  "Scenic East Jeju",
  "Balanced Day Flow",
  "Culture to Coast",
  "Family-Friendly",
  "Weather-Aware Operation"
]
$json$::jsonb,
  highlights = $json$
[
  "Best for: First-time visitors to Jeju, couples, travelers with parents, and guests who want a balanced East Jeju route that includes culture, scenery, and iconic landmarks.",
  "Not ideal for: Travelers who want a café-heavy day, a mostly indoor itinerary, or those who strongly prefer minimal outdoor walking.",
  "Walking level: Moderate — Jeju Stone Park and Seongeup Folk Village are relatively comfortable; Seopjikoji and Seongsan can feel more demanding depending on distance, weather, and crowds.",
  "Rain safety: Medium — not fully rain-proof, but usually operable by adjusting stay times and sequence.",
  "Family fit: Good — scenic sightseeing rather than high-activity travel.",
  "Senior fit: Good — exposed coastal sections can be shortened on the day if needed.",
  "Scenic intensity: High — stone landscape and village atmosphere to coastal grassland, volcanic views, and a bright beach finish.",
  "Photo value: High — several of East Jeju’s most photogenic signature points in one day.",
  "Relaxation level: Medium — not rushed, but not a slow café-style day.",
  "Outdoor / indoor balance: Mostly outdoors; calmer first half, stronger scenic second half.",
  "Booking card summary: A first-time-friendly East Jeju course from Jeju Stone Park and Seongeup through Seopjikoji, Seongsan Ilchulbong, and a bright Hamdeok Beach finish.",
  "Related: East Nature + Café Relax — scenic highlights with slower café pace. East Family & Rain-Safer — stronger indoor stability for families or rainy days."
]
$json$::jsonb,
  includes = $json$
[
  "Practical guidance after booking — not only a confirmation",
  "Final pickup information once details are confirmed",
  "Reminder within 12 hours before the tour",
  "Guidance for the first stop of the day",
  "Clothing and weather tips",
  "Short tips for each major stop",
  "On-site updates if conditions require adjustments",
  "Licensed professional guide (small group)",
  "Round-trip transport for the scheduled route"
]
$json$::jsonb,
  excludes = $json$
[
  "Meals and drinks unless your booked fare states otherwise",
  "Attraction entrance fees unless explicitly included in your fare",
  "Personal expenses, tips, and travel insurance"
]
$json$::jsonb,
  schedule = $json$
[
  {"time": "09:00", "title": "Jeju Stone Park", "description": "Calm opening — Jeju’s volcanic stone landscape and cultural identity."},
  {"time": "10:30", "title": "Seongeup Folk Village", "description": "Traditional village atmosphere — stone walls, thatched roofs, local character."},
  {"time": "12:15", "title": "Lunch", "description": "Midday reset before the major coastal highlights (meal per your fare)."},
  {"time": "13:30", "title": "Seopjikoji", "description": "Signature East Jeju coast — grassland, volcanic terrain, and open sea."},
  {"time": "15:00", "title": "Seongsan Ilchulbong", "description": "Iconic volcanic centerpiece of East Jeju — viewpoint or longer scenic stay depending on the day."},
  {"time": "16:45", "title": "Hamdeok Beach", "description": "Bright, relaxed beach finish — open shoreline and lighter mood."}
]
$json$::jsonb,
  itinerary_details = $json$
[
  {
    "time": "45–60 min",
    "activity": "Jeju Stone Park",
    "description": "A calm opening where Jeju’s volcanic stone landscape and cultural identity come into focus. Starting here gives a grounded beginning before the more dramatic coastal stops. Recommended stay 45–60 minutes. Walking: low to moderate — better for unhurried exploration. Photo tip: clean compositions with stone sculptures and open space. Restroom: available. Weather: easier than wind-exposed coasts; not fully indoors. If delayed: stay time can be shortened.",
    "images": ["https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop"]
  },
  {
    "time": "35–50 min",
    "activity": "Seongeup Folk Village",
    "description": "Traditional village life and local atmosphere after the stone park — adds human texture so the first half feels layered, not repetitive. Recommended stay 35–50 minutes. Walking: low to moderate. Photo tip: thatched roofs and stone walls together capture the Jeju mood. Restroom: available. Weather: often still worthwhile in light rain; bring umbrella or raincoat. If delayed: can shorten to core sections only.",
    "images": ["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop"]
  },
  {
    "time": "50–70 min",
    "activity": "Lunch",
    "description": "Midday break that resets rhythm before the exposed coastal second half. Restaurant may flex with route, waits, and guest preferences. Recommended stay 50–70 minutes. On rainy days, lunch doubles as a natural indoor rest.",
    "images": ["https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=600&fit=crop"]
  },
  {
    "time": "40–60 min",
    "activity": "Seopjikoji",
    "description": "One of East Jeju’s signature coastal highlights — grassland, volcanic ground, and sea together. Recommended stay 40–60 minutes. Walking: moderate; wind and distance affect fatigue. Photo tip: wide angles with grassland and coastline. Restroom: available. Weather: strong wind or rain may shorten the visit or shift to a viewpoint-style stop. If delayed: shorten when needed; skipping entirely is usually not recommended.",
    "images": ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop"]
  },
  {
    "time": "30–50 min",
    "activity": "Seongsan Ilchulbong",
    "description": "Symbolic centerpiece of East Jeju — one of the island’s most recognizable volcanic views. Recommended stay 30–50 minutes (viewpoint-focused or slightly longer scenic stay). Walking: low to moderate depending on how far guests explore. Photo tip: wide shot showing the Seongsan silhouette. Restroom: check nearby facilities. Weather: fog, wind, and crowds strongly affect the experience. If delayed: can compress to a shorter viewpoint visit.",
    "images": ["https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=600&fit=crop"]
  },
  {
    "time": "30–45 min",
    "activity": "Hamdeok Beach",
    "description": "Bright beach finish — open sea and a lighter, relaxed close to the day. Recommended stay 30–45 minutes. Walking: low along the beachfront. Photo tip: shoreline and sea color in wide compositions. Restroom: available. Weather: wind can drop felt temperature quickly; stay may be shortened. If delayed: easier to trim than core mid-route highlights.",
    "images": ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop"]
  }
]
$json$::jsonb,
  faqs = $json$
[
  {"question": "Is this course good for first-time visitors to Jeju?", "answer": "Yes. It combines cultural atmosphere, East Jeju coastal scenery, and one of the island’s most iconic landmarks in one balanced route."},
  {"question": "Is the walking very difficult?", "answer": "Not overall, but the second half can feel more tiring than the first, especially around Seopjikoji and Seongsan depending on weather and walking distance."},
  {"question": "Can the tour still run if it rains?", "answer": "Yes. This is not a fully rain-specialized route, so stay times or order may be adjusted to protect on-the-day quality."},
  {"question": "Is it okay to join with parents?", "answer": "Yes. The structure is generally comfortable, and exposed coastal sections can be shortened if needed."},
  {"question": "Can I join with children?", "answer": "Yes. It is closer to scenic sightseeing than a high-activity family itinerary."},
  {"question": "Can the order change?", "answer": "Yes. Coastal sections are sensitive to wind, traffic, and crowds; partial reordering can create a smoother flow — optimization, not a downgrade."},
  {"question": "Is lunch included?", "answer": "That depends on the product setup; the route is designed with a meal break in the middle. Check your booking fare."},
  {"question": "Why start at Jeju Stone Park?", "answer": "A calmer, more stable start. The route builds mood and scenery gradually instead of peaking immediately with open-sea views."},
  {"question": "Why is Seongeup placed next?", "answer": "It adds traditional village texture after the stone landscape so the first half feels layered rather than one-note nature."},
  {"question": "Why is lunch placed there?", "answer": "It resets energy before the more exposed and visually intense afternoon at Seopjikoji, Seongsan, and Hamdeok."},
  {"question": "Why is the later part structured this way?", "answer": "Seopjikoji and Seongsan are signature highlights — grouping them focuses the scenic core of the day; Hamdeok releases intensity with a lighter finish."}
]
$json$::jsonb,
  pickup_info = $p$
The actual departure time may vary depending on pickup location and same-day road conditions. Final pickup guidance is provided after booking, with more specific instructions sent again the day before or the morning of the tour.
$p$,
  notes = $n$
WHAT TO WEAR / BRING: Comfortable shoes and a light outer layer; hat and sunglasses on sunny days; water; portable charger for photos.

WALKING / STAIRS: Not extreme overall, but the second half can feel more tiring than the first — especially Seopjikoji and Seongsan. Pace can be adjusted on site for parents or stamina concerns.

CHILDREN: Suited to families who enjoy scenic sightseeing; not a high-activity kids’ program.

SEASONAL — Spring: Often the most balanced season if wind is moderate. Summer: Flexible outdoor timing around heat and sun. Fall: Clear visibility and comfortable movement. Winter: Wind is the main variable; exposed stops may be shorter.

RAIN / WIND / PEAK SEASON: Coastal sections may become more viewpoint-based in rain; second half is wind-sensitive; on crowded days, efficient highlights beat long stays everywhere.

POST-BOOKING: We focus on pickup, movement, and day-of guidance that is genuinely useful — not only an itinerary PDF.

GOOD TO KNOW: Not a café-centered slow day; second half is more weather-exposed; order changes are on-site optimization.
$n$,
  gallery_images = $json$
[
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop"
]
$json$::jsonb,
  image_url = 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=85',
  seo_title = 'East Signature Nature Core | East Jeju Small Group Day Tour | AtoCKorea',
  meta_description = 'Stone Park & Seongeup to Seopjikoji, Seongsan, and Hamdeok — a balanced East Jeju day for first-time visitors. Small group, weather-aware operation.',
  translations = jsonb_build_object(
    'en', jsonb_build_object(
      'title', 'East Signature Nature Core',
      'subtitle', 'A well-paced East Jeju route from stone heritage and village culture to iconic coastal scenery and a beach finish.',
      'description', 'A balanced East Jeju course that moves naturally from Jeju’s cultural texture to its most iconic eastern coastal highlights.',
      'pickup_info', 'Final pickup guidance after booking; detailed instructions resent the day before or morning of the tour.',
      'badges', jsonb_build_array(
        'First-Time Friendly',
        'Scenic East Jeju',
        'Balanced Day Flow',
        'Culture to Coast',
        'Family-Friendly',
        'Weather-Aware Operation'
      )
    ),
    'ko', jsonb_build_object(
      'title', '동부 시그니처 네이처 코어',
      'subtitle', '제주 돌·마을 문화에서 시작해 동부 절경과 성산, 상쾌한 해변 마무리까지 이어지는 동부 당일 코스입니다.',
      'description', '제주의 문화적 질감에서 동부 대표 해안 하이라이트로 자연스럽게 이어지는 균형 잡힌 동부 일일 코스입니다.',
      'pickup_info', '예약 확정 후 최종 픽업 안내; 전날 또는 당일 아침에 구체 안내를 다시 보냅니다.',
      'badges', jsonb_build_array(
        '제주 첫 방문자 추천',
        '동부 대표 절경 코스',
        '하루 흐름이 안정적인 코스',
        '문화에서 해안 절경으로 이어지는 구성',
        '가족 동반에도 무난한 일정',
        '당일 현장 상황에 맞춘 유연 운영'
      )
    )
  ),
  updated_at = NOW()
WHERE slug = 'jeju-east-small-group-template-preview';

COMMIT;

-- Verify
SELECT slug, title, subtitle, jsonb_array_length(badges) AS badge_count, jsonb_array_length(faqs) AS faq_count, jsonb_array_length(itinerary_details) AS stop_count
FROM tours
WHERE slug = 'jeju-east-small-group-template-preview';
