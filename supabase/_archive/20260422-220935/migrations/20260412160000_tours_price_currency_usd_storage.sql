-- Store list prices in KRW (default) or USD per tour via price_currency.
-- API/booking layers convert USD rows to KRW for display & Stripe (KRW) using live FX.

BEGIN;

ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'KRW';

ALTER TABLE public.tours DROP CONSTRAINT IF EXISTS tours_price_currency_check;
ALTER TABLE public.tours ADD CONSTRAINT tours_price_currency_check
  CHECK (price_currency IN ('KRW', 'USD'));

COMMENT ON COLUMN public.tours.price IS 'List unit amount in price_currency (KRW: won, USD: US dollars).';
COMMENT ON COLUMN public.tours.original_price IS 'Pre-discount list amount in the same price_currency.';

-- East Signature: canonical list = USD 58 / person (original ~USD 72 for modest discount band).
UPDATE public.tours
SET
  price = 58,
  original_price = 72,
  price_currency = 'USD',
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core';

UPDATE public.tour_product_pages
SET
  price_amount_label = '58',
  price_currency = 'USD',
  updated_at = NOW()
WHERE slug = 'east-signature-nature-core' AND locale = 'en';

-- Offers: USD minor units = cents (Stripe-style).
UPDATE public.tour_product_offers o
SET
  amount_minor = 5800,
  currency = 'USD'
FROM public.tour_product_pages p
WHERE o.tour_product_page_id = p.id
  AND p.slug = 'east-signature-nature-core'
  AND p.locale = 'en'
  AND o.is_default = TRUE;

COMMIT;
