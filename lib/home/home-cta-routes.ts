/**
 * Home v2 marketing CTAs — same targets as `v2-best-match-result-vm` (no new APIs).
 * Change here to retarget flagship join / browse flows site-wide from the homepage.
 */

/** Supabase `tours.slug` for the flagship join product (API fetch) — same as static tour product page. */
export const FEATURED_JOIN_TOUR_SLUG = "east-signature-nature-core";

/**
 * Canonical public URL for that product (static tour product page + checkout from there).
 * Old paths may still redirect via `next.config.js`.
 */
export const HOME_CTA_FEATURED_JOIN_TOUR_HREF = "/tour-product/east-signature-nature-core";

export const HOME_CTA_BROWSE_TOURS_HREF = "/tours/list";
/** Direct list + join filter — avoid `/tours/small-group` (server redirect) on client nav, which can fail to swap the RSC tree in production. */
export const HOME_CTA_SMALL_GROUP_LIST_HREF = "/tours/list?type=join";
/**
 * Standalone matcher page — "deep-form" companion to the inline home hero
 * planner (`HomeV2MatchProvider`). Both call `POST /api/tour-product/match`.
 * Keep this stable: external links (SNS, ads, deep links) depend on `/match`.
 * If we ever consolidate, redirect `/match` → home with `?openPlanner=1` rather
 * than repointing this constant.
 */
export const HOME_CTA_MATCHING_HREF = "/match";

export const HOME_CTA_REVIEWS_HREF = "/reviews";
