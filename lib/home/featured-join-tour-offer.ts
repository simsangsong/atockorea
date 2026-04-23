import {
  getStaticTourProductBySlug,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { FEATURED_JOIN_TOUR_SLUG } from "@/lib/home/home-cta-routes";

/** Flagship join tour on the home v2 surface — single source for USD list / compare-at on cards. */
export function getFeaturedJoinTourProduct(): StaticTourProductRegistration {
  const p = getStaticTourProductBySlug(FEATURED_JOIN_TOUR_SLUG);
  if (!p) {
    throw new Error(`Missing static tour product for featured join: ${FEATURED_JOIN_TOUR_SLUG}`);
  }
  return p;
}

export function usdIntLabel(usd: number): string {
  return `$${usd}`;
}

export function getProductPriceLabels(p: StaticTourProductRegistration): {
  listLabel: string;
  compareAtLabel: string | null;
} {
  return {
    listLabel: usdIntLabel(p.listPriceUsd),
    compareAtLabel: p.compareAtPriceUsd != null ? usdIntLabel(p.compareAtPriceUsd) : null,
  };
}
