/**
 * Private Tour Builder visibility flag.
 *
 * Klook onboarding 2026-06-29: the custom itinerary builder (map + POI pins +
 * AI day-plan) is HIDDEN site-wide while the Klook listing is under review — it
 * is not a Klook SKU and competes with the fixed catalog. The 5 fixed private
 * tour PRODUCTS (/tour-product/[slug]) are unaffected; only the builder feature
 * is gated.
 *
 * Effects when false:
 *  - /itinerary-builder* routes redirect to /tours/list
 *  - home (choose-travel-style, best-match-preview) builder CTAs are not rendered
 *  - /tours/list empty-state + conversion-rescue builder CTAs are not rendered
 *  - sitemap + llms.txt drop the builder URLs
 *
 * Flip back to `true` to fully restore (all code + components left intact).
 */
export const ITINERARY_BUILDER_ENABLED = false;
