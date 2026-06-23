/**
 * Curated slug order for the "Most loved this week" rail on the home page.
 * Kept in its OWN file (no `'use client'`, no client-only imports) so the
 * server-rendered `app/page.tsx` can import the array literal directly.
 * When this lived inside `featured-products-showcase.tsx` (`'use client'`),
 * the server's `import { FEATURED_PRODUCT_SLUGS }` returned a Next.js
 * client-reference proxy instead of the array — "function is not
 * iterable" at SSR.
 */
export const FEATURED_PRODUCT_SLUGS = [
  // east-signature-nature-core removed 2026-06-23 — hidden from the public
  // catalogue/list per product decision (see lib/tour-consumer-visibility.ts).
  "busan-top-attractions-day-tour",
  "jeju-grand-highlights-loop",
  "southwest-hallasan-osulloc-aewol",
  "from-busan-gyeongju-ancient-capital-day-tour",
  "jeju-island-private-car-charter-tour",
  "jeju-eastern-unesco-spots-day-tour",
] as const;
