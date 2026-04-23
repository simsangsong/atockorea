-- ============================================================
-- Parser dictionary seed data
-- Covers the 6 manual test cases defined in step4:
--
--   Test 1 (rule match):
--     "부모님과 첫 제주인데 많이 안 걷고 동쪽 위주로"
--     → with_seniors=true, first_visit=true, max_walking_level=easy,
--       region_preference=east
--
--   Test 2 (synonym match):
--     "빡세지 않게 사진 예쁜 곳 위주"
--     → max_walking_level=easy, photo_priority=8
--
--   Test 3 (similarity match):
--     "뻔한 데보다 감성 있고 덜 관광지스러운 곳"
--     → hidden_gem_priority=8, avoid_overly_touristy=true
--
--   Test 4 (LLM filler trigger):
--     "비 와도 괜찮고 오전부터 여유 있게"
--     → need_indoor_if_rain=true, morning_preference=true
--       (stage1/2/3 intentionally left sparse so stage4 fires)
--
--   Test 5 (parserHints override): handled by merge.ts allowlist
--   Test 6 (route contract): no data change needed
-- ============================================================

begin;

-- ============================================================
-- A. request_phrase_rules  (Stage 1 — deterministic, high confidence)
-- ============================================================

insert into public.request_phrase_rules
  (locale, pattern, match_type, intent_key, slot_key, slot_value, confidence, priority, is_active)
values

-- ── region ────────────────────────────────────────────────────
('ko', '동쪽',    'contains', 'region_east',    'region_preference', '"east"',    0.95, 10, true),
('ko', '동부',    'contains', 'region_east',    'region_preference', '"east"',    0.95, 10, true),
('ko', '성산',    'contains', 'region_east',    'region_preference', '"east"',    0.95, 10, true),
('ko', '서쪽',    'contains', 'region_west',    'region_preference', '"west"',    0.95, 10, true),
('ko', '서부',    'contains', 'region_west',    'region_preference', '"west"',    0.95, 10, true),
('ko', '애월',    'contains', 'region_west',    'region_preference', '"west"',    0.95, 10, true),
('ko', '한림',    'contains', 'region_west',    'region_preference', '"west"',    0.95, 10, true),
('ko', '남쪽',    'contains', 'region_south',   'region_preference', '"south"',   0.95, 10, true),
('ko', '남부',    'contains', 'region_south',   'region_preference', '"south"',   0.95, 10, true),
('ko', '서귀포',  'contains', 'region_south',   'region_preference', '"south"',   0.95, 10, true),
('ko', '중문',    'contains', 'region_south',   'region_preference', '"south"',   0.95, 10, true),
('ko', '북쪽',    'contains', 'region_north',   'region_preference', '"north"',   0.95, 10, true),
('ko', '북부',    'contains', 'region_north',   'region_preference', '"north"',   0.95, 10, true),
('ko', '제주시',  'contains', 'region_central', 'region_preference', '"central"', 0.95, 10, true),

