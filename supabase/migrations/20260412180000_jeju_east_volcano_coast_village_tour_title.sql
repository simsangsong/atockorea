-- EN marketing title for east-signature-nature-core (tours + tour_product_pages).

BEGIN;

UPDATE public.tours
SET
  title = 'Jeju East Volcano, Coast & Village Small Group Tour',
  seo_title = 'Jeju East Volcano, Coast & Village Small Group Tour | AtoCKorea',
  translations = jsonb_set(
    COALESCE(translations, '{}'::jsonb),
    '{en,title}',
    to_jsonb('Jeju East Volcano, Coast & Village Small Group Tour'::text),
    true
  ),
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core';

UPDATE public.tour_product_pages
SET
  title = 'Jeju East Volcano, Coast & Village Small Group Tour',
  seo_title = 'Jeju East Volcano, Coast & Village Small Group Tour | AtoC Korea',
  headline_line_1 = 'Jeju East Volcano, Coast & Village',
  headline_line_2 = 'Small Group Tour',
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core' AND locale = 'en';

COMMIT;
