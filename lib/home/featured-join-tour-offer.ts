import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { FEATURED_JOIN_TOUR_SLUG, HOME_CTA_FEATURED_JOIN_TOUR_HREF } from "@/lib/home/home-cta-routes";

export type FeaturedJoinTourProduct = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
  listPriceUsd: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

const FEATURED_JOIN_TOUR_PRODUCT: FeaturedJoinTourProduct = {
  slug: FEATURED_JOIN_TOUR_SLUG,
  title: "East Jeju: Volcano, Coast & Folk Village",
  subtitle: "Seongsan sunrise peak, Seopjikoji cliffs, Hamdeok beach, and a living folk village in one balanced day.",
  region: "East Jeju",
  duration: "8 hours",
  stopsCount: 6,
  rating: 0,
  reviewCount: 0,
  badges: ["First-Time Friendly", "East Jeju Signature", "Small Group"],
  heroImage: "/images/tours/seopjikoji/kakaotalk-20260510-230009595-10.webp",
  thumbnail: "/images/tours/seopjikoji/kakaotalk-20260510-230009595-10.webp",
  priceLabel: "From US$59 per person (was $69, 14% off)",
  shortCardDescription:
    "A scenic east Jeju route pairing dramatic coast, volcanic landmarks, beach time, and traditional village texture.",
  listPriceUsd: 59,
  compareAtPriceUsd: 69,
  maxGroupSize: 8,
};

/**
 * Flagship join tour on the home v2 surface. Kept local so the homepage price
 * card does not import full tour detail JSON during initial render.
 */
export function getFeaturedJoinTourProduct(
  locale: TourProductPageLocale = "en",
): FeaturedJoinTourProduct {
  void locale;
  return FEATURED_JOIN_TOUR_PRODUCT;
}

export function getFeaturedJoinTourHref(): string {
  return HOME_CTA_FEATURED_JOIN_TOUR_HREF;
}

export function usdIntLabel(usd: number): string {
  return `$${usd}`;
}

export function getProductPriceLabels(p: Pick<FeaturedJoinTourProduct, "listPriceUsd" | "compareAtPriceUsd">): {
  listLabel: string;
  compareAtLabel: string | null;
} {
  return {
    listLabel: usdIntLabel(p.listPriceUsd),
    compareAtLabel: p.compareAtPriceUsd != null ? usdIntLabel(p.compareAtPriceUsd) : null,
  };
}
