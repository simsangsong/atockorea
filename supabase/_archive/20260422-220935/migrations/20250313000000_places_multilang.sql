-- places 다국어: lang_type 컬럼 추가, (id, lang_type) 복합 유일/업서트 대상
-- 기존 행은 lang_type='ko'로 유지

ALTER TABLE places ADD COLUMN IF NOT EXISTS lang_type TEXT NOT NULL DEFAULT 'ko';

-- 기존 PK 제거 후 (id, lang_type) 복합 유일 제약
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_pkey;
ALTER TABLE places ADD PRIMARY KEY (id, lang_type);

COMMENT ON COLUMN places.lang_type IS '언어: ko, en, chs, cht, ja (KorService2, EngService2, ChsService2, ChtService2, JpnService2)';

-- 기존 HNSW 인덱스 유지 (embedding 검색용)
-- idx_places_embedding_hnsw 는 이미 존재 시 유지
