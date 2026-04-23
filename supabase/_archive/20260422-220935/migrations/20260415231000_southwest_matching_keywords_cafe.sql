-- Optional keyword alignment for keyword channel (match seed-profiles) — cafe/tea coast focus.
UPDATE public.tour_matching_profiles
SET
  keywords = COALESCE(keywords, '[]'::jsonb) || '["cafe","coffee","cafe tour","tea cafe","aewol cafe"]'::jsonb,
  synonym_hints = COALESCE(synonym_hints, '[]'::jsonb) || '["cafe day","tea and cafe"]'::jsonb
WHERE product_id = 'southwest-hallasan-osulloc-aewol';
