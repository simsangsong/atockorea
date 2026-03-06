-- ============================================
-- Busan Top Attractions 투어 샘플 데이터 업데이트
-- ============================================
-- 대상 투어 ID: 0288eb78-b741-4bcf-821f-523518906753
-- Supabase SQL Editor에서 실행하세요.
-- 참고: highlights 컬럼이 TEXT[] 타입이면 ARRAY['...','...'] 사용.
-- 이미 JSONB면 아래와 같이 jsonb 배열로 설정하세요 (현재 스키마는 JSONB).

UPDATE tours
SET
  seo_title = 'Busan Top Attractions One-Day Tour | Gamcheon, Skywalk, Temple & More',
  meta_description = 'Explore Busan in one day: Gamcheon Culture Village, Oryukdo Skywalk, Haedong Yonggungsa Temple, and local markets. Licensed guide, hotel pickup. Book now.',
  highlights = '[
    "Gamcheon Culture Village (감천문화마을)",
    "Oryukdo Skywalk (오륙도 스카이워크)",
    "Haedong Yonggungsa Temple (해동용궁사)",
    "Jagalchi Market (자갈치시장)",
    "Hotel pickup & drop-off included"
  ]'::jsonb,
  itinerary_details = '[
    {"time": "08:30", "activity": "3 pickup location options", "description": "Haeundae Station Exit 5, Busan Station, Seomyeon-Yeog"},
    {"time": "09:00", "activity": "Yonggungsa Temple", "description": "Visit, Sightseeing (80 minutes)"},
    {"time": "10:30", "activity": "Cheongsapo Daritdol Observatory", "description": "Visit, Sightseeing (30 minutes)"},
    {"time": "11:30", "activity": "Local restaurant", "description": "Lunch (1 hour), Optional"},
    {"time": "12:45", "activity": "Haeunde Blueline Park - Cheongsapo Station", "description": "Free time, Sightseeing (40 minutes)"},
    {"time": "13:45", "activity": "Gwangan Bridge", "description": "Pass by"},
    {"time": "14:00", "activity": "United Nations Memorial Cemetery", "description": "Visit, Sightseeing (1 hour)"},
    {"time": "15:30", "activity": "Gamcheon Culture Village", "description": "Visit, Sightseeing (1.5 hours)"},
    {"time": "17:15", "activity": "Jagalchi Market", "description": "Hop-on Hop-off stop (5 minutes)"},
    {"time": "17:30", "activity": "3 drop-off locations", "description": "Seomyeon-Yeog, Busan Station, Haeundae Station Exit 5"}
  ]'::jsonb,
  faqs = '[
    {"question": "Is hotel pickup included?", "answer": "Yes. We offer pickup from designated hotels and points in Busan. You can select your pickup point at the time of booking."},
    {"question": "What is the group size?", "answer": "This tour runs in small groups. Exact capacity may vary by date; you will see the available spots when selecting your date."},
    {"question": "Can I cancel or change my booking?", "answer": "Free cancellation is available up to 24 hours before the tour start time. Changes may be possible subject to availability."},
    {"question": "Is lunch included?", "answer": "Lunch can be added as an option. Otherwise, your guide will recommend a local restaurant where you can purchase lunch at your own expense."}
  ]'::jsonb
WHERE id = '0288eb78-b741-4bcf-821f-523518906753';

-- 확인
SELECT id, title, seo_title, meta_description,
  jsonb_array_length(highlights) AS highlights_count,
  jsonb_array_length(itinerary_details) AS itinerary_count,
  jsonb_array_length(faqs) AS faqs_count
FROM tours
WHERE id = '0288eb78-b741-4bcf-821f-523518906753';

-- ============================================
-- 일정(itinerary_details)만 업데이트할 때 (위 전체 UPDATE 대신 아래만 실행)
-- ============================================
/*
UPDATE tours
SET itinerary_details = '[
  {"time": "08:30", "activity": "3 pickup location options", "description": "Haeundae Station Exit 5, Busan Station, Seomyeon-Yeog"},
  {"time": "09:00", "activity": "Yonggungsa Temple", "description": "Visit, Sightseeing (80 minutes)"},
  {"time": "10:30", "activity": "Cheongsapo Daritdol Observatory", "description": "Visit, Sightseeing (30 minutes)"},
  {"time": "11:30", "activity": "Local restaurant", "description": "Lunch (1 hour), Optional"},
  {"time": "12:45", "activity": "Haeunde Blueline Park - Cheongsapo Station", "description": "Free time, Sightseeing (40 minutes)"},
  {"time": "13:45", "activity": "Gwangan Bridge", "description": "Pass by"},
  {"time": "14:00", "activity": "United Nations Memorial Cemetery", "description": "Visit, Sightseeing (1 hour)"},
  {"time": "15:30", "activity": "Gamcheon Culture Village", "description": "Visit, Sightseeing (1.5 hours)"},
  {"time": "17:15", "activity": "Jagalchi Market", "description": "Hop-on Hop-off stop (5 minutes)"},
  {"time": "17:30", "activity": "3 drop-off locations", "description": "Seomyeon-Yeog, Busan Station, Haeundae Station Exit 5"}
]'::jsonb
WHERE id = '0288eb78-b741-4bcf-821f-523518906753';
*/
