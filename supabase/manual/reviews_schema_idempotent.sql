-- =============================================================================
-- 리뷰 기능용 Supabase 수동 실행 SQL (idempotent)
-- - 컬럼/인덱스/정책이 이미 있으면 건너뜀 또는 IF NOT EXISTS / OR REPLACE
-- - 20250328130000_reviews_shadow_images_rls + 20250329120000 내용 통합
-- Supabase SQL Editor 또는 psql에서 한 번에 실행 가능
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) images 컬럼 + 레거시 photos → images 이전 후 photos 제거
-- -----------------------------------------------------------------------------
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'photos'
  ) THEN
    UPDATE public.reviews r
    SET images = COALESCE(r.photos, '[]'::jsonb)
    WHERE r.images IS NULL
       OR r.images = '[]'::jsonb
       OR jsonb_array_length(COALESCE(r.images, '[]'::jsonb)) = 0;

    UPDATE public.reviews r
    SET images = COALESCE(r.photos, '[]'::jsonb)
    WHERE r.images IS NULL;

    ALTER TABLE public.reviews DROP COLUMN photos;
  END IF;
END $$;

COMMENT ON COLUMN public.reviews.images IS 'Array of image URLs (e.g. from /api/upload under folder reviews/{userId}/...)';

-- -----------------------------------------------------------------------------
-- 2) is_shadow
--    - 없으면: GENERATED ALWAYS AS (rating <= 3) STORED (앱 공개 필터와 동일 의미)
--    - 이미 있으면: ADD 생략. plain 컬럼이면 트리거로 rating 동기화
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  col_exists boolean;
  col_gen text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'is_shadow'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE public.reviews
      ADD COLUMN is_shadow boolean
      GENERATED ALWAYS AS (rating <= 3) STORED;
    COMMENT ON COLUMN public.reviews.is_shadow IS 'true when rating <= 3 (shadow / author-only). GENERATED from rating.';
    RAISE NOTICE 'reviews.is_shadow added (GENERATED)';
    RETURN;
  END IF;

  SELECT c.is_generated INTO col_gen
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name = 'is_shadow';

  IF col_gen = 'ALWAYS' THEN
    RAISE NOTICE 'reviews.is_shadow already GENERATED; skip';
    RETURN;
  END IF;

  RAISE NOTICE 'reviews.is_shadow exists as plain column; ensure trigger (see below)';
END $$;

COMMENT ON COLUMN public.reviews.is_visible IS 'Moderation / system: false hides from public lists. Authors still see their own rows via RLS.';

-- plain is_shadow 인 경우에만 트리거 (GENERATED면 스킵)
CREATE OR REPLACE FUNCTION public.reviews_sync_is_shadow_from_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_shadow := (NEW.rating <= 3);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  col_gen text;
BEGIN
  SELECT c.is_generated INTO col_gen
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name = 'is_shadow';

  IF col_gen = 'ALWAYS' THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS reviews_sync_is_shadow_trg ON public.reviews;
  CREATE TRIGGER reviews_sync_is_shadow_trg
    BEFORE INSERT OR UPDATE OF rating ON public.reviews
    FOR EACH ROW
    EXECUTE PROCEDURE public.reviews_sync_is_shadow_from_rating();
END $$;

DO $$
DECLARE
  col_gen text;
BEGIN
  SELECT c.is_generated INTO col_gen
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name = 'is_shadow';

  IF col_gen = 'ALWAYS' THEN
    RETURN;
  END IF;

  UPDATE public.reviews
  SET is_shadow = (rating <= 3)
  WHERE is_shadow IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3) 인덱스 (부분 인덱스 — IF NOT EXISTS)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_public_by_tour
  ON public.reviews (tour_id, rating DESC, created_at DESC)
  WHERE is_visible = true AND (rating > 3);

CREATE INDEX IF NOT EXISTS idx_reviews_public_created_desc
  ON public.reviews (created_at DESC)
  WHERE is_visible = true AND is_shadow = false;

CREATE INDEX IF NOT EXISTS idx_reviews_public_rating_created_desc
  ON public.reviews (rating DESC, created_at DESC)
  WHERE is_visible = true AND is_shadow = false;

COMMENT ON INDEX public.idx_reviews_public_created_desc IS 'Public review lists ordered by created_at';
COMMENT ON INDEX public.idx_reviews_public_rating_created_desc IS 'Homepage preview: rating desc then created_at';

-- -----------------------------------------------------------------------------
-- 4) 투어 집계 함수 (공개 리뷰만 반영)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tour_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.tours
  SET
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.reviews
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND is_visible = true
        AND rating > 3
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
        AND is_visible = true
        AND rating > 3
    )
  WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) RLS (기존 정책 이름이 있으면 DROP 후 재생성)
-- -----------------------------------------------------------------------------
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select_public_own_or_admin" ON public.reviews;

CREATE POLICY "reviews_select_public_own_or_admin"
  ON public.reviews
  FOR SELECT
  USING (
    (is_visible = true AND is_shadow = false)
    OR (auth.uid() = user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6) Storage: tour-images 버킷 — reviews/{uid}/ 경로
--    (버킷이 없으면 대시보드에서 생성 필요)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated uploads to tour-images reviews folder" ON storage.objects;
CREATE POLICY "Authenticated uploads to tour-images reviews folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = 'reviews'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own files in tour-images reviews folder" ON storage.objects;
CREATE POLICY "Users update own files in tour-images reviews folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = 'reviews'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own files in tour-images reviews folder" ON storage.objects;
CREATE POLICY "Users delete own files in tour-images reviews folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = 'reviews'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- =============================================================================
-- 끝. 실행 후: public.reviews 에 is_shadow, images 확인
-- =============================================================================
