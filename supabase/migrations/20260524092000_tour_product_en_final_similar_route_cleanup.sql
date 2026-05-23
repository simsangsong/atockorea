-- Final EN-only cleanup for one remaining customer-visible "similar local route" FAQ opener.

UPDATE public.tour_product_pages
SET detail_payload = replace(
  detail_payload::text,
  'similar local route. The Southern UNESCO tour is more heritage-focused',
  'The Southern UNESCO tour is more heritage-focused'
)::jsonb
WHERE locale = 'en'
  AND detail_payload::text ILIKE '%similar local route%';
