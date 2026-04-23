-- ============================================
-- 리뷰 테이블 (reviews) — 상세페이지 리뷰 섹션 연동
-- ============================================
-- 이미 complete-database-schema.sql 을 실행했다면
-- reviews 테이블이 있으므로, 익명 옵션만 추가하려면
-- supabase/reviews-add-is-anonymous.sql 만 실행하세요.
--
-- 테이블이 없는 경우 아래 전체를 실행하세요.

-- UUID 확장 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 리뷰 테이블
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  images JSONB DEFAULT '[]'::jsonb,

  is_anonymous BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 동일 사용자·동일 투어당 리뷰 1개 (booking_id 없을 때)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_tour_null_booking_key
  ON reviews (user_id, tour_id) WHERE booking_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible);

-- 기존 reviews 테이블이 이미 있는 경우를 대비해 컬럼을 보강합니다.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

COMMENT ON COLUMN reviews.is_anonymous IS 'When true, display as Anonymous on the tour detail page';
COMMENT ON COLUMN reviews.images IS 'Array of image URLs (e.g. from /api/upload)';

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON reviews;
CREATE POLICY "Anyone can view visible reviews"
  ON reviews FOR SELECT
  USING (is_visible = true);

DROP POLICY IF EXISTS "Users can create own reviews" ON reviews;
CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- (선택) 투어 평균 평점/리뷰 수 자동 갱신 트리거는 complete-database-schema.sql 의 update_tour_rating 참고
-- tours 테이블에 rating, review_count 컬럼이 있다면 해당 트리거를 추가하면 됩니다.
