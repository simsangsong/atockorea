-- Reprice the two Seoraksan day tours from the operator's own Klook listings
-- Owner screenshots, 2026-08-07. Rate measured the same day: 1 USD = 1,429 KRW.
--
--   Naksansa + Naksan Beach     ₩80,000  → $55.98 → $56   (was $53)
--   Nami Island + Morning Calm  ₩113,000 → $79.08 → $79   (was $71)
--   Winter Eobi ice valley      ₩99,000  → $69.28 → $69   (already $69, untouched)
--
-- compareAtPriceUsd on Naksansa is scaled to preserve the discount the owner
-- had already set (58/53 = 8.6% off → 61/56 = 8.2% off) rather than invented at
-- a new level. Morning Calm never had one and still does not. Klook itself
-- shows a single price with no strike-through on all three.
--
-- Sokcho (seoul-seoraksan-national-park-sokcho-beach-day-trip) is deliberately
-- NOT repriced: there is no Klook screenshot for it and no live listing — it is
-- the SKU that Naksansa replaced. Left at $49 pending an owner decision.
--
-- 🔴 The product page's big price number comes from tour_product_offers, not
-- from detail_payload.price — `loadTourProductPage.ts` builds `amountLabel`
-- from the default active offer and only reads originalPriceUsd /
-- salePriceUsd / discountPercent out of the payload. Updating one without the
-- other shows the new price with the old discount badge, or vice versa.
--
-- 🔴 Also fixes a live mispricing that predates this change. The five non-EN
-- catalog_card.priceLabel values disagreed with EN:
--     Naksansa      EN $53  vs  es/ja/ko/zh/zh-TW "$52 (was $58, 10% off)"
--     Morning Calm  EN $71  vs  es/ja/ko/zh/zh-TW "$59 (was $82, 28% off)"
-- A Korean or Japanese guest was being quoted $59 for a $71 tour. Cleared to ''
-- rather than re-translated, so the card falls back to listPriceUsd, which is
-- parsed from the EN page only — one number can no longer drift into five
-- languages. Matches the static JSON in the same change.

begin;

-- 1) Catalogue row (drives /tours/list + /api/tours).
update tours set price = 56, original_price = 61, updated_at = now()
 where slug = 'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip';

update tours set price = 79, updated_at = now()
 where slug = 'seoul-seoraksan-nami-island-morning-calm-day-tour';

-- 2) Offer = what checkout charges AND what the page prints.
update tour_product_offers o set amount_minor = 5600, updated_at = now()
  from tour_product_pages p
 where o.tour_product_page_id = p.id
   and p.slug = 'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip';

update tour_product_offers o set amount_minor = 7900, updated_at = now()
  from tour_product_pages p
 where o.tour_product_page_id = p.id
   and p.slug = 'seoul-seoraksan-nami-island-morning-calm-day-tour';

-- 3) Payload price block = the "was $X, N% off" badge. EN only; the other five
--    locales carry an empty price block by design and derive from EN.
update tour_product_pages
   set detail_payload = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(detail_payload, '{price,amountLabel}', '"56"'::jsonb, true),
             '{price,salePriceUsd}', '56'::jsonb, true),
           '{price,originalPriceUsd}', '61'::jsonb, true),
         '{price,discountPercent}', '8'::jsonb, true),
       price_amount_label = '56',
       updated_at = now()
 where slug = 'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip'
   and locale = 'en';

update tour_product_pages
   set detail_payload = jsonb_set(
         jsonb_set(detail_payload, '{price,amountLabel}', '"79"'::jsonb, true),
         '{price,salePriceUsd}', '79'::jsonb, true),
       price_amount_label = '79',
       updated_at = now()
 where slug = 'seoul-seoraksan-nami-island-morning-calm-day-tour'
   and locale = 'en';

-- 4) Card labels, kept in step with the static JSON so a later re-import does
--    not flip them back. EN gets the new sentence; the five stale non-EN ones
--    are emptied.
update tour_product_pages
   set detail_payload = jsonb_set(detail_payload, '{catalog_card,priceLabel}',
                                  '"From US$56 per person (was $61, 8% off)"'::jsonb, true),
       updated_at = now()
 where slug = 'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip' and locale = 'en'
   and detail_payload ? 'catalog_card';

update tour_product_pages
   set detail_payload = jsonb_set(detail_payload, '{catalog_card,priceLabel}',
                                  '"US$79 per person"'::jsonb, true),
       updated_at = now()
 where slug = 'seoul-seoraksan-nami-island-morning-calm-day-tour' and locale = 'en'
   and detail_payload ? 'catalog_card';

update tour_product_pages
   set detail_payload = jsonb_set(detail_payload, '{catalog_card,priceLabel}', '""'::jsonb, true),
       updated_at = now()
 where slug in ('seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
                'seoul-seoraksan-nami-island-morning-calm-day-tour')
   and locale <> 'en'
   and detail_payload ? 'catalog_card';

commit;

-- ── Follow-up, same day: a guest-facing FAQ was still quoting the old price ──
--
-- 🔴 Found by a real render, not by reading the diff. After every price surface
-- in the runbook was updated, the Morning Calm page still printed "$59" —
-- `staticQuestions[13].answer`, the FAQ contrasting this coach tour's price
-- point with the private-charter option, in en / es / ko. The runbook's list of
-- price surfaces does not include body copy, and nothing greps for it.
--
-- Not touched: `matching_metadata.audit_summary`, which mentions an $82
-- GetYourGuide competitor. That one is internal recommender/audit metadata and
-- was confirmed absent from the rendered page.

update tour_product_pages
   set detail_payload = jsonb_set(
         detail_payload,
         '{staticQuestions,13,answer}',
         to_jsonb(replace(replace(replace(
           detail_payload->'staticQuestions'->13->>'answer',
           '($59/person)', '($79/person)'),
           '($59 por persona)', '($79 por persona)'),
           '($59/인)', '($79/인)')),
         false),
       updated_at = now()
 where slug = 'seoul-seoraksan-nami-island-morning-calm-day-tour'
   and detail_payload->'staticQuestions'->13->>'answer' like '%$59%';
