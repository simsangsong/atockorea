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
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "busan-top-attractions-day-tour",
  "jeju-grand-highlights-loop",
  "seoul-suburbs-private-chartered-car-10hr",
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "jeju-island-private-car-charter-tour",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
] as const;
