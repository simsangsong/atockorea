-- Klook onboarding prep — +$5 sale price + discount REMOVE for the 12 active SKUs.
--
-- Display sale price +$5; discount policy = REMOVE (strikethrough + "% OFF" badge
-- gone, list price only). Surfaces: tours.price/original_price, tour_product_offers
-- (checkout charge), tour_product_pages.detail_payload (price + sticky_booking_bar.price,
-- all 6 locales). Repo half: static JSON x6, SLUG_OVERRIDES, regenerated catalog cards.
--
-- amount_minor is USD cents. Applied to AtoC Supabase (cghyvbwmijqpahnoduyv) via MCP
-- on 2026-06-29. Reversible: restore prior price/original_price/compareAt + re-add
-- originalPriceUsd/discountPercent to detail_payload.

-- 1. List/card price + clear compare-at (no strikethrough on list cards).
with newp(slug, sale) as (values
 ('pocheon-sanjeong-lake-herb-island-art-valley',54),
 ('jeju-grand-highlights-loop',93),
 ('jeju-cruise-shore-excursion-small-group-tour',77),
 ('jeju-hydrangea-festival-tour-southwest-route',64),
 ('jeju-hydrangea-festival-tour-east-route',64),
 ('busan-small-group-sightseeing-tour-cruise-passengers',84),
 ('seoul-suburbs-private-chartered-car-10hr',184),
 ('seoul-private-nami-morning-calm-petite-france',194),
 ('jeju-island-private-car-charter-tour',254),
 ('incheon-seoul-private-car-shore-excursion-cruise',424),
 ('busan-private-car-charter-cruise-shore',364),
 ('busan-top-attractions-day-tour',34)
)
update tours t
set price = n.sale, original_price = null, updated_at = now()
from newp n where t.slug = n.slug;

-- 2. Checkout charge (USD cents).
with newp(slug, minor) as (values
 ('pocheon-sanjeong-lake-herb-island-art-valley',5400),
 ('jeju-grand-highlights-loop',9300),
 ('jeju-cruise-shore-excursion-small-group-tour',7700),
 ('jeju-hydrangea-festival-tour-southwest-route',6400),
 ('jeju-hydrangea-festival-tour-east-route',6400),
 ('busan-small-group-sightseeing-tour-cruise-passengers',8400),
 ('seoul-suburbs-private-chartered-car-10hr',18400),
 ('seoul-private-nami-morning-calm-petite-france',19400),
 ('jeju-island-private-car-charter-tour',25400),
 ('incheon-seoul-private-car-shore-excursion-cruise',42400),
 ('busan-private-car-charter-cruise-shore',36400),
 ('busan-top-attractions-day-tour',3400)
)
update tour_product_offers o
set amount_minor = n.minor, updated_at = now()
from tour_product_pages p, newp n
where o.tour_product_page_id = p.id and p.slug = n.slug;

-- 3. Detail page price (all 6 locales): bump sale, drop originalPriceUsd + discountPercent
--    on both price and sticky_booking_bar.price so no strikethrough / "% OFF" badge renders.
with newp(slug, sale) as (values
 ('pocheon-sanjeong-lake-herb-island-art-valley',54),
 ('jeju-grand-highlights-loop',93),
 ('jeju-cruise-shore-excursion-small-group-tour',77),
 ('jeju-hydrangea-festival-tour-southwest-route',64),
 ('jeju-hydrangea-festival-tour-east-route',64),
 ('busan-small-group-sightseeing-tour-cruise-passengers',84),
 ('seoul-suburbs-private-chartered-car-10hr',184),
 ('seoul-private-nami-morning-calm-petite-france',194),
 ('jeju-island-private-car-charter-tour',254),
 ('incheon-seoul-private-car-shore-excursion-cruise',424),
 ('busan-private-car-charter-cruise-shore',364),
 ('busan-top-attractions-day-tour',34)
)
update tour_product_pages p
set detail_payload =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          (p.detail_payload
            #- '{price,originalPriceUsd}'
            #- '{price,discountPercent}'
            #- '{sticky_booking_bar,price,originalPriceUsd}'
            #- '{sticky_booking_bar,price,discountPercent}'),
          '{price,salePriceUsd}', to_jsonb(n.sale), true),
        '{price,amountLabel}', to_jsonb(n.sale::text), true),
      '{sticky_booking_bar,price,salePriceUsd}', to_jsonb(n.sale), true),
    '{sticky_booking_bar,price,amountLabel}', to_jsonb(n.sale::text), true)
from newp n
where p.slug = n.slug;
