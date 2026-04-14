import { matchesEastSignatureSlugSegment } from "@/src/lib/east-signature-nature-core-match";

/** Public detail page for the flagship East Signature product. */
export const CANONICAL_EAST_SIGNATURE_PRODUCT_PATH = "/tour-product/east-signature-nature-core";

/**
 * Single slug we keep in GET /api/tours (and derived cards). Other East Signature–family
 * rows are duplicate/legacy marketing SKUs for the same experience.
 */
export const CANONICAL_EAST_SIGNATURE_CATALOG_SLUG = "east-signature-nature-core";

/**
 * Hide duplicate flagship rows from consumer tour lists (web + mobile + search).
 * Does not affect GET /api/tours/[id] (checkout / admin still resolve by id or slug).
 */
export function isTourSlugHiddenFromPublicCatalog(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = slug.trim().toLowerCase();
  if (!s) return false;
  if (s === CANONICAL_EAST_SIGNATURE_CATALOG_SLUG) return false;
  if (s === "jeju-east-small-group-template-preview") return true;
  if (matchesEastSignatureSlugSegment(s)) return true;
  return false;
}
