-- =============================================================================
-- 20260429150000_delete_deprecated_tours_2026_04_27.sql
-- =============================================================================
-- Promotes supabase/manual/delete-deprecated-tours-2026-04-27.sql to a
-- repeatable migration. Designed to be IDEMPOTENT — safe to re-apply on a
-- prod where the manual SQL has already been run.
--
-- Keep:
--   east-signature-nature-core, jeju-grand-highlights-loop,
--   southwest-hallasan-osulloc-aewol
--
-- Delete (7):
--   east-jeju-classic-bus-tour, south-jeju-classic-bus-tour,
--   southwest-jeju-scenic-bus-tour,
--   jeju-cruise-shore-excursion-bus-tour,
--   jeju-cruise-shore-excursion-small-group-tour,
--   busan-top-attractions-authentic-one-day-tour,
--   busan-city-tour-shore-excursion-cruise-guests
-- =============================================================================

DO $$
DECLARE
  deprecated_slugs text[] := ARRAY[
    'east-jeju-classic-bus-tour',
    'south-jeju-classic-bus-tour',
    'southwest-jeju-scenic-bus-tour',
    'jeju-cruise-shore-excursion-bus-tour',
    'jeju-cruise-shore-excursion-small-group-tour',
    'busan-top-attractions-authentic-one-day-tour',
    'busan-city-tour-shore-excursion-cruise-guests'
  ];
BEGIN
  UPDATE public.bookings
     SET tour_id = NULL
   WHERE tour_id IN (
     SELECT id FROM public.tours WHERE slug = ANY(deprecated_slugs)
   );

  DELETE FROM public.tour_matching_profiles
   WHERE product_id = ANY(deprecated_slugs);

  DELETE FROM public.tour_product_pages
   WHERE slug = ANY(deprecated_slugs);

  DELETE FROM public.tours
   WHERE slug = ANY(deprecated_slugs);
END
$$;
