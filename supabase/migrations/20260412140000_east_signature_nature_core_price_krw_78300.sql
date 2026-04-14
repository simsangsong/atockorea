-- East Signature Nature Core — list price in KRW (USD on site = KRW ÷ live rate from /api/currency/rate).
-- Sticky bar + checkout context read public.tours.price (KRW); tour_product_* rows kept in sync.

BEGIN;

UPDATE public.tours
SET
  price = 78300,
  original_price = 95000,
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core';

UPDATE public.tour_product_pages
SET
  price_amount_label = '78,300',
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core' AND locale = 'en';

UPDATE public.tour_product_offers o
SET amount_minor = 78300
FROM public.tour_product_pages p
WHERE o.tour_product_page_id = p.id
  AND p.slug = 'east-signature-nature-core'
  AND p.locale = 'en'
  AND o.is_default = TRUE;

COMMIT;
