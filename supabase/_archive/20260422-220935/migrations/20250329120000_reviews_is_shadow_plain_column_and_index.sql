-- Align DBs that never applied 20250328130000_reviews_shadow_images_rls.sql (or failed before is_shadow).
-- Public filter remains: is_visible = true AND is_shadow = false (unchanged in app).
-- Semantics: shadow when rating <= 3 (matches existing generated-column migration when present).

-- -----------------------------------------------------------------------------
-- 1) Add is_shadow only when missing. Skip if column already exists (e.g. GENERATED from earlier migration).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'is_shadow'
  ) INTO col_exists;

  IF col_exists THEN
    RAISE NOTICE 'reviews.is_shadow already exists; skipping ADD COLUMN';
    RETURN;
  END IF;

  ALTER TABLE public.reviews
    ADD COLUMN is_shadow boolean NOT NULL DEFAULT false;

  UPDATE public.reviews
  SET is_shadow = (rating <= 3);

  COMMENT ON COLUMN public.reviews.is_shadow IS 'True when rating <= 3 (author-only / shadow). Kept in sync by trigger when not GENERATED.';
END $$;

-- -----------------------------------------------------------------------------
-- 2) Trigger: keep is_shadow in sync with rating (plain column only; skip if GENERATED)
-- -----------------------------------------------------------------------------
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
  col_generated text;
BEGIN
  SELECT c.is_generated INTO col_generated
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name = 'is_shadow';

  IF col_generated = 'ALWAYS' THEN
    RAISE NOTICE 'reviews.is_shadow is GENERATED; skipping trigger';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS reviews_sync_is_shadow_trg ON public.reviews;
  CREATE TRIGGER reviews_sync_is_shadow_trg
    BEFORE INSERT OR UPDATE OF rating ON public.reviews
    FOR EACH ROW
    EXECUTE PROCEDURE public.reviews_sync_is_shadow_from_rating();
END $$;

-- -----------------------------------------------------------------------------
-- 3) Backfill NULL is_shadow only when column is not GENERATED (UPDATE on GENERATED fails)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  col_generated text;
BEGIN
  SELECT c.is_generated INTO col_generated
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name = 'is_shadow';

  IF col_generated = 'ALWAYS' THEN
    RETURN;
  END IF;

  UPDATE public.reviews
  SET is_shadow = (rating <= 3)
  WHERE is_shadow IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 4) Partial indexes for public reads (is_visible + non-shadow)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_public_created_desc
  ON public.reviews (created_at DESC)
  WHERE is_visible = true AND is_shadow = false;

CREATE INDEX IF NOT EXISTS idx_reviews_public_rating_created_desc
  ON public.reviews (rating DESC, created_at DESC)
  WHERE is_visible = true AND is_shadow = false;

COMMENT ON INDEX public.idx_reviews_public_created_desc IS 'Public review lists ordered by created_at';
COMMENT ON INDEX public.idx_reviews_public_rating_created_desc IS 'Homepage preview: rating desc then created_at';
