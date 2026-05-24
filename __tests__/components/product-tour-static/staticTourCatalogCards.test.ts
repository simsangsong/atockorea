import {
  getStaticTourProductBySlug,
  listStaticTourProducts,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";

describe("staticTourCatalogCards public catalog filtering", () => {
  it("does not return consumer-blocked static products", () => {
    const retiredSlug = "seoul-seoraksan-national-park-sokcho-beach-day-trip";

    expect(getStaticTourProductBySlug(retiredSlug)).toBeUndefined();
    expect(listStaticTourProducts("en").some((product) => product.slug === retiredSlug)).toBe(false);
    expect(listStaticTourProducts("ko").some((product) => product.slug === retiredSlug)).toBe(false);
  });
});
