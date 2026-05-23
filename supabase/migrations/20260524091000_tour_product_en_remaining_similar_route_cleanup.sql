-- Remove two remaining EN-only "similar local route" phrases from live product payloads.

UPDATE public.tour_product_pages
SET detail_payload = replace(
  replace(
    replace(
      detail_payload::text,
      'Southern UNESCO sister product, similar local route, $43/pax small-group rate as ceiling reference.',
      'Southern UNESCO sister product; comparable local operator route; $43/pax small-group rate as ceiling reference.'
    ),
    'similar local route, same no-shopping policy',
    'Same local operator, same no-shopping policy'
  ),
  'This tour is run by the similar local route as our Southern UNESCO tour',
  'This tour is run by the same local operator as our Southern UNESCO tour'
)::jsonb
WHERE locale = 'en'
  AND detail_payload::text ILIKE '%similar local route%';
