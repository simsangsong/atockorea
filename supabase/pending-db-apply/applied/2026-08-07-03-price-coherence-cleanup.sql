-- Price coherence cleanup — 2026-08-07
--
-- Two findings from sweeping every is_active product's price across all its
-- surfaces. Neither is the headline defect (that one was
-- `jeju-grand-highlights-loop` quoting $93 on the card against $80 at
-- checkout, fixed in the repo half), but both are live inconsistencies.

-- ── 1) tours.original_price was NULL while the product page showed a discount ─
--
-- Four products render "was $X, N% off" from detail_payload.price, and their
-- catalogue cards render a strike-through from SLUG_OVERRIDES.compareAtPriceUsd,
-- but `tours.original_price` was never filled. That column is not decorative:
-- `app/(marketing)/cart/page.tsx`, `app/(marketing)/mypage/wishlist/page.tsx`
-- and `app/(marketing)/tour/[id]/layout.tsx` all read it, so the same product
-- showed a discount on the card and the detail page and none in the cart.
--
-- Values are taken from detail_payload.price.originalPriceUsd, which already
-- agreed with SLUG_OVERRIDES for all four — this fills a gap, it does not pick
-- a new number.

update tours t
   set original_price = (
         select (p.detail_payload->'price'->>'originalPriceUsd')::numeric
           from tour_product_pages p
          where p.slug = t.slug and p.locale = 'en'
       ),
       updated_at = now()
 where t.original_price is null
   and exists (
         select 1 from tour_product_pages p
          where p.slug = t.slug and p.locale = 'en'
            and (p.detail_payload->'price'->>'originalPriceUsd') is not null
       );

-- ── 2) detail_payload.catalog_card.priceLabel was stale on live products ─────
--
-- 🔴 Measured first, because it changes what this is: NOTHING renders the DB
-- copy of `catalog_card`. The catalogue cards are generated at build time from
-- the static bundles (`scripts/build-catalog-cards.mjs`), and the only renderer
-- of `priceLabel` is `app/(marketing)/match/page.tsx`, which reads the built
-- registration. So these rows are dead data, not a live mispricing.
--
-- They are still worth clearing. The bundles hold '' for all four, so the DB
-- disagrees with its own authoring source; the numbers are wrong by today's
-- prices (busan-top-attractions carries "$29" in TEN locales against a $34
-- tour); one of them advertises "4hr", a charter tier the owner abolished; and
-- the i18n pipeline has been translating this dead field into de/fr/it/ru. If
-- anyone ever wires the DB copy up, four products ship a wrong price on day one.
--
-- Set to '' to match the bundles rather than to a corrected sentence: the
-- bundle is the authoring source, and a re-import must not flip them back.

update tour_product_pages
   set detail_payload = jsonb_set(detail_payload, '{catalog_card,priceLabel}', '""'::jsonb, false),
       updated_at = now()
 where slug in (
         'busan-top-attractions-day-tour',
         'incheon-seoul-private-car-shore-excursion-cruise',
         'seoul-private-nami-morning-calm-petite-france',
         'seoul-suburbs-private-chartered-car-10hr'
       )
   and detail_payload ? 'catalog_card'
   and coalesce(detail_payload->'catalog_card'->>'priceLabel', '') <> '';

-- Verification
--
-- select t.slug, t.price, t.original_price,
--        (select count(*) from tour_product_pages p
--          where p.slug = t.slug
--            and coalesce(p.detail_payload->'catalog_card'->>'priceLabel','') <> '') as labelled
--   from tours t where t.is_active order by t.slug;
