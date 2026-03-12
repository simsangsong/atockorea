-- AI 검색을 위한 pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 관광지 데이터 테이블 (AI 추천 엔진용)
-- contentid를 PK로 사용, embedding은 OpenAI text-embedding-3-small(1536차원) 저장
CREATE TABLE IF NOT EXISTS places (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  address TEXT,
  image_url TEXT,
  mapx DOUBLE PRECISION,
  mapy DOUBLE PRECISION,
  overview TEXT,
  embedding vector(1536)
);

COMMENT ON TABLE places IS 'Tour API 관광지 + AI 벡터 임베딩 (OpenAI text-embedding-3-small 1536차원)';

-- 벡터 유사도 검색용 HNSW 인덱스 (코사인 유사도)
CREATE INDEX IF NOT EXISTS idx_places_embedding_hnsw
  ON places USING hnsw (embedding vector_cosine_ops);
