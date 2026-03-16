-- =============================================================================
-- places 테이블 통합 스키마 (한 번에 실행, 있으면 건너뛰고 없으면 추가)
-- 여러 번 실행해도 안전 (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1) 테이블이 없으면 전체 스키마로 생성
CREATE TABLE IF NOT EXISTS places (
  id BIGINT NOT NULL,
  lang_type TEXT NOT NULL DEFAULT 'ko',
  title TEXT NOT NULL,
  address TEXT,
  image_url TEXT,
  mapx DOUBLE PRECISION,
  mapy DOUBLE PRECISION,
  overview TEXT,
  embedding vector(3072),
  detail_images JSONB DEFAULT '[]'::jsonb,
  source_origin TEXT,
  category TEXT,
  open_time TEXT,
  use_fee TEXT,
  tel TEXT,
  h3_res7 TEXT,
  h3_res9 TEXT,
  PRIMARY KEY (id, lang_type)
);

-- 2) 이미 테이블이 있었으면 컬럼만 없을 수 있으므로, 없으면 추가
ALTER TABLE places ADD COLUMN IF NOT EXISTS lang_type TEXT NOT NULL DEFAULT 'ko';
ALTER TABLE places ADD COLUMN IF NOT EXISTS detail_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE places ADD COLUMN IF NOT EXISTS source_origin TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS open_time TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS use_fee TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS tel TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS h3_res7 TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS h3_res9 TEXT;

-- 3) 코멘트 (있어도 덮어씀)
COMMENT ON TABLE places IS '관광지 (Tour API + LOD). embedding: Gemini 3072차원.';
COMMENT ON COLUMN places.lang_type IS '언어: ko, en, chs, cht, ja';
COMMENT ON COLUMN places.embedding IS 'Gemini embedding-001 3072차원 벡터';
COMMENT ON COLUMN places.detail_images IS '상세 이미지 목록 (Tour API detailImage2)';
COMMENT ON COLUMN places.source_origin IS '데이터 출처: lod, tour_api. NULL=기존 데이터';
COMMENT ON COLUMN places.category IS 'LOD rdf:type 클래스명 또는 Tour API contentTypeId 대응';
COMMENT ON COLUMN places.open_time IS '개폐장시간 (LOD openTime)';
COMMENT ON COLUMN places.use_fee IS '이용요금 (LOD fee)';
COMMENT ON COLUMN places.tel IS '연락처 (LOD tel)';
COMMENT ON COLUMN places.h3_res7 IS 'H3 인덱스 resolution 7 (시/군 단위)';
COMMENT ON COLUMN places.h3_res9 IS 'H3 인덱스 resolution 9 (동/맛집 단위)';

-- 4) 인덱스 (있으면 건너뜀)
CREATE INDEX IF NOT EXISTS idx_places_embedding_hnsw
  ON places USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_places_h3_res7 ON places (h3_res7) WHERE h3_res7 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_h3_res9 ON places (h3_res9) WHERE h3_res9 IS NOT NULL;
