/**
 * DB/API 없이 프로젝트에만 존재하는 정적 투어 상품 등록부.
 * 상세: /tour-product/[slug] — 카드 카피는 JSON `catalog_card`와 동기 권장.
 */

import jejuGrandPage from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import southwestPage from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";
import {
  EAST_SIGNATURE_COMPARE_AT_PRICE_USD,
  EAST_SIGNATURE_LIST_PRICE_USD,
} from "@/lib/tour-detail/east/constants";

export type StaticTourProductRegistration = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: readonly string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
  /** Integer USD for marketing cards — must match `priceLabel` */
  listPriceUsd: number;
  /** Optional strikethrough list (USD), e.g. compare-at / anchor */
  compareAtPriceUsd?: number;
  /** Small-group / van capacity line on home, e.g. 8 */
  maxGroupSize?: number;
};

export const STATIC_TOUR_PRODUCT_DETAIL_PREFIX = "/tour-product" as const;

export function hrefStaticTourProductDetail(slug: string): string {
  return `${STATIC_TOUR_PRODUCT_DETAIL_PREFIX}/${slug}`;
}

/** East Signature Nature Core — flagship template SKU */
export const eastSignatureNatureCoreStaticProduct: StaticTourProductRegistration = {
  slug: "east-signature-nature-core",
  title: "East Jeju Volcano, Coast & Folk Village Small Group Day Tour",
  subtitle: "Stone to coast. Crater to garden to village.",
  region: "East Jeju",
  duration: "8 hrs",
  stopsCount: 6,
  rating: 4.8,
  reviewCount: 127,
  badges: ["First-Time Friendly", "East Jeju"],
  heroImage: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80",
  thumbnail: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80",
  priceLabel: "From $58 / person",
  shortCardDescription:
    "A structured East Jeju day that begins with stone and volcanic context, opens to the coast, peaks at Seongsan, and finishes with garden calm and village texture.",
  listPriceUsd: EAST_SIGNATURE_LIST_PRICE_USD,
  compareAtPriceUsd: EAST_SIGNATURE_COMPARE_AT_PRICE_USD,
  maxGroupSize: 8,
};

type CatalogCardJsonShape = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: readonly string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
};

const jejuCc = jejuGrandPage.catalog_card as CatalogCardJsonShape;

/** Jeju Grand Highlights Loop — `jeju-grand-highlights-loop.en-1.json` catalog_card 와 동일 */
export const jejuGrandHighlightsLoopStaticProduct: StaticTourProductRegistration = {
  slug: jejuCc.slug,
  title: jejuCc.title,
  subtitle: jejuCc.subtitle,
  region: jejuCc.region,
  duration: jejuCc.duration,
  stopsCount: jejuCc.stopsCount,
  rating: jejuCc.rating,
  reviewCount: jejuCc.reviewCount,
  badges: jejuCc.badges,
  heroImage: jejuCc.heroImage,
  thumbnail: jejuCc.thumbnail,
  priceLabel: jejuCc.priceLabel,
  shortCardDescription: jejuCc.shortCardDescription,
  listPriceUsd: 78,
  compareAtPriceUsd: 95,
  maxGroupSize: 8,
};

const southwestCc = southwestPage.catalog_card as CatalogCardJsonShape;

/** Jeju Southwest Hallasan · O'Sulloc · Aewol — `southwest-hallasan-osulloc-aewol.en.json` catalog_card 와 동일 */
export const southwestHallasanOsullocAewolStaticProduct: StaticTourProductRegistration = {
  slug: southwestCc.slug,
  title: southwestCc.title,
  subtitle: southwestCc.subtitle,
  region: southwestCc.region,
  duration: southwestCc.duration,
  stopsCount: southwestCc.stopsCount,
  rating: southwestCc.rating,
  reviewCount: southwestCc.reviewCount,
  badges: southwestCc.badges,
  heroImage: southwestCc.heroImage,
  thumbnail: southwestCc.thumbnail,
  priceLabel: southwestCc.priceLabel,
  shortCardDescription: southwestCc.shortCardDescription,
  listPriceUsd: 58,
  maxGroupSize: 8,
};

export const STATIC_TOUR_PRODUCTS: readonly StaticTourProductRegistration[] = [
  eastSignatureNatureCoreStaticProduct,
  jejuGrandHighlightsLoopStaticProduct,
  southwestHallasanOsullocAewolStaticProduct,
];

export function getStaticTourProductBySlug(slug: string): StaticTourProductRegistration | undefined {
  return STATIC_TOUR_PRODUCTS.find((p) => p.slug === slug);
}
