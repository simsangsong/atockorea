import {
  CANONICAL_EAST_JEJU_SIGNATURE_SMALL_GROUP_SLUG,
  matchesEastSignatureSlugSegment,
} from "@/src/lib/east-signature-nature-core-match";

/**
 * Consumer blocklist for legacy `/tour/[id]` rows (and matching slugs).
 * Do not wire new UI to `data/tours` or `TourCardDetail` — see `.cursor/rules/legacy-isolated-tour-surfaces.mdc` and `eslint.config.mjs`.
 */

/** Public detail page for the flagship East Signature product. */
export const CANONICAL_EAST_SIGNATURE_PRODUCT_PATH = "/tour-product/east-signature-nature-core";

/** Public detail page for the Jeju Grand Highlights Loop product (JSON-driven). */
export const CANONICAL_JEJU_GRAND_PRODUCT_PATH = "/tour-product/jeju-grand-highlights-loop";

/** Public detail page for the Southwest (Hallasan → O'Sulloc → Aewol) product (JSON-driven). */
export const CANONICAL_SOUTHWEST_PRODUCT_PATH = "/tour-product/southwest-hallasan-osulloc-aewol";

/**
 * Single slug we keep in GET /api/tours (and derived cards). Other East Signature–family
 * rows are duplicate/legacy marketing SKUs for the same experience.
 */
export const CANONICAL_EAST_SIGNATURE_CATALOG_SLUG = "east-signature-nature-core";

/** Slug of the Jeju Grand Highlights Loop flagship row in `tours`. */
export const CANONICAL_JEJU_GRAND_CATALOG_SLUG = "jeju-grand-highlights-loop";

/** Slug of the Southwest flagship row in `tours`. */
export const CANONICAL_SOUTHWEST_CATALOG_SLUG = "southwest-hallasan-osulloc-aewol";

/**
 * Slug → `/tour-product/[slug]` canonical path for rows that exist in `tours` but are
 * primarily served by the flagship `/tour-product/[slug]` route. Used by `/tour/[id]`
 * to redirect away from the legacy detail surface without maintaining UUID allowlists
 * in `next.config.js`. Only include slugs whose `/tour-product/[slug]/page.tsx` exists
 * (or is served by the catch-all `app/tour-product/[slug]/page.tsx`).
 */
export const FLAGSHIP_TOUR_PRODUCT_PATHS: Readonly<Record<string, string>> = Object.freeze({
  [CANONICAL_EAST_SIGNATURE_CATALOG_SLUG]: CANONICAL_EAST_SIGNATURE_PRODUCT_PATH,
  /** Live East small-group SKU shares the same flagship detail page as the canonical row. */
  [CANONICAL_EAST_JEJU_SIGNATURE_SMALL_GROUP_SLUG]: CANONICAL_EAST_SIGNATURE_PRODUCT_PATH,
  [CANONICAL_JEJU_GRAND_CATALOG_SLUG]: CANONICAL_JEJU_GRAND_PRODUCT_PATH,
  [CANONICAL_SOUTHWEST_CATALOG_SLUG]: CANONICAL_SOUTHWEST_PRODUCT_PATH,
  "south-jeju-classic-bus-tour": "/tour-product/south-jeju-classic-bus-tour",
  "southwest-jeju-scenic-bus-tour": "/tour-product/southwest-jeju-scenic-bus-tour",
  "east-jeju-classic-bus-tour": "/tour-product/east-jeju-classic-bus-tour",
  "jeju-cruise-shore-excursion-bus-tour": "/tour-product/jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour": "/tour-product/jeju-cruise-shore-excursion-small-group-tour",
  "busan-top-attractions-authentic-one-day-tour": "/tour-product/busan-top-attractions-authentic-one-day-tour",
  "busan-city-tour-shore-excursion-cruise-guests": "/tour-product/busan-city-tour-shore-excursion-cruise-guests",
});

