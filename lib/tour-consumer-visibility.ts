import { STATIC_TOUR_PRODUCT_BUNDLE_SLUGS } from "@/components/product-tour-static/_shared/tourProductBundleSlugs";
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
 * Canonical East Signature row slug. Its `/tour-product/east-signature-nature-core`
 * detail page stays live, but as of 2026-06-23 it (and the rest of the East
 * Signature family) is hidden from the public tour list/catalogue per product
 * decision — see `isTourSlugHiddenFromPublicCatalog`.
 */
export const CANONICAL_EAST_SIGNATURE_CATALOG_SLUG = "east-signature-nature-core";

/** Slug of the Jeju Grand Highlights Loop flagship row in `tours`. */
export const CANONICAL_JEJU_GRAND_CATALOG_SLUG = "jeju-grand-highlights-loop";

/** Slug of the Southwest flagship row in `tours`. */
export const CANONICAL_SOUTHWEST_CATALOG_SLUG = "southwest-hallasan-osulloc-aewol";

/**
 * Slug aliases that resolve to a canonical `/tour-product/<other-slug>` page —
 * for legacy / variant SKUs whose alias slug isn't itself a registered bundle
 * but should still land on a flagship's detail surface.
 *
 * Bundle-registered slugs (see `STATIC_TOUR_PRODUCT_BUNDLE_SLUGS`) resolve
 * automatically and must NOT be listed here. Only add aliases whose canonical
 * target slug differs from the alias slug.
 */
export const FLAGSHIP_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  /** Live East small-group SKU shares the flagship East Signature detail page. */
  [CANONICAL_EAST_JEJU_SIGNATURE_SMALL_GROUP_SLUG]: CANONICAL_EAST_SIGNATURE_PRODUCT_PATH,
});

/**
 * Returns the `/tour-product/[slug]` path when the row should redirect away from
 * `/tour/[id]`. Resolves explicit aliases first, then falls through to the
 * static bundle registry — every registered bundle gets a canonical link
 * automatically, so adding a new product to the registry is enough.
 */
export function canonicalProductPathForSlug(slug: string | null | undefined): string | null {
  if (slug == null || typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const aliased = FLAGSHIP_SLUG_ALIASES[s];
  if (aliased) return aliased;
  if (STATIC_TOUR_PRODUCT_BUNDLE_SLUGS.has(s)) {
    return `/tour-product/${s}`;
  }
  return null;
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
  // Retired 2026-05-14 — replaced by seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  // Retired 2026-05-23 — overlapped with from-busan-gyeongju-ancient-capital-day-tour
  // (same Busan→Gyeongju route, same $39 price). Keeping the small-group variant active.
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  // Seoul re-activated 2026-06-21 (was Paused 2026-05-25 pending operator re-vetting).
  // All 11 Seoul-region day tours back online per product decision; DB is_active was
  // already true (the 2026-05-25 "Mirrors is_active=false" note was stale — the pause
  // was enforced by this blocklist + the landing-planner Seoul gate only).
  // Hidden 2026-06-23 per product decision — removed from the public tour list/catalogue.
  "jeju-west-south-full-day-authentic-tour",
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

/** Stripe checkout under `/tour/[id]/checkout`; blocked IDs fall back to `/tours/list`. */
export function consumerTourCheckoutHref(tourId: string | null | undefined, slug?: string | null): string {
  if (tourId == null || tourId === "") return "/tours/list";
  if (isTourBlockedFromConsumerSurfaces(tourId, slug ?? null)) return "/tours/list";
  return `/tour/${tourId}/checkout`;
}

/**
 * Hide flagship / duplicate rows from consumer tour lists (web + mobile + search).
 * Blocked tour ids are removed separately (`isTourIdBlockedFromConsumerSurfaces`).
 *
 * As of 2026-06-23 the entire East Signature family — including the canonical
 * `east-signature-nature-core` — is hidden here per product decision. Its
 * `/tour-product/east-signature-nature-core` detail page stays reachable
 * (`consumerTourDetailHref` is unaffected) and it is dropped from the home
 * "Most loved" rail via `FEATURED_PRODUCT_SLUGS`.
 */
export function isTourSlugHiddenFromPublicCatalog(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = slug.trim().toLowerCase();
  if (!s) return false;
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
