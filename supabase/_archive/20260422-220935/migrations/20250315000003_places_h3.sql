-- places H3 지오인덱스 컬럼 (LOD ETL / 근처 장소 검색용)
ALTER TABLE places ADD COLUMN IF NOT EXISTS h3_res7 TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS h3_res9 TEXT;

COMMENT ON COLUMN places.h3_res7 IS 'H3 인덱스 resolution 7 (시/군 단위). 위경도→H3 변환 값.';
COMMENT ON COLUMN places.h3_res9 IS 'H3 인덱스 resolution 9 (동/맛집 단위). 위경도→H3 변환 값.';

-- H3로 근처 장소 필터 시 인덱스 (선택)
CREATE INDEX IF NOT EXISTS idx_places_h3_res7 ON places (h3_res7) WHERE h3_res7 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_h3_res9 ON places (h3_res9) WHERE h3_res9 IS NOT NULL;
