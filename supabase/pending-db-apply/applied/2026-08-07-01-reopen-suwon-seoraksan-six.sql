-- Re-open six Seoul-region day tours — owner instruction, 2026-08-07
--
-- The Suwon three and the Seoraksan/Gangwon three were hidden on 2026-06-29 by
-- the Klook 12-SKU narrowing, not by any problem with the products themselves.
-- The owner asked for them back on sale.
--
-- 🔴 This is only the DB half. The repo half — removing the same six slugs from
-- CONSUMER_BLOCKED_TOUR_SLUGS in lib/tour-consumer-visibility.ts — ships in the
-- same change. Measured previously (see that file's header): is_active alone
-- does NOT restore the product. The blocklist is what 404s the detail page and
-- drops the card from /tours/list, so flipping only these flags leaves the
-- product unsellable AND invisible, and flipping only the blocklist puts a
-- visible card on an inactive product. Both halves or neither.
--
-- Deliberately NOT touched:
--   * price / compare-at — re-opened at the prices they were paused at. Any
--     repricing is a separate owner decision, same posture as Gyeongju's 2026-08-04
--     re-open, which was flagged rather than assumed.
--   * match_tours — verified 2026-08-07 that all six still have their row (1 each)
--     and the table carries no active/published column, so the matcher needs no
--     resync here. This differs from the 2026-06-24 batch, where the rows had
--     been deleted; checked rather than inherited from that note.
--
-- Departure schedules: the three Suwon packages rotate one vehicle across the
-- week (Klook calendars, owner screenshots 2026-08-04). That lives in
-- lib/tour-departure-days.ts AND in each bundle's `departureWeekdays`, both
-- shipped with this change — the table rejects a bad date at submit, the bundle
-- greys it in the picker. The Seoraksan three are daily on-demand, like the rest
-- of the catalog.

begin;

-- 1) Put them back on sale.
update tours
   set is_active = true,
       updated_at = now()
 where slug in (
   'seoul-suwon-hwaseong-folk-village-starfield-library',
   'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
   'seoul-suwon-hwaseong-waujeongsa-starfield',
   'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
   'seoul-seoraksan-nami-island-morning-calm-day-tour',
   'seoul-seoraksan-national-park-sokcho-beach-day-trip'
 );

-- 2) Publish the locale pages. Six rows each (en, es, ja, ko, zh, zh-TW);
--    de/fr/it/ru are staged separately and stay unpublished until the
--    TOUR_PRODUCT_FALLBACK_URL_LOCALES gate opens, which is a human decision.
update tour_product_pages
   set is_published = true,
       updated_at = now()
 where slug in (
   'seoul-suwon-hwaseong-folk-village-starfield-library',
   'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
   'seoul-suwon-hwaseong-waujeongsa-starfield',
   'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
   'seoul-seoraksan-nami-island-morning-calm-day-tour',
   'seoul-seoraksan-national-park-sokcho-beach-day-trip'
 )
   and locale in ('en', 'es', 'ja', 'ko', 'zh', 'zh-TW');

commit;

-- Verification (expect: 6 rows, is_active=t, published=6 each)
--
-- select t.slug, t.is_active,
--        (select count(*) from tour_product_pages p
--          where p.slug = t.slug and p.is_published) as published
--   from tours t
--  where t.slug in (
--    'seoul-suwon-hwaseong-folk-village-starfield-library',
--    'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
--    'seoul-suwon-hwaseong-waujeongsa-starfield',
--    'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
--    'seoul-seoraksan-nami-island-morning-calm-day-tour',
--    'seoul-seoraksan-national-park-sokcho-beach-day-trip')
--  order by t.slug;
