-- =============================================================================
-- delete-deprecated-tours-2026-04-27-split.sql
-- =============================================================================
-- Same purpose as delete-deprecated-tours-2026-04-27.sql but split into
-- self-contained sections. Run sections ONE AT A TIME from top to bottom.
-- Each section is independently runnable. No BEGIN/COMMIT (Supabase auto-wraps).
-- =============================================================================


-- =============================================================================
-- SECTION 0a — Pre-check: confirm 7 rows match
-- (highlight from here to next "===" line, then Run)
-- =============================================================================
SELECT 'tours-to-delete' AS label, slug, city, tag, is_active
FROM public.tours
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
)
ORDER BY slug;


-- =============================================================================
-- SECTION 0b — Pre-check: bookings still pointing to these tours?
-- =============================================================================
SELECT t.slug, COUNT(b.id) AS booking_count
FROM public.tours t
LEFT JOIN public.bookings b ON b.tour_id = t.id
WHERE t.slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
)
GROUP BY t.slug
ORDER BY t.slug;


-- =============================================================================
-- SECTION 1 — Null out booking.tour_id (if RESTRICT FK)
-- =============================================================================
UPDATE public.bookings
SET tour_id = NULL
WHERE tour_id IN (
  SELECT id FROM public.tours
  WHERE slug IN (
    'east-jeju-classic-bus-tour',
    'south-jeju-classic-bus-tour',
    'southwest-jeju-scenic-bus-tour',
    'jeju-cruise-shore-excursion-bus-tour',
    'jeju-cruise-shore-excursion-small-group-tour',
    'busan-top-attractions-authentic-one-day-tour',
    'busan-city-tour-shore-excursion-cruise-guests'
  )
);


-- =============================================================================
-- SECTION 2 — Delete tour_matching_profiles (no FK, manual)
-- =============================================================================
DELETE FROM public.tour_matching_profiles
WHERE product_id IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);


-- =============================================================================
-- SECTION 3 — Delete tour_product_pages (cascades to tour_product_offers)
-- =============================================================================
DELETE FROM public.tour_product_pages
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);


-- =============================================================================
-- SECTION 4 — Delete tours (cascades to pickup_points, product_inventory,
--             reviews, wishlist, cart_items)
-- =============================================================================
DELETE FROM public.tours
WHERE slug IN (
  'east-jeju-classic-bus-tour',
  'south-jeju-classic-bus-tour',
  'southwest-jeju-scenic-bus-tour',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-authentic-one-day-tour',
  'busan-city-tour-shore-excursion-cruise-guests'
);


-- =============================================================================
-- SECTION 5a — Verify: only 3 tours should remain
-- =============================================================================
SELECT 'remaining tours' AS label, slug, city, tag
FROM public.tours
ORDER BY slug;


-- =============================================================================
-- SECTION 5b — Verify: only 3 product_pages slugs should remain
-- =============================================================================
SELECT 'remaining tour_product_pages' AS label, slug, locale, is_published
FROM public.tour_product_pages
ORDER BY slug, locale;


-- =============================================================================
-- SECTION 5c — Verify: only 3 matching_profiles should remain
-- =============================================================================
SELECT 'remaining tour_matching_profiles' AS label, product_id, product_type, region_type
FROM public.tour_matching_profiles
ORDER BY product_id;
