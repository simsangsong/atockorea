import { getCardImageFromAdminMedia } from "@/hooks/useTourProductCardMedia";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";

const slug = "sample-tour";
const bundled = "/images/tours/catalog-thumbnails/sample-tour-premium-v1.webp";

function media(cardImageUrl: string, updatedAt: string | null): TourProductCardMediaMap {
  return {
    [slug]: {
      slug,
      thumbnailUrl: cardImageUrl,
      heroImageUrl: null,
      cardImageUrl,
      sourceLocale: "ko",
      updatedAt,
    },
  };
}

describe("getCardImageFromAdminMedia", () => {
  it("keeps a bundled premium-v1 thumbnail over an older database row", () => {
    expect(
      getCardImageFromAdminMedia(
        slug,
        bundled,
        media("/images/tours/legacy.webp", "2026-08-07T23:59:59.000Z"),
      ),
    ).toBe(bundled);
  });

  it("allows a later admin save to replace the bundled release", () => {
    const latest = "/images/tours/admin-latest.webp";
    expect(
      getCardImageFromAdminMedia(slug, bundled, media(latest, "2026-08-09T00:00:00.000Z")),
    ).toBe(latest);
  });

  it("preserves normal admin priority for non-versioned fallbacks", () => {
    const latest = "/images/tours/admin.webp";
    expect(
      getCardImageFromAdminMedia(
        slug,
        "/images/tours/static.webp",
        media(latest, "2026-01-01T00:00:00.000Z"),
      ),
    ).toBe(latest);
  });
});
