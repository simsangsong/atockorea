-- Busan cruise shore-excursion trio — align with channel listing prices (owner
-- instruction 2026-08-04). Repo half is already merged: static JSON x 3 slugs x 6
-- locales, both SLUG_OVERRIDES maps, regenerated catalog cards, consumer blocklist.
--
-- Prices are exact to the cent — this is the whole point of the change, so do NOT
-- round these to whole dollars:
--   busan-cruise-shore-excursion-bus-tour                  $58.79
--   busan-small-group-sightseeing-tour-cruise-passengers   $68.95   (was $84)
--   busan-private-car-charter-cruise-shore                 $456.99  (was $364, per vehicle)
--
-- amount_minor is USD cents. `tours.price` is numeric and holds cents fine.
--
-- Reversible: restore the prior price/amount_minor values and re-add
-- busan-cruise-shore-excursion-bus-tour to the 2026-06-29 hidden set.
--
-- Pre-check:
--   select slug, price, is_active, is_published from tours
--    where slug in ('busan-cruise-shore-excursion-bus-tour',
--                   'busan-small-group-sightseeing-tour-cruise-passengers',
--                   'busan-private-car-charter-cruise-shore');
--   -- expect 49 / 84 / 364, and the bus tour is_active=false

begin;

-- 1. List/card price. No strike-through: the listing's "30% off" is a channel promo
--    badge, not a price we hold, so original_price stays null rather than inventing one.
with newp(slug, sale) as (values
 ('busan-cruise-shore-excursion-bus-tour', 58.79),
 ('busan-small-group-sightseeing-tour-cruise-passengers', 68.95),
 ('busan-private-car-charter-cruise-shore', 456.99)
)
update tours t
set price = n.sale, original_price = null, updated_at = now()
from newp n where t.slug = n.slug;

-- 2. Checkout charge (USD cents).
with newp(slug, minor) as (values
 ('busan-cruise-shore-excursion-bus-tour', 5879),
 ('busan-small-group-sightseeing-tour-cruise-passengers', 6895),
 ('busan-private-car-charter-cruise-shore', 45699)
)
update tour_product_offers o
set amount_minor = n.minor, updated_at = now()
from tour_product_pages p, newp n
where o.tour_product_page_id = p.id and p.slug = n.slug;

-- 3. Detail page price, all locales. amountLabel keeps the cents ('58.79'), and any
--    leftover discount keys are dropped so no phantom strike-through renders.
with newp(slug, sale) as (values
 ('busan-cruise-shore-excursion-bus-tour', 58.79),
 ('busan-small-group-sightseeing-tour-cruise-passengers', 68.95),
 ('busan-private-car-charter-cruise-shore', 456.99)
)
update tour_product_pages p
set detail_payload =
  jsonb_set(
    jsonb_set(
      (p.detail_payload
        #- '{price,originalPriceUsd}'
        #- '{price,discountPercent}'),
      '{price,salePriceUsd}', to_jsonb(n.sale), true),
    '{price,amountLabel}', to_jsonb(n.sale::text), true)
from newp n
where p.slug = n.slug;

-- 3b. Sticky booking bar — only where it is an object (the bus tour has none).
with newp(slug, sale) as (values
 ('busan-cruise-shore-excursion-bus-tour', 58.79),
 ('busan-small-group-sightseeing-tour-cruise-passengers', 68.95),
 ('busan-private-car-charter-cruise-shore', 456.99)
)
update tour_product_pages p
set detail_payload =
  jsonb_set(
    jsonb_set(
      (p.detail_payload
        #- '{sticky_booking_bar,price,originalPriceUsd}'
        #- '{sticky_booking_bar,price,discountPercent}'),
      '{sticky_booking_bar,price,salePriceUsd}', to_jsonb(n.sale), true),
    '{sticky_booking_bar,price,amountLabel}', to_jsonb(n.sale::text), true)
from newp n
where p.slug = n.slug
  and jsonb_typeof(p.detail_payload -> 'sticky_booking_bar') = 'object';

-- 4. Clear the hardcoded English price sentence so the card formats listPriceUsd
--    itself (currency-switcher aware).
update tour_product_pages p
set detail_payload = jsonb_set(p.detail_payload, '{catalog_card,priceLabel}', '""'::jsonb, true)
where p.slug in ('busan-cruise-shore-excursion-bus-tour',
                 'busan-small-group-sightseeing-tour-cruise-passengers',
                 'busan-private-car-charter-cruise-shore');

-- 5. Re-open the join-in tier. It was switched off by the 2026-06-29 Klook 12-SKU
--    narrowing; all three tiers have to be sellable for the listing to be matched.
update tours set is_active = true, updated_at = now()
where slug = 'busan-cruise-shore-excursion-bus-tour';

update tour_product_pages set is_published = true, updated_at = now()
where slug = 'busan-cruise-shore-excursion-bus-tour';

commit;

-- Post-check:
--   select slug, price, original_price, is_active from tours
--    where slug like 'busan-%cruise%' or slug = 'busan-private-car-charter-cruise-shore';
--   -- expect 58.79 / 68.95 / 456.99, original_price null, all is_active
--
--   select p.slug, o.amount_minor from tour_product_offers o
--     join tour_product_pages p on p.id = o.tour_product_page_id
--    where p.slug in ('busan-cruise-shore-excursion-bus-tour',
--                     'busan-small-group-sightseeing-tour-cruise-passengers',
--                     'busan-private-car-charter-cruise-shore');
--   -- expect 5879 / 6895 / 45699
--
-- Then resync the recommender for the re-opened slug:
--   node scripts/import-match-v18.mjs --single busan-cruise-shore-excursion-bus-tour
