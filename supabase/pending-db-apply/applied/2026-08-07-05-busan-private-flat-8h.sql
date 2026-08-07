-- =============================================================================
-- busan-private-car-charter-cruise-shore — one flat 8-hour rate
-- =============================================================================
-- Owner instruction 2026-08-07: "기항지 프라이빗은 시간대별로가 아니고 무조건
-- 8시간 38만원으로 고정이 돼야돼, 근사한 달러치로 환산해서 가격 정하고."
--
--   ₩380,000 ÷ 1,423.48 KRW/USD (live rate, 2026-08-07) = $266.95 → **$265**
--   8+ pax = a second vehicle = $530. Same 1–7 / 8+ rule as the city charter.
--
-- Rounding rule for this whole batch, stated once so any cell can be re-derived
-- rather than argued about: convert at the live rate, round to the nearest $5.
-- Every cell lands within 2.1% of the won price the owner gave. A 9-ending
-- marketing ladder was the alternative and was rejected — the owner gave won
-- figures, so the dollar should track them, not drift for the sake of a 9.
--
-- 🔴 This is not only a repricing — it removes a contradiction the product has
-- carried since it was seeded. Every line of guest-facing copy on this page
-- already described an 8-hour day (SEO description, hero meta, the glance row,
-- "the 8-hour service time starts from your confirmed pickup time", "port call
-- too short for a full 8-hour day ashore"). Only the rate card offered 5h–9h,
-- so a guest could buy a 5-hour charter off a page that described 8 hours
-- throughout. One cell means the card, the copy and the charge agree.
--
-- `durations` is ["flat"], not ["8h"], deliberately — the same shape the Incheon
-- shore charter already sells on. `formatChargeDuration` renders "flat" as
-- "Flat rate"/"균일가" per locale, `TourRatesSheet` heads a single column
-- "Price", and the booking card hides the duration picker. An "8h" key would
-- render a duration toggle with exactly one button in it.
--
-- Since the rate card is the price (charterRateCard.ts, same day), $265 is also
-- what /api/bookings charges — `tours.price` and the default offer are moved to
-- match so no catalogue surface states a number checkout will not honour.
--
-- ALL TEN LOCALES, not the usual six. de/fr/it/ru are staged rows served as EN
-- today, and they were still holding the pre-2026-08-07 three-tier card
-- (1–6/7–9/10–13 pax, $456.99) that the content locales had already left behind.
-- Leaving them would arm a wrong rate card for the day the
-- TOUR_PRODUCT_FALLBACK_URL_LOCALES gate opens.
--
-- Repo half in the same change:
--   scripts/busan-private-flat-rate-2026-08.mjs      (6 locale bundles)
--   catalogRegistrationBuilder.ts SLUG_OVERRIDES     (listPriceUsd 169 → 265)
--
-- Reversible: git revert the bundles and restore the grid below from
-- applied/2026-08-07-02-busan-private-rate-card-price.sql's header.
-- =============================================================================

BEGIN;

UPDATE public.tours
   SET price = 265, original_price = NULL, updated_at = NOW()
 WHERE slug = 'busan-private-car-charter-cruise-shore';

UPDATE public.tour_product_offers o
   SET amount_minor = 26500, updated_at = NOW()
  FROM public.tour_product_pages p
 WHERE o.tour_product_page_id = p.id
   AND p.slug = 'busan-private-car-charter-cruise-shore';

-- Surgical on purpose: only the three price keys are rewritten. detail_payload
-- also holds course copy that other sessions have edited more recently than this
-- branch's bundles, and a whole-payload write would silently roll that back
-- (that is exactly what the 2026-08-07-02 file warned about).
UPDATE public.tour_product_pages p
   SET detail_payload =
         jsonb_set(
           jsonb_set(
             jsonb_set(p.detail_payload, '{price,salePriceUsd}', '265'::jsonb, true),
             '{price,amountLabel}', '"265"'::jsonb, true),
           '{pricingTiers}',
           '{
              "currency": "USD",
              "unit": "vehicle",
              "durations": ["flat"],
              "tiers": [
                {"paxLabel": "1–7 pax", "paxMin": 1, "paxMax": 7,  "prices": {"flat": 265}},
                {"paxLabel": "8+ pax",  "paxMin": 8, "paxMax": 14, "prices": {"flat": 530}}
              ]
            }'::jsonb,
           true),
       updated_at = NOW()
 WHERE p.slug = 'busan-private-car-charter-cruise-shore';

-- The sticky bar carries its own copy of the price on rows that have one.
UPDATE public.tour_product_pages p
   SET detail_payload =
         jsonb_set(
           jsonb_set(p.detail_payload, '{sticky_booking_bar,price,salePriceUsd}', '265'::jsonb, true),
           '{sticky_booking_bar,price,amountLabel}', '"265"'::jsonb, true),
       updated_at = NOW()
 WHERE p.slug = 'busan-private-car-charter-cruise-shore'
   AND p.detail_payload -> 'sticky_booking_bar' -> 'price' IS NOT NULL;

COMMIT;

-- Verify — every surface must state 265, and the card must have one cell
--
-- SELECT t.price,
--        p.locale,
--        p.detail_payload->'price'->>'amountLabel'                    AS card_label,
--        p.detail_payload->'pricingTiers'->'durations'                AS durations,
--        p.detail_payload->'pricingTiers'->'tiers'->0->'prices'       AS one_vehicle,
--        p.detail_payload->'pricingTiers'->'tiers'->1->'prices'       AS two_vehicles
--   FROM tours t
--   JOIN tour_product_pages p ON p.slug = t.slug
--  WHERE t.slug = 'busan-private-car-charter-cruise-shore'
--  ORDER BY p.locale;
--   -- expect 10 rows, all: 265 / ["flat"] / {"flat":265} / {"flat":530}
