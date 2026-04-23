-- 픽업/드롭오프 정보란에 사진 표시용 컬럼 추가
-- Run in Supabase SQL Editor.

ALTER TABLE pickup_points
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN pickup_points.image_url IS 'Optional image URL for the pickup/drop-off point (e.g. meeting point photo).';
