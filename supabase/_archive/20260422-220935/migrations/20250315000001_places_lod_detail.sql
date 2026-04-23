-- LOD 상세 정보: 개폐장시간, 이용요금, 연락처 (sqlite_to_supabase 적재용)
ALTER TABLE places ADD COLUMN IF NOT EXISTS open_time TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS use_fee TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS tel TEXT;

COMMENT ON COLUMN places.open_time IS '개폐장시간 (LOD openTime).';
COMMENT ON COLUMN places.use_fee IS '이용요금 (LOD fee).';
COMMENT ON COLUMN places.tel IS '연락처 (LOD tel).';
