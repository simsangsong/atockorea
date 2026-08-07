-- =============================================================================
-- Retire the Gapyeong join-in day tour — owner instruction, 2026-08-07
-- =============================================================================
-- The owner sent the operator's package-type selector, which lists exactly three
-- Seoul→Gangwon/Gyeonggi coach packages:
--
--   [Winter Special: Dec/20~Feb/28] Mt.Seorak + Nami Island + Eobi Ice Valley
--   Mt.Seoraksan + Nami island + Morning Calm Garden
--   Mt.Seoraksan + Naksansa Temple + Beach
--
-- "keep these three, drop the one in the second screenshot" — the second
-- screenshot being the $59 / 11.5-hour "Seoul Day Tour · Nami, Morning Calm &
-- Petite France" page, i.e. `seoul-gapyeong-nami-morning-calm-petite-france-day-tour`.
--
-- It overlaps the second package above (same Nami Island, same Garden of Morning
-- Calm) at a different price, which is what made two live SKUs quote two numbers
-- for one day out.
--
-- 🔴 This is only the DB half. The repo half — adding the same slug to
-- CONSUMER_BLOCKED_TOUR_SLUGS in lib/tour-consumer-visibility.ts — ships in the
-- same change, and both are needed. Measured on this catalogue before (see that
-- file's header): `is_active = false` alone stops the sale but leaves the card
-- on /tours/list and the detail page rendering; the blocklist is what removes it
-- from view. Half of this is worse than neither.
--
-- Deliberately NOT touched:
--   * price / content / bundles / registry entry — retiring, not deleting. The
--     ten locale rows keep their payload so re-opening is one repo line plus
--     flipping these flags back.
--   * match_tours — the row (1) is left in place, exactly as the 2026-08-07
--     re-open batch left the six it restored. The table carries no active flag,
--     and the matcher already filters through the consumer blocklist, so
--     deleting the row would only make a re-open need a re-import.
--
-- Sibling that is NOT affected: `seoul-private-nami-morning-calm-petite-france`
-- ($194/person, private). Same three places, different product.
-- =============================================================================

BEGIN;

-- 1) Off sale.
UPDATE public.tours
   SET is_active = false,
       updated_at = NOW()
 WHERE slug = 'seoul-gapyeong-nami-morning-calm-petite-france-day-tour';

-- 2) Unpublish every locale row. Ten here, not six: this product was seeded with
--    the de/fr/it/ru staged rows as well, and leaving those published would keep
--    a row live for the day the TOUR_PRODUCT_FALLBACK_URL_LOCALES gate opens.
UPDATE public.tour_product_pages
   SET is_published = false,
       updated_at = NOW()
 WHERE slug = 'seoul-gapyeong-nami-morning-calm-petite-france-day-tour';

COMMIT;

-- Verify — expect is_active = f, published = 0, rows = 10
--
-- SELECT t.slug, t.is_active,
--        (SELECT count(*) FROM tour_product_pages p WHERE p.slug = t.slug) AS rows,
--        (SELECT count(*) FROM tour_product_pages p WHERE p.slug = t.slug AND p.is_published) AS published
--   FROM tours t
--  WHERE t.slug = 'seoul-gapyeong-nami-morning-calm-petite-france-day-tour';
