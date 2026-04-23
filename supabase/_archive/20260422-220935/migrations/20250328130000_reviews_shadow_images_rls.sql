-- Step 2: Extend canonical `reviews` for shadow reviews + unify image column as `images`.
-- Public visibility: is_visible = true AND is_shadow = false (rating >= 4; is_shadow is generated from rating <= 3).
-- RLS + server queries: use both (RLS for direct Supabase client; API must still filter when using service role).

-- -----------------------------------------------------------------------------
-- 1) Image column: single canonical name `images` (API + reviews-table.sql already use `images`).
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
-- 2) is_shadow: stored generated column — true when rating <= 3 (author-only shadow).
--    Public lists must filter: is_visible AND NOT is_shadow (equivalent: rating >= 4 for visible rows).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'is_shadow'
  ) THEN
    ALTER TABLE public.reviews
      ADD COLUMN is_shadow boolean
      GENERATED ALWAYS AS (rating <= 3) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.reviews.is_shadow IS 'Generated: true when rating <= 3 (shadow / author-only). False when rating >= 4.';
COMMENT ON COLUMN public.reviews.is_visible IS 'Moderation / system: false hides from public lists. Authors still see their own rows via RLS.';

-- Help public homepage / tour queries (partial index).
CREATE INDEX IF NOT EXISTS idx_reviews_public_by_tour
  ON public.reviews (tour_id, rating DESC, created_at DESC)
  WHERE is_visible = true AND (rating > 3);

-- rating > 3 matches NOT is_shadow for valid ratings 1–5

-- -----------------------------------------------------------------------------
-- 3) Tour aggregates: only count public-facing reviews (visible + non-shadow).
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
-- 4) RLS: replace permissive SELECT with public-safe + own rows (+ admin read-all).
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

-- Preserve typical insert/update/delete from existing patterns
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
-- 5) Storage: explicit policies for review image paths under tour-images/reviews/{uid}/...
--    (Supabase ORs multiple INSERT policies; this adds path-scoped rules for review uploads.
--     2MB enforcement is application-side: lib/file-upload + /api/upload compression.)
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
