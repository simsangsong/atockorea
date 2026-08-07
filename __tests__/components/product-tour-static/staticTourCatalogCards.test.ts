/**
 * The static catalogue must not hand out a consumer-blocked product.
 *
 * 🔴 Rewritten 2026-08-07. This test used to name one slug —
 * `seoul-seoraksan-national-park-sokcho-beach-day-trip` — as "the retired one".
 * That slug was retired in 2026-05, then re-opened by the owner on 2026-08-07,
 * and the test failed for a product decision rather than a regression. A gate
 * that hard-codes today's catalogue answers goes stale every time the catalogue
 * changes, which is often.
 *
 * So derive the subjects from the blocklist instead: whatever is blocked AND has
 * a bundle registered must not come back out of the catalogue, and the set is
 * read at run time rather than copied here.
 */
import {
  getStaticTourProductBySlug,
  listStaticTourProducts,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST } from "@/components/product-tour-static/_shared/tourProductBundleSlugs";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";

/** Registered bundles that are currently blocked — the ones that could leak. */
const BLOCKED_REGISTERED = STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST.filter((slug) =>
  isTourSlugBlockedFromConsumerSurfaces(slug),
);

/** Registered bundles that are NOT blocked — the positive control. */
const OPEN_REGISTERED = STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST.filter(
  (slug) => !isTourSlugBlockedFromConsumerSurfaces(slug),
);

describe("staticTourCatalogCards public catalog filtering", () => {
  // 🔴 Without this, every assertion below passes vacuously when the catalogue
  // returns nothing at all — an empty list satisfies "the blocked slug is
  // absent" perfectly. Absence is only evidence when presence is possible.
  it("the catalogue actually returns products (so absence means something)", () => {
    expect(OPEN_REGISTERED.length).toBeGreaterThan(0);
    expect(listStaticTourProducts("en").length).toBeGreaterThan(0);
    expect(listStaticTourProducts("ko").length).toBeGreaterThan(0);
  });

  it("has blocked-but-registered slugs to test (otherwise this file proves nothing)", () => {
    expect(BLOCKED_REGISTERED.length).toBeGreaterThan(0);
  });

  it.each(BLOCKED_REGISTERED)("does not return blocked product %s", (slug) => {
    expect(getStaticTourProductBySlug(slug)).toBeUndefined();
    expect(listStaticTourProducts("en").some((p) => p.slug === slug)).toBe(false);
    expect(listStaticTourProducts("ko").some((p) => p.slug === slug)).toBe(false);
  });

  it("does not filter out products that are open", () => {
    // The re-opened Suwon/Seoraksan six land here; before 2026-08-07 they were
    // in BLOCKED_REGISTERED above. Same file proves both directions.
    const en = listStaticTourProducts("en").map((p) => p.slug);
    const served = OPEN_REGISTERED.filter((slug) => en.includes(slug));
    expect(served.length).toBeGreaterThan(0);
  });
});
