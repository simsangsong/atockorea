-- =============================================================================
-- busan-private-car-charter-cruise-shore — the rate card becomes the price
-- =============================================================================
-- Applied 2026-08-07. Owner decision the same day: the duration x party-size
-- rate card (`detail_payload.pricingTiers`) is what this charter is sold on.
--
-- 🔴 WHAT WAS WRONG. The product quoted three different numbers at once:
--   * product page  — the rate card, $169 (5h, 1–6 pax) through $378
--   * catalogue card — $456.99, from `tours.price`
--   * the booking    — $456.99, because buildBookingPayload sent `tours.price`
--                      and /api/bookings recomputed the same figure and rejected
--                      anything else. The card's own code called tier pricing
--                      "authoritative", but nothing ever charged from it.
-- A guest shown US$169 for a 5-hour charter was booked at US$456.99.
--
-- The repo half of the fix (this is the DB half):
--   lib/tour-product/charterRateCard.ts   — one resolver, used by page + server
--   app/api/bookings/route.ts             — resolves the cell the guest picked
--   bookingShared.tsx / both booking surfaces — send that cell and its duration
--   both SLUG_OVERRIDES maps              — list price = cheapest cell
--   __tests__/audit/charterRateCardCharged.test.ts — keeps the wiring attached
--
-- `tours.price` is now the cheapest cell, so every catalogue surface states a
-- number the page and the checkout will both honour; checkout no longer reads it
-- for this product except as a fallback when no card is present.
--
-- ⚠ SURGICAL ON PURPOSE. `detail_payload` is NOT rewritten wholesale here — the
-- rate card itself and the course copy were updated by other sessions more
-- recently than this branch's bundles, and a full-payload write would have
-- reinstated a 4-hour charter that was deliberately withdrawn (main 9557c8a4).
-- Only the two price keys are touched.
--
-- Reversible: set price/amount_minor/salePriceUsd back to 456.99 / 45699.
-- =============================================================================

BEGIN;

UPDATE public.tours
SET price = 169, original_price = NULL, updated_at = NOW()
WHERE slug = 'busan-private-car-charter-cruise-shore';

UPDATE public.tour_product_offers o
SET amount_minor = 16900, updated_at = NOW()
FROM public.tour_product_pages p
WHERE o.tour_product_page_id = p.id
  AND p.slug = 'busan-private-car-charter-cruise-shore';

-- Content locales only. de/fr/it/ru are staged rows served as EN via
-- TOUR_PRODUCT_FALLBACK_URL_LOCALES; their payload is never rendered.
UPDATE public.tour_product_pages p
SET detail_payload =
      jsonb_set(
        jsonb_set(p.detail_payload, '{price,salePriceUsd}', '169'::jsonb, true),
        '{price,amountLabel}', '"169"'::jsonb, true),
    updated_at = NOW()
WHERE p.slug = 'busan-private-car-charter-cruise-shore'
  AND p.locale IN ('en','ko','ja','zh','zh-TW','es');

COMMIT;

-- Verify — all three surfaces must state the cheapest cell on the card:
--   SELECT t.slug, t.price, t.price_type,
--          p.detail_payload->'price'->>'amountLabel'      AS card_label,
--          p.detail_payload->'pricingTiers'->'durations'  AS durations,
--          p.detail_payload->'pricingTiers'->'tiers'->0->'prices' AS tier1
--     FROM tours t
--     JOIN tour_product_pages p ON p.slug = t.slug AND p.locale = 'en'
--    WHERE t.slug = 'busan-private-car-charter-cruise-shore';
--   -- expect price 169, card_label 169, tier1 5h = 169
