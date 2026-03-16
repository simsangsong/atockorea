-- LOD vs Tour API 출처 구분 (전문가 권장: source_origin, last_sync_at)
ALTER TABLE places ADD COLUMN IF NOT EXISTS source_origin TEXT;

COMMENT ON COLUMN places.source_origin IS '데이터 출처: lod (국문관광정보 LOD), tour_api (한국관광공사 Tour API). NULL=기존 데이터.';

-- (선택) LOD category 저장용
ALTER TABLE places ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN places.category IS 'LOD rdf:type 클래스명 또는 Tour API contentTypeId 대응 분류.';
