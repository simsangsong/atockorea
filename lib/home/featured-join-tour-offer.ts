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

/**
 * 🔴 Every field here is a hand-copy of the product's own `catalog_card`, and
 * that is the whole hazard. The previous occupant of this constant was
 * `east-signature-nature-core`, retired in the database — `is_active = false`,
 * zero bookings ever, on the consumer blocklist — and the home page went on
 * advertising it at "From US$59 per person (was $69, 14% off)" because nothing
 * here reads the product.
 *
 * It is still a local constant rather than an import: the product JSON is large
 * and pulling it into the homepage's initial render is what this file exists to
 * avoid. So the drift is prevented by a gate instead. `homeFeaturedProduct`
 * compares every field below against
 * `components/product-tour-static/<slug>/<slug>.en.json`'s `catalog_card` and
 * against the consumer visibility rules. Copying is fine; copying and drifting
 * is not.
 *
 * Values below are the product's own, verbatim. The price says $80 and claims
 * no discount because there is no discount — `tours.price` is 80.00 USD and the
 * static card carries `salePriceUsd: 80` with no compare-at. A struck-through
 * price nobody offered is worse than no struck-through price.
 */
const FEATURED_JOIN_TOUR_PRODUCT: FeaturedJoinTourProduct = {
  slug: FEATURED_JOIN_TOUR_SLUG,
  title: "Jeju Grand Highlights Loop",
  subtitle:
    "Jeju's three UNESCO sites, a live haenyeo show, sea-cliffs and an ocean waterfall — the island's absolute best in one day.",
  region: "Jeju Full-Island Route",
  duration: "10–10.5 hours",
  stopsCount: 7,
  rating: 0,
  reviewCount: 0,
  badges: ["Small group", "3 UNESCO Sites", "Best for One-Day Visitors"],
  heroImage: "/images/tours/hallasan-1100/kakaotalk-20260510-230009595-21.webp",
  thumbnail: "/images/tours/hallasan-1100/kakaotalk-20260510-230009595-21.webp",
  priceLabel: "From US$80 per person",
  shortCardDescription:
    "A high-intensity full-island route linking three UNESCO World Heritage sites — Hallasan, Seongsan Ilchulbong and Manjanggul lava tube — with a living haenyeo free-diving show, the Jusangjeolli columnar cliffs and the ocean-falling Jeongbang Waterfall.",
  listPriceUsd: 80,
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
