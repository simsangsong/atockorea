-- places 상세 이미지 목록 저장 (Tour API detailImage2)
ALTER TABLE places ADD COLUMN IF NOT EXISTS detail_images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN places.detail_images IS '상세 이미지 목록 (Tour API detailImage2). [{ "originimgurl": "...", "serialnum": "1", ... }, ...]';
