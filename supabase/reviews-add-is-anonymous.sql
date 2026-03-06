-- ============================================
-- reviews 테이블: 익명 리뷰 옵션 추가
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 익명 게시 여부 (true면 상세페이지에서 작성자명/아바타 비공개)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

COMMENT ON COLUMN reviews.is_anonymous IS 'When true, display name is shown as Anonymous on the tour detail page';
