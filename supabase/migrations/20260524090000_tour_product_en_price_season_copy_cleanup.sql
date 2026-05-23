-- Fix remaining EN tour-product price and copy issues found in the 2026-05-24 audit.
-- Uses slugs and locale filters only; no generated IDs are hardcoded.

UPDATE public.tours
SET
  price = 52,
  original_price = 58,
  price_currency = 'USD',
  currency = 'USD',
  updated_at = now()
WHERE slug IN (
  'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju',
  'busan-spring-cherry-blossom-gyeongju-highlights-day-tour'
);

UPDATE public.tour_product_offers AS o
SET
  amount_minor = 5200,
  currency = 'USD',
  updated_at = now()
FROM public.tour_product_pages AS p
JOIN public.tours AS t ON t.id = p.tour_id
WHERE o.tour_product_page_id = p.id
  AND o.is_default = TRUE
  AND p.locale = 'en'
  AND t.slug IN (
    'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju',
    'busan-spring-cherry-blossom-gyeongju-highlights-day-tour'
  );

UPDATE public.tour_product_pages AS p
SET detail_payload = replace(
  replace(
    replace(
      detail_payload::text,
      '"priceLabel": ""',
      '"priceLabel": "From US$52 per person (was $58, 10% off)"'
    ),
    '"amountLabel": ""',
    '"amountLabel": "52"'
  ),
  'Small-group price not yet confirmed from operator listing. Comparable Gyeongju-from-Busan tours range $54–90 across packages and operators. Once confirmed, AtoC Korea sale price applies a flat 10% discount.',
  'Seasonal Gyeongju-from-Busan day tours currently list around US$56-58 on GetYourGuide. AtoC Korea sale price applies a flat 10% discount.'
)::jsonb
FROM public.tours AS t
WHERE t.id = p.tour_id
  AND p.locale = 'en'
  AND t.slug IN (
    'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju',
    'busan-spring-cherry-blossom-gyeongju-highlights-day-tour'
  );

UPDATE public.tour_product_pages
SET detail_payload = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            detail_payload::text,
                            'A easy-to-follow',
                            'An easy-to-follow'
                          ),
                          'route route option',
                          'route option'
                        ),
                        'schedule schedule limit',
                        'schedule limit'
                      ),
                      'small-group group dynamics',
                      'small-group dynamics'
                    ),
                    '1100 Road road-closure note',
                    '1100 Road closure note'
                  ),
                  'Visit Korea Korea Foundation',
                  'Visit Korea Foundation'
                ),
                'the our year-round Eastern UNESCO tour tour',
                'our year-round Eastern UNESCO tour'
              ),
              'similar local route, same vehicle class',
              'same port-routing concept, same vehicle class'
            ),
            'similar local route, small-group mini-coach format',
            'same port-routing concept, small-group mini-coach format'
          ),
          'similar local route. The Southern tour covers',
          'The Southern tour covers'
        ),
        'The similar local route runs a private version of the hydrangea tour with hotel pickup anywhere on Jeju and customizable timing.',
        'A private version of this hydrangea tour is available with hotel pickup anywhere on Jeju and customizable timing.'
      ),
      'Eastern UNESCO tour (similar local route)',
      'Eastern UNESCO tour'
    ),
    'similar local route as the Southern UNESCO tour but with',
    'similar west/south region as the Southern UNESCO tour, but with'
  ),
  'No passport, no DMZ entry, no refund.',
  'Without a valid passport, guests will be denied entry to the DMZ portion and the tour cannot be refunded.'
)::jsonb
WHERE locale = 'en'
  AND (
    detail_payload::text ILIKE '%A easy-to-follow%'
    OR detail_payload::text ILIKE '%route route%'
    OR detail_payload::text ILIKE '%schedule schedule%'
    OR detail_payload::text ILIKE '%small-group group%'
    OR detail_payload::text ILIKE '%1100 Road road%'
    OR detail_payload::text ILIKE '%Visit Korea Korea%'
    OR detail_payload::text ILIKE '%the our%'
    OR detail_payload::text ILIKE '%tour tour%'
    OR detail_payload::text ILIKE '%similar local route%'
    OR detail_payload::text ILIKE '%No passport, no DMZ entry, no refund%'
  );
