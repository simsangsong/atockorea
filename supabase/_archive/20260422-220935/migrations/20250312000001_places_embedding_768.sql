-- places 테이블 embedding 컬럼을 Gemini embedding-001(3072차원)에 맞게 변경
-- google-genai SDK 사용 시 models/embedding-001 기본 출력 3072차원

-- 기존 HNSW 인덱스 제거
DROP INDEX IF EXISTS idx_places_embedding_hnsw;

-- embedding 컬럼 삭제 후 3072차원으로 재생성
ALTER TABLE places DROP COLUMN IF EXISTS embedding;
ALTER TABLE places ADD COLUMN embedding vector(3072);

COMMENT ON COLUMN places.embedding IS 'Gemini embedding-001 3072차원 벡터 (google-genai)';

-- 벡터 유사도 검색용 HNSW 인덱스 (코사인 유사도)
CREATE INDEX IF NOT EXISTS idx_places_embedding_hnsw
  ON places USING hnsw (embedding vector_cosine_ops);
