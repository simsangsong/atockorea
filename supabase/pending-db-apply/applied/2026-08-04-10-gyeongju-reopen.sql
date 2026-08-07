-- =============================================================================
-- Gyeongju re-open — the DB half (owner decision 2026-08-04)
-- =============================================================================
-- File 07 re-coursed `from-busan-gyeongju-ancient-capital-day-tour` but
-- deliberately excluded is_active / is_published: it changed WHAT THE PRODUCT
-- SAYS without putting it on sale, because re-opening was the owner's call.
-- The owner has now made it. This is that second half.
--
-- Re-opening is TWO halves and both are required:
--   1) repo — remove the slug from CONSUMER_BLOCKED_TOUR_SLUGS in
--      lib/tour-consumer-visibility.ts (the app filters it out before the DB is
--      ever consulted, so flipping these flags alone changes nothing a guest sees)
--   2) this file — tours.is_active + the six tour_product_pages.is_published
--
-- 🔴 Price is UNCHANGED at USD 39 (compare-at 50). That price was set when the
--    tour was 10.5 hours; the re-course made it 11.5 hours, last drop ≈19:50.
--    Repricing was not part of the re-open instruction, so it is flagged rather
--    than assumed. Changing it later means tours.price + the offer row +
--    detail_payload.price in 6 locales + the bundle + SLUG_OVERRIDES.
--
-- Idempotent: re-running sets the same flags. Verification SELECTs at the end.
-- =============================================================================

BEGIN;

UPDATE public.tours
   SET is_active = true,
       updated_at = NOW()
 WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour'
   AND is_active IS DISTINCT FROM true;

UPDATE public.tour_product_pages
   SET is_published = true,
       updated_at = NOW()
 WHERE slug = 'from-busan-gyeongju-ancient-capital-day-tour'
   AND locale IN ('en', 'ko', 'ja', 'zh', 'zh-TW', 'es')
   AND is_published IS DISTINCT FROM true;

COMMIT;

-- Verify — expect is_active = true and 6 published locales:
--
-- SELECT t.slug, t.is_active, t.price,
--        (SELECT count(*) FROM public.tour_product_pages p
--          WHERE p.slug = t.slug AND p.is_published) AS published_locales
--   FROM public.tours t
--  WHERE t.slug = 'from-busan-gyeongju-ancient-capital-day-tour';
--
-- Then confirm the recommender is current (file 07 changed the course):
--   node scripts/import-match-v18.mjs --single from-busan-gyeongju-ancient-capital-day-tour
