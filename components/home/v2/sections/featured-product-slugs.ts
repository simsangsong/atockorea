/**
 * Curated slug order for the "Most loved this week" rail on the home page.
 * Kept in its OWN file (no `'use client'`, no client-only imports) so the
 * server-rendered `app/page.tsx` can import the array literal directly.
 * When this lived inside `featured-products-showcase.tsx` (`'use client'`),
 * the server's `import { FEATURED_PRODUCT_SLUGS }` returned a Next.js
 * client-reference proxy instead of the array — "function is not
 * iterable" at SSR.
 */
// Klook onboarding prep 2026-06-29: curated to the 12 active SKUs only. The
// previous list referenced east-signature / southwest / from-busan-gyeongju /
// jeju-eastern, which are now deactivated + consumer-blocked — they'd be
// silently dropped by the blocklist filter below, shrinking the rail. Swapped
// for active SKUs so the rail stays full. Reversible: restore prior slugs.
export const FEATURED_PRODUCT_SLUGS = [
  "busan-top-attractions-day-tour",
  "jeju-grand-highlights-loop",
  "pocheon-sanjeong-lake-herb-island-art-valley",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "jeju-cruise-shore-excursion-small-group-tour",
  "seoul-private-nami-morning-calm-petite-france",
  "jeju-island-private-car-charter-tour",
] as const;
