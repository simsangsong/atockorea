-- ============================================
-- Remove "Reserve now & pay later" / "pay nothing today" content from tours
-- ============================================
-- Run in Supabase SQL Editor or via migration.
-- Cleans description, notes, meta_description (TEXT) and faqs (JSONB).

-- 1) TEXT columns: remove known pay-later phrases (description, notes, meta_description)
UPDATE tours
SET
  description = TRIM(REGEXP_REPLACE(
    COALESCE(description, ''),
    '(\s*Reserve now & pay later[—\-]\s*book your spot and pay nothing today\.?\s*Keep your travel plans flexible\.?|\s*Reserve now & pay later:\s*Keep your travel plans flexible\s*[—\-]\s*book your spot and pay nothing today\.?)\s*',
    ' ',
    'gi'
  )),
  notes = TRIM(REGEXP_REPLACE(
    COALESCE(notes, ''),
    '(\s*Reserve now & pay later[—\-]\s*book your spot and pay nothing today\.?\s*Keep your travel plans flexible\.?|\s*Reserve now & pay later:\s*Keep your travel plans flexible\s*[—\-]\s*book your spot and pay nothing today\.?)\s*',
    ' ',
    'gi'
  ))
WHERE
  description ~* 'reserve now.*pay later|pay nothing today'
  OR notes ~* 'reserve now.*pay later|pay nothing today';

-- meta_description: remove trailing "Book now." or " Book now and " (e.g. "Book now and experience" -> "Experience")
UPDATE tours
SET meta_description = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(COALESCE(meta_description, ''), '\s*Book now\.\s*$', '', 'gi'),
  '\s*Book now and\s+', ' ', 'gi'
))
WHERE meta_description ~* 'book now';

-- 2) faqs: remove FAQ entries that are about "pay when I book" / "reserve now and pay later"
UPDATE tours
SET faqs = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(faqs, '[]'::jsonb)) AS elem
  WHERE (elem->>'question') IS NOT NULL
    AND (elem->>'question') NOT ILIKE '%pay when I book%'
    AND (elem->>'question') NOT ILIKE '%reserve now and pay later%'
)
WHERE jsonb_array_length(COALESCE(faqs, '[]'::jsonb)) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(faqs, '[]'::jsonb)) AS e
    WHERE (e->>'question') ILIKE '%pay when I book%'
       OR (e->>'question') ILIKE '%reserve now and pay later%'
  );

-- 3) Strip pay-later phrases from any FAQ answer that still contains them
UPDATE tours t
SET faqs = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'question', elem->>'question',
      'answer', COALESCE(
        NULLIF(TRIM(REGEXP_REPLACE(
          COALESCE(elem->>'answer', ''),
          '\s*Reserve now & pay later[^.]*\.?\s*Keep your travel plans flexible\.?\s*|\s*Book your spot now and pay nothing today\.?\s*',
          ' ',
          'gi'
        )), ''),
        elem->>'answer'
      )
    )
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(t.faqs, '[]'::jsonb)) AS elem
)
WHERE t.faqs::text ~* 'pay nothing today|reserve now & pay later';