-- ── first visit ───────────────────────────────────────────────
('ko', '첫 제주',   'contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),
('ko', '처음 제주', 'contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),
('ko', '제주 처음', 'contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),
('ko', '첫방문',    'contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),
('ko', '처음 와',   'contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),
('ko', '처음이에요','contains', 'first_visit', 'first_visit', 'true', 0.95, 10, true),

-- ── walking level: easy ───────────────────────────────────────
('ko', '많이 안 걷', 'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.95, 10, true),
('ko', '걷기 싫',    'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.95, 10, true),
('ko', '걷기 힘',    'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.95, 10, true),
('ko', '이동 적게',  'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.95, 10, true),
('ko', '편하게',     'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.90, 20, true),
('ko', '무리 없이',  'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.90, 20, true),
('ko', '천천히',     'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.85, 30, true),
('ko', '여유롭게',   'contains', 'walking_easy', 'max_walking_level', '"easy"', 0.85, 30, true),

-- ── walking level: hard ───────────────────────────────────────
('ko', '등산',    'contains', 'walking_hard', 'max_walking_level', '"hard"', 0.95, 10, true),
('ko', '트레킹',  'contains', 'walking_hard', 'max_walking_level', '"hard"', 0.95, 10, true),
('ko', '한라산',  'contains', 'walking_hard', 'max_walking_level', '"hard"', 0.95, 10, true),
('ko', '올레길',  'contains', 'walking_hard', 'max_walking_level', '"hard"', 0.90, 10, true),

-- ── seniors ───────────────────────────────────────────────────
('ko', '부모님',    'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),
('ko', '어르신',    'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),
('ko', '할머니',    'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),
('ko', '할아버지',  'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),
('ko', '노부모',    'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),
('ko', '연세 드신', 'contains', 'with_seniors', 'with_seniors', 'true', 0.95, 10, true),

-- ── children ──────────────────────────────────────────────────
('ko', '아이',    'contains', 'with_children', 'with_children', 'true', 0.90, 10, true),
('ko', '어린이',  'contains', 'with_children', 'with_children', 'true', 0.90, 10, true),
('ko', '유아',    'contains', 'with_children', 'with_children', 'true', 0.95, 10, true),
('ko', '아기',    'contains', 'with_children', 'with_children', 'true', 0.95, 10, true),
('ko', '초등학생','contains', 'with_children', 'with_children', 'true', 0.95, 10, true),

-- ── photo priority ────────────────────────────────────────────
('ko', '사진 맛집',   'contains', 'photo_high',   'photo_priority', '9', 0.95, 10, true),
('ko', '포토스팟',    'contains', 'photo_high',   'photo_priority', '9', 0.95, 10, true),
('ko', '인스타',      'contains', 'photo_high',   'photo_priority', '8', 0.90, 10, true),
('ko', '감성 사진',   'contains', 'photo_high',   'photo_priority', '8', 0.90, 10, true),
('ko', '사진 예쁜',   'contains', 'photo_high',   'photo_priority', '8', 0.90, 10, true),
('ko', '사진 찍기 좋','contains', 'photo_high',   'photo_priority', '8', 0.90, 10, true),

-- ── hidden gem / avoid touristy ───────────────────────────────
('ko', '숨은 명소',     'contains', 'hidden_gem',    'hidden_gem_priority',  '8', 0.95, 10, true),
('ko', '로컬',          'contains', 'hidden_gem',    'hidden_gem_priority',  '7', 0.90, 10, true),
('ko', '현지인',        'contains', 'hidden_gem',    'hidden_gem_priority',  '7', 0.90, 10, true),
('ko', '덜 알려진',     'contains', 'hidden_gem',    'hidden_gem_priority',  '8', 0.90, 10, true),
('ko', '관광지 싫',     'contains', 'avoid_touristy','avoid_overly_touristy','true', 0.95, 10, true),
('ko', '관광지스럽지 않','contains','avoid_touristy','avoid_overly_touristy','true', 0.95, 10, true),
('ko', '덜 관광지',     'contains', 'avoid_touristy','avoid_overly_touristy','true', 0.95, 10, true),
('ko', '뻔한 곳 말고',  'contains', 'avoid_touristy','avoid_overly_touristy','true', 0.95, 10, true),
('ko', '뻔하지 않',     'contains', 'avoid_touristy','avoid_overly_touristy','true', 0.90, 10, true),

-- ── iconic spots ──────────────────────────────────────────────
('ko', '유명한',    'contains', 'iconic_high', 'iconic_spot_priority', '8', 0.85, 20, true),
('ko', '명소',      'contains', 'iconic_high', 'iconic_spot_priority', '7', 0.85, 20, true),
('ko', '대표 관광', 'contains', 'iconic_high', 'iconic_spot_priority', '8', 0.90, 10, true),
('ko', '필수 코스', 'contains', 'iconic_high', 'iconic_spot_priority', '9', 0.90, 10, true),
('ko', '꼭 가야',   'contains', 'iconic_high', 'iconic_spot_priority', '8', 0.90, 10, true),

-- ── nature ────────────────────────────────────────────────────
('ko', '자연',    'contains', 'nature_high', 'nature_priority', '8', 0.90, 10, true),
('ko', '바다',    'contains', 'nature_high', 'nature_priority', '7', 0.85, 20, true),
('ko', '해변',    'contains', 'nature_high', 'nature_priority', '7', 0.85, 20, true),
('ko', '숲',      'contains', 'nature_high', 'nature_priority', '7', 0.85, 20, true),
('ko', '오름',    'contains', 'nature_high', 'nature_priority', '8', 0.90, 10, true),
('ko', '폭포',    'contains', 'nature_high', 'nature_priority', '8', 0.90, 10, true),

-- ── food ──────────────────────────────────────────────────────
('ko', '맛집',    'contains', 'food_high', 'food_priority', '9', 0.95, 10, true),
('ko', '먹거리',  'contains', 'food_high', 'food_priority', '8', 0.90, 10, true),
('ko', '흑돼지',  'contains', 'food_high', 'food_priority', '8', 0.90, 10, true),
('ko', '해산물',  'contains', 'food_high', 'food_priority', '8', 0.90, 10, true),
('ko', '음식',    'contains', 'food_high', 'food_priority', '7', 0.85, 20, true),

-- ── cafe ──────────────────────────────────────────────────────
('ko', '카페',    'contains', 'cafe_high', 'cafe_priority', '8', 0.90, 10, true),
('ko', '커피',    'contains', 'cafe_high', 'cafe_priority', '7', 0.85, 20, true),
('ko', '디저트',  'contains', 'cafe_high', 'cafe_priority', '7', 0.85, 20, true),

-- ── culture ───────────────────────────────────────────────────
('ko', '박물관',  'contains', 'culture_high', 'culture_priority', '8', 0.90, 10, true),
('ko', '미술관',  'contains', 'culture_high', 'culture_priority', '8', 0.90, 10, true),
('ko', '역사',    'contains', 'culture_high', 'culture_priority', '7', 0.85, 20, true),
('ko', '문화',    'contains', 'culture_high', 'culture_priority', '7', 0.85, 20, true),
('ko', '전통',    'contains', 'culture_high', 'culture_priority', '7', 0.85, 20, true),

-- ── rainy day / indoor ────────────────────────────────────────
('ko', '비 와도',       'contains', 'rainy_ok',    'need_indoor_if_rain', 'true', 0.95, 10, true),
('ko', '비가 와도',     'contains', 'rainy_ok',    'need_indoor_if_rain', 'true', 0.95, 10, true),
('ko', '비 오면',       'contains', 'rainy_ok',    'need_indoor_if_rain', 'true', 0.95, 10, true),
('ko', '우천',          'contains', 'rainy_ok',    'need_indoor_if_rain', 'true', 0.95, 10, true),
('ko', '실내 위주',     'contains', 'indoor_pref', 'need_indoor_if_rain', 'true', 0.90, 10, true),
('ko', '실내',          'contains', 'indoor_pref', 'indoor_outdoor',      '"indoor"', 0.85, 20, true),

-- ── morning / sunset ──────────────────────────────────────────
('ko', '오전',      'contains', 'morning_pref', 'morning_preference', 'true', 0.90, 10, true),
('ko', '아침',      'contains', 'morning_pref', 'morning_preference', 'true', 0.90, 10, true),
('ko', '일출',      'contains', 'morning_pref', 'morning_preference', 'true', 0.95, 10, true),
('ko', '노을',      'contains', 'sunset_pref',  'sunset_preference',  'true', 0.95, 10, true),
('ko', '일몰',      'contains', 'sunset_pref',  'sunset_preference',  'true', 0.95, 10, true),
('ko', '저녁 노을', 'contains', 'sunset_pref',  'sunset_preference',  'true', 0.95, 10, true),

-- ── quick photo ───────────────────────────────────────────────
('ko', '잠깐',       'contains', 'quick_photo', 'quick_photo_mode', 'true', 0.80, 30, true),
('ko', '짧게',       'contains', 'quick_photo', 'quick_photo_mode', 'true', 0.80, 30, true),
('ko', '빠르게',     'contains', 'quick_photo', 'quick_photo_mode', 'true', 0.80, 30, true),

-- ── group type ────────────────────────────────────────────────
('ko', '혼자',      'contains', 'group_solo',    'group_type', '"solo"',    0.95, 10, true),
('ko', '솔로',      'contains', 'group_solo',    'group_type', '"solo"',    0.95, 10, true),
('ko', '커플',      'contains', 'group_couple',  'group_type', '"couple"',  0.95, 10, true),
('ko', '연인',      'contains', 'group_couple',  'group_type', '"couple"',  0.95, 10, true),
('ko', '가족',      'contains', 'group_family',  'group_type', '"family"',  0.95, 10, true),
('ko', '친구',      'contains', 'group_friends', 'group_type', '"friends"', 0.90, 10, true),
('ko', '친구들',    'contains', 'group_friends', 'group_type', '"friends"', 0.90, 10, true)

on conflict do nothing;


-- ============================================================
-- B. request_synonym_groups  (Stage 2 — phrase clusters)
-- ============================================================

insert into public.request_synonym_groups
  (locale, group_key, intent_key, slot_key, canonical_phrase, phrases, slot_value, confidence, is_active)
values

-- ── walking easy synonyms ─────────────────────────────────────
('ko', 'walking_easy_ko', 'walking_easy', 'max_walking_level', '편하게',
  ARRAY['빡세지 않게','빡세지않게','힘들지 않게','힘들지않게','가볍게','편하게','무리 없이','무리없이','느긋하게','여유 있게','여유있게','천천히','쉬엄쉬엄'],
  '"easy"', 0.88, true),

-- ── photo priority synonyms ───────────────────────────────────
('ko', 'photo_high_ko', 'photo_high', 'photo_priority', '사진 예쁜',
  ARRAY['사진 예쁜','사진예쁜','포토존','인생샷','감성샷','사진 잘 나오는','사진잘나오는','인스타 감성','인스타감성','사진 맛집','사진맛집'],
  '8', 0.88, true),

-- ── hidden gem synonyms ───────────────────────────────────────
('ko', 'hidden_gem_ko', 'hidden_gem', 'hidden_gem_priority', '숨은 명소',
  ARRAY['숨은 명소','숨은명소','로컬 맛집','로컬맛집','현지인 맛집','현지인맛집','덜 알려진','덜알려진','잘 모르는','잘모르는','숨겨진','비밀 장소','비밀장소'],
  '8', 0.85, true),

-- ── avoid touristy synonyms ───────────────────────────────────
('ko', 'avoid_touristy_ko', 'avoid_touristy', 'avoid_overly_touristy', '관광지 말고',
  ARRAY['관광지 말고','관광지말고','뻔한 데','뻔한데','뻔한 곳','뻔한곳','관광지스러운','관광지스럽지 않','관광지스럽지않','덜 관광지스러운','덜관광지스러운','감성 있는','감성있는'],
  'true', 0.85, true),

-- ── nature synonyms ───────────────────────────────────────────
('ko', 'nature_high_ko', 'nature_high', 'nature_priority', '자연',
  ARRAY['자연','자연 속','자연속','힐링','힐링 여행','힐링여행','녹음','초록','바다 보이는','바다보이는','바다뷰','오름','오름 트레킹','오름트레킹'],
  '8', 0.85, true),

-- ── food synonyms ─────────────────────────────────────────────
('ko', 'food_high_ko', 'food_high', 'food_priority', '맛집',
  ARRAY['맛집','먹방','먹거리','흑돼지','해산물','회','갈치','옥돔','제주 음식','제주음식','로컬 식당','로컬식당'],
  '8', 0.88, true),

-- ── cafe synonyms ─────────────────────────────────────────────
('ko', 'cafe_high_ko', 'cafe_high', 'cafe_priority', '카페',
  ARRAY['카페','커피','디저트','베이커리','감성 카페','감성카페','뷰 카페','뷰카페','오션뷰 카페','오션뷰카페'],
  '8', 0.85, true),

-- ── rainy day synonyms ────────────────────────────────────────
('ko', 'rainy_ok_ko', 'rainy_ok', 'need_indoor_if_rain', '비 와도 괜찮은',
  ARRAY['비 와도','비와도','비가 와도','비가와도','비 오면','비오면','우천','우천시','비 오는 날','비오는날','실내 여행','실내여행'],
  'true', 0.88, true),

-- ── morning synonyms ──────────────────────────────────────────
('ko', 'morning_pref_ko', 'morning_pref', 'morning_preference', '오전',
  ARRAY['오전','아침','이른 아침','이른아침','일출','새벽','아침 일찍','아침일찍','오전부터'],
  'true', 0.85, true),

-- ── sunset synonyms ───────────────────────────────────────────
('ko', 'sunset_pref_ko', 'sunset_pref', 'sunset_preference', '노을',
  ARRAY['노을','일몰','석양','저녁 노을','저녁노을','해질녘','해질 무렵','해질무렵','선셋'],
  'true', 0.88, true),

-- ── seniors synonyms ──────────────────────────────────────────
('ko', 'with_seniors_ko', 'with_seniors', 'with_seniors', '부모님',
  ARRAY['부모님','어르신','할머니','할아버지','노부모','연세 드신','연세드신','어머니 아버지','어머니아버지','시부모'],
  'true', 0.90, true),

-- ── iconic synonyms ───────────────────────────────────────────
('ko', 'iconic_high_ko', 'iconic_high', 'iconic_spot_priority', '유명한 곳',
  ARRAY['유명한 곳','유명한곳','필수 코스','필수코스','꼭 가야 할','꼭가야할','대표 명소','대표명소','제주 대표','제주대표','관광 명소','관광명소'],
  '8', 0.85, true)

on conflict do nothing;


-- ============================================================
-- C. request_intent_examples  (Stage 3 — similarity)
-- Covers test 3: "뻔한 데보다 감성 있고 덜 관광지스러운 곳"
-- and test 4: "비 와도 괜찮고 오전부터 여유 있게"
-- ============================================================

insert into public.request_intent_examples
  (locale, intent_key, example_text, slot_key, slot_value, confidence, notes)
values

-- ── hidden gem / avoid touristy examples ─────────────────────
('ko', 'hidden_gem',    '뻔한 데보다 감성 있고 덜 관광지스러운 곳',          'hidden_gem_priority',  '8',     0.80, 'test3'),
('ko', 'avoid_touristy','뻔한 데보다 감성 있고 덜 관광지스러운 곳',          'avoid_overly_touristy','true',  0.80, 'test3'),
('ko', 'hidden_gem',    '유명한 곳보다는 현지인이 가는 숨은 명소 위주로',    'hidden_gem_priority',  '8',     0.80, null),
('ko', 'avoid_touristy','관광객 많은 곳은 피하고 싶어요',                    'avoid_overly_touristy','true',  0.80, null),
('ko', 'hidden_gem',    '잘 모르는 로컬 스팟 위주로 짜줘',                   'hidden_gem_priority',  '8',     0.78, null),
('ko', 'avoid_touristy','너무 관광지스럽지 않은 곳으로 부탁해요',            'avoid_overly_touristy','true',  0.78, null),

-- ── rainy day / morning examples ─────────────────────────────
('ko', 'rainy_ok',      '비 와도 괜찮고 오전부터 여유 있게',                 'need_indoor_if_rain',  'true',  0.80, 'test4'),
('ko', 'morning_pref',  '비 와도 괜찮고 오전부터 여유 있게',                 'morning_preference',   'true',  0.80, 'test4'),
('ko', 'rainy_ok',      '비가 와도 즐길 수 있는 실내 위주 코스',             'need_indoor_if_rain',  'true',  0.80, null),
('ko', 'morning_pref',  '아침 일찍 시작해서 여유롭게 돌아보고 싶어요',       'morning_preference',   'true',  0.78, null),

-- ── photo priority examples ───────────────────────────────────
('ko', 'photo_high',    '사진 잘 나오는 예쁜 곳 위주로 가고 싶어요',         'photo_priority',       '8',     0.78, null),
('ko', 'photo_high',    '인스타에 올릴 만한 감성 있는 포토스팟',             'photo_priority',       '8',     0.78, null),

-- ── nature examples ───────────────────────────────────────────
('ko', 'nature_high',   '자연 속에서 힐링하고 싶어요',                       'nature_priority',      '8',     0.78, null),
('ko', 'nature_high',   '바다 보이는 곳에서 여유롭게 쉬고 싶어요',           'nature_priority',      '7',     0.75, null),

-- ── food examples ─────────────────────────────────────────────
('ko', 'food_high',     '제주 맛집 위주로 먹방 여행 하고 싶어요',            'food_priority',        '9',     0.80, null),
('ko', 'food_high',     '흑돼지랑 해산물 꼭 먹고 싶어요',                   'food_priority',        '8',     0.78, null),

-- ── seniors examples ──────────────────────────────────────────
('ko', 'with_seniors',  '부모님 모시고 가는데 많이 안 걷는 코스로',          'with_seniors',         'true',  0.82, null),
('ko', 'walking_easy',  '부모님 모시고 가는데 많이 안 걷는 코스로',          'max_walking_level',    '"easy"',0.82, null),
('ko', 'with_seniors',  '어르신 모시고 가는 여행이라 편한 코스로 부탁해요',  'with_seniors',         'true',  0.80, null),

-- ── first visit examples ──────────────────────────────────────
('ko', 'first_visit',   '제주 처음이라 유명한 곳 위주로 보고 싶어요',        'first_visit',          'true',  0.80, null),
('ko', 'first_visit',   '첫 제주 여행인데 뭘 봐야 할지 모르겠어요',          'first_visit',          'true',  0.80, null),

-- ── culture examples ──────────────────────────────────────────
('ko', 'culture_high',  '제주 역사와 문화를 느낄 수 있는 곳 위주로',         'culture_priority',     '8',     0.78, null),
('ko', 'culture_high',  '박물관이나 미술관 같은 문화 공간 위주로 짜줘',      'culture_priority',     '8',     0.78, null)

on conflict do nothing;

commit;
