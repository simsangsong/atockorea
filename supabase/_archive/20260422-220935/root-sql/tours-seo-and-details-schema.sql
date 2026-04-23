-- ============================================
-- tours 테이블 SEO 및 상세 일정/FAQ 컬럼 추가
-- ============================================
-- Supabase SQL Editor에서 실행하세요.
-- 기존에 highlights, faqs 컬럼이 이미 있으면 IF NOT EXISTS로 스킵됩니다.

-- 1. 검색 엔진 노출용 제목
ALTER TABLE tours ADD COLUMN IF NOT EXISTS seo_title TEXT;

-- 2. 검색 엔진 노출용 요약 (메타 설명, 권장 160자 이내)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS meta_description TEXT;
-- meta_description은 160자 이하 권장(검색 결과에서 잘리지 않음)
COMMENT ON COLUMN tours.meta_description IS 'Meta description for SEO; recommend keeping under 160 characters';

-- 3. 주요 특징 리스트 (text 배열)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS highlights TEXT[];

-- 4. 시간대별 상세 일정 (time, activity, description)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS itinerary_details JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN tours.itinerary_details IS 'Array of { time, activity, description } for timeline display';

-- 5. 자주 묻는 질문 (question, answer)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN tours.faqs IS 'Array of { question, answer } for FAQ accordion';

-- 기존 테이블에 이미 highlights, faqs가 JSONB로 있는 경우 위 ADD COLUMN은 스킵됩니다.
-- JSONB 버전을 쓰는 경우 itinerary_details만 새로 쓰고, schedule/faqs는 기존 컬럼을 계속 사용할 수 있습니다.
