-- ============================================
-- tours: 아동 자격(儿童资格), 권장 휴대품(建议携带), 접근성 시설(无障碍设施)
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 1. 아동 자격/참가 조건 (선택된 규칙 + num, num1, num2, text 등 파라미터)
-- 구조: [{ "id": "no_age_limit" }, { "id": "min_age", "num": 12, "text": "participate" }, ...]
ALTER TABLE tours ADD COLUMN IF NOT EXISTS child_eligibility JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN tours.child_eligibility IS 'Children/participant eligibility rules: array of { id, num?, num1?, num2?, text? }';

-- 2. 권장 휴대품 (문자열 배열)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS suggested_to_bring JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN tours.suggested_to_bring IS 'Suggested items to bring: array of strings';

-- 3. 접근성 시설 (儿童座椅, 婴儿车/轮椅 등)
-- 구조: { "child_seat": "one_free_on_request" | "none" | ..., "child_seat_custom": { "num1", "num2", "num3" }?, "stroller": "suitable"|"not_suitable", "wheelchair": "suitable"|"not_suitable", "note": true }
ALTER TABLE tours ADD COLUMN IF NOT EXISTS accessibility_facilities JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN tours.accessibility_facilities IS 'Accessibility: child seat option, stroller/wheelchair suitability, notes';
