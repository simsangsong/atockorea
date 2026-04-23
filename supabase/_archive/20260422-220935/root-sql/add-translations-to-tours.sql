-- ============================================
-- Add translations field to tours table
-- ============================================
-- This adds a JSONB field to store translations for title, description, etc.

ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- Example structure for translations:
-- {
--   "zh": {
--     "title": "中文标题",
--     "description": "中文描述",
--     "subtitle": "中文副标题",
--     "tag": "中文标签",
--     "highlights": ["亮点1", "亮点2"],
--     "includes": ["包含1", "包含2"],
--     "excludes": ["不包含1", "不包含2"],
--     "schedule": [{"time": "09:00", "title": "中文标题", "description": "中文描述"}],
--     "faqs": [{"question": "中文问题", "answer": "中文答案"}],
--     "pickup_info": "中文接车信息",
--     "notes": "中文注意事项"
--   },
--   "zh-TW": {
--     "title": "繁體中文標題",
--     ...
--   },
--   "ko": {
--     "title": "한국어 제목",
--     ...
--   }
-- }

-- Create index for translations field
CREATE INDEX IF NOT EXISTS idx_tours_translations ON tours USING GIN (translations);