/** Returns the `/tour-product/[slug]` path when the row should redirect away from `/tour/[id]`. */
export function canonicalProductPathForSlug(slug: string | null | undefined): string | null {
  if (slug == null || typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  return FLAGSHIP_TOUR_PRODUCT_PATHS[s] ?? null;
}

/**
 * Legacy / duplicate `tours.id` values that must never appear on consumer surfaces:
 * lists, search, sitemap, `/tour/[id]`, availability, or internal links to `/tour/...`.
 * Admin PATCH/DELETE on `/api/tours/[id]` still works.
 *
 * Includes the “seven tours” bundle (scripts/i18n/seven-tours-bundle.mjs) — legacy `/tour/[id]`
 * SKUs being retired in favor of future small-group–style product pages.
 */
export const CONSUMER_BLOCKED_TOUR_IDS = new Set<string>([
  "97877063-e982-4754-a4d9-daa8688a5455",
  "59877dce-5425-42f4-bd59-cc4e816fdc39",
  "0288eb78-b741-4bcf-821f-523518906753",
  "d7187d55-a482-4d5c-9d5a-ab6992448d82",
  "dd4a604c-e328-4d24-b060-f6f4e31266ad",
  "357e63a6-59fd-4e55-a5f7-11d766ed1aa5",
  "b0bd462c-a1a8-4ec6-92d7-f275335f8762",
  "592ac1da-9ea2-4ac0-8cd5-26efbbf75699",
]);

/**
 * Exact slugs removed from the public catalog (same policy as blocked ids).
 * Also see `isTourSlugBlockedFromConsumerSurfaces` for timestamped / scripted variants.
 */
export const CONSUMER_BLOCKED_TOUR_SLUGS = new Set<string>([
  "busan-top-attractions-authentic-one-day-guided-tour",
  "jeju-southern-top-unesco-spots-bus-tour",
  "jeju-island-full-day-tour-cruise-passengers",
  "jeju-eastern-unesco-spots-bus-tour",
  "east-jeju-signature-small-group",
]);

function normalizeTourIdForBlocklist(id: string): string {
  return id.trim().toLowerCase();
}

/** True when this `tours.id` must be hidden from every consumer-facing flow. */
export function isTourIdBlockedFromConsumerSurfaces(tourId: string | null | undefined): boolean {
  if (tourId == null || typeof tourId !== "string") return false;
  return CONSUMER_BLOCKED_TOUR_IDS.has(normalizeTourIdForBlocklist(tourId));
}

function normalizeSlugForBlocklist(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Block legacy rows by `tours.slug` when ids differ per environment, and scripted
 * `*-timestamp` variants (private Busan / Jeju car charter).
 */
export function isTourSlugBlockedFromConsumerSurfaces(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = normalizeSlugForBlocklist(slug);
  if (!s) return false;
  if (CONSUMER_BLOCKED_TOUR_SLUGS.has(s)) return true;
  if (s.startsWith("private-busan-tour-discover-top-sights")) return true;
  if (s.startsWith("jeju-private-car-charter-tour")) return true;
  if (s.startsWith("busan-top-attractions-authentic-one-day-guided-tour")) return true;
  return false;
}

/** True when either id or slug is on the consumer blocklist (catalog + links). */
export function isTourBlockedFromConsumerSurfaces(
  tourId: string | null | undefined,
  slug: string | null | undefined
): boolean {
  if (isTourIdBlockedFromConsumerSurfaces(tourId)) return true;
  return isTourSlugBlockedFromConsumerSurfaces(slug);
}

/**
 * Href for a tour detail URL; blocked IDs fall back to `/tours/list` so nothing points at a removed SKU.
 *
 * Flagship rows (East / Jeju Grand / Southwest) link directly to their canonical
 * `/tour-product/[slug]` surface so cards never flash through the legacy `/tour/[id]`
 * template while waiting for its client-side redirect.
 */
export function consumerTourDetailHref(tourId: string | null | undefined, slug?: string | null): string {
  if (tourId == null || tourId === "") return "/tours/list";
  if (isTourBlockedFromConsumerSurfaces(tourId, slug ?? null)) return "/tours/list";
  const canonicalPath = canonicalProductPathForSlug(slug ?? null);
  if (canonicalPath) return canonicalPath;
  return `/tour/${tourId}`;
}

/** Stripe/PayPal-style checkout under `/tour/[id]/checkout`; blocked IDs fall back to `/tours/list`. */
export function consumerTourCheckoutHref(tourId: string | null | undefined, slug?: string | null): string {
  if (tourId == null || tourId === "") return "/tours/list";
  if (isTourBlockedFromConsumerSurfaces(tourId, slug ?? null)) return "/tours/list";
  return `/tour/${tourId}/checkout`;
}

/**
 * Hide duplicate flagship rows from consumer tour lists (web + mobile + search).
 * Blocked tour ids are removed separately (`isTourIdBlockedFromConsumerSurfaces`).
 */
export function isTourSlugHiddenFromPublicCatalog(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = slug.trim().toLowerCase();
  if (!s) return false;
  if (s === CANONICAL_EAST_SIGNATURE_CATALOG_SLUG) return false;
  if (s === "jeju-east-small-group-template-preview") return true;
  if (matchesEastSignatureSlugSegment(s)) return true;
  if (isTourSlugBlockedFromConsumerSurfaces(s)) return true;
  return false;
}

/** GET /api/tours list filter: blocked ids plus `isTourSlugHiddenFromPublicCatalog` (East + blocked slugs). */
export function isTourRowHiddenFromPublicTourApi(tour: {
  id?: string | null;
  slug?: string | null;
}): boolean {
  if (isTourIdBlockedFromConsumerSurfaces(tour.id != null ? String(tour.id) : null)) return true;
  return isTourSlugHiddenFromPublicCatalog(tour.slug);
}
