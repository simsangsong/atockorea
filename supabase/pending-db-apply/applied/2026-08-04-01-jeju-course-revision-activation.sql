-- =============================================================================
-- Jeju course revision 2026-08-04 — hydrangea SKUs down, 3 regional tours up
-- =============================================================================
-- Owner instruction (2026-08-04): retire the seasonal hydrangea products and
-- open the East / South / Southwest Jeju day tours with the revised courses:
--   East      jeju-eastern-unesco-spots-day-tour   Manjanggul → Seongeup → lunch
--             → Seongsan → haenyeo performance → Hamdeok  (reordered — see
--             2026-08-04-02-jeju-eastern-unesco-reorder.sql, apply it AFTER this)
--   Southwest southwest-hallasan-osulloc-aewol     1100 Highland → Jusangjeolli
--             → Cheonjeyeon → lunch → O'Sulloc → Aewol → Iho Tewoo (already in DB
--             content since v18 2026-06-24 — only the flags flip here)
--   South     jeju-southern-top-unesco-spots-tour  Jeongbang Falls → Oedolgae &
--             Olle 7 → Yakcheonsa → lunch → Osulloc → Eoseungsaengak (already in
--             DB content since v18 2026-06-24 — only the flags flip here)
--
-- Repo half (same change set): lib/tour-consumer-visibility.ts blocklist —
-- hydrangea slugs added, the three tour slugs removed. Deploy the repo change
-- together with (or before) this SQL so the consumer surfaces and DB agree.
--
-- AFTER APPLYING, refresh/restore the recommender rows for the re-opened tours
-- (match_tours may have been pruned at deactivation, and East's full_document
-- must pick up the reorder):
--   node scripts/import-match-v18.mjs --single jeju-eastern-unesco-spots-day-tour
--   node scripts/import-match-v18.mjs --single jeju-southern-top-unesco-spots-tour
--   node scripts/import-match-v18.mjs --single southwest-hallasan-osulloc-aewol
--
-- Idempotent: plain flag UPDATEs keyed by slug.
-- =============================================================================

BEGIN;

-- 1) Hydrangea SKUs down (season over + product decision)
UPDATE public.tours
SET is_active = false,
    updated_at = now()
WHERE slug IN (
  'jeju-hydrangea-festival-tour-east-route',
  'jeju-hydrangea-festival-tour-southwest-route'
);

UPDATE public.tour_product_pages
SET is_published = false
WHERE slug IN (
  'jeju-hydrangea-festival-tour-east-route',
  'jeju-hydrangea-festival-tour-southwest-route'
);

-- 2) East / South / Southwest tours up
UPDATE public.tours
SET is_active = true,
    updated_at = now()
WHERE slug IN (
  'jeju-eastern-unesco-spots-day-tour',
  'jeju-southern-top-unesco-spots-tour',
  'southwest-hallasan-osulloc-aewol'
);

UPDATE public.tour_product_pages
SET is_published = true
WHERE slug IN (
  'jeju-eastern-unesco-spots-day-tour',
  'jeju-southern-top-unesco-spots-tour',
  'southwest-hallasan-osulloc-aewol'
);

COMMIT;

-- Verify:
--   SELECT slug, is_active FROM public.tours WHERE slug LIKE 'jeju-hydrangea%'
--     OR slug IN ('jeju-eastern-unesco-spots-day-tour','jeju-southern-top-unesco-spots-tour','southwest-hallasan-osulloc-aewol');
--   SELECT slug, locale, is_published FROM public.tour_product_pages
--     WHERE slug IN ('jeju-eastern-unesco-spots-day-tour','jeju-southern-top-unesco-spots-tour','southwest-hallasan-osulloc-aewol')
--     ORDER BY slug, locale;
