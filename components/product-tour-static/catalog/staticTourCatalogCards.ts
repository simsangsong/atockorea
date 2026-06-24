/**
 * Lean catalog-card registry — sources its data from the AUTO-GENERATED
 * `catalogCards.generated.ts` (≈275KB), NOT the full per-slug detail JSON
 * (≈25MB).
 *
 * Use this module from any home / preview / recommendation surface that
 * only needs the catalog_card fields. The heavy
 * `staticTourProductRegistry.ts` should remain reserved for the detail
 * page (`/tour-product/[slug]`) and admin tooling that need the full
 * detail payload.
 *
 * API parity: this module re-exports `StaticTourProductRegistration` +
 * `getStaticTourProductBySlug` + `listStaticTourProducts` so existing
 * callers can migrate by changing only the import path.
 */

import type { TourProductPageLocale as Locale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";
import {
  SLIM_CATALOG_PAGES_BY_LOCALE,
  SLIM_CATALOG_SLUG_ORDER,
  type SlimCatalogPage,
} from "./catalogCards.generated";

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
  listPriceUsd: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

export const STATIC_TOUR_PRODUCT_DETAIL_PREFIX = "/tour-product" as const;

export function hrefStaticTourProductDetail(slug: string): string {
  return `${STATIC_TOUR_PRODUCT_DETAIL_PREFIX}/${slug}`;
}

/** Locale-invariant per-slug overrides — kept in sync with the heavy registry. */
type SlugOverride = {
  listPriceUsd?: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

const SLUG_OVERRIDES: Record<string, SlugOverride> = {
  "east-signature-nature-core": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-grand-highlights-loop": { listPriceUsd: 79, compareAtPriceUsd: 89, maxGroupSize: 8 },
  "southwest-hallasan-osulloc-aewol": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "busan-gyeongju-unesco-legacy-tour-national-museum": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "busan-small-group-sightseeing-tour-cruise-passengers": { listPriceUsd: 79, compareAtPriceUsd: 85, maxGroupSize: 8 },
  "busan-top-attractions-day-tour": { listPriceUsd: 29, compareAtPriceUsd: 41, maxGroupSize: 12 },
  "from-busan-gyeongju-ancient-capital-day-tour": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "from-incheon-seoul-day-tour-cruise-guests": { listPriceUsd: 69, compareAtPriceUsd: 76, maxGroupSize: 8 },
  "incheon-seoul-private-car-shore-excursion-cruise": { listPriceUsd: 419, maxGroupSize: 12 },
  "jeju-cherry-blossom-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-cruise-shore-excursion-bus-tour": { listPriceUsd: 52, compareAtPriceUsd: 59 },
  "jeju-cruise-shore-excursion-small-group-tour": { listPriceUsd: 79, compareAtPriceUsd: 85, maxGroupSize: 8 },
  "jeju-eastern-unesco-spots-day-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-southwest-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-southern-top-unesco-spots-tour": { listPriceUsd: 49, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "jeju-west-south-full-day-authentic-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "pocheon-sanjeong-lake-herb-island-art-valley": { listPriceUsd: 49, compareAtPriceUsd: 62, maxGroupSize: 8 },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { listPriceUsd: 419, maxGroupSize: 15 },
  "seoul-private-nami-morning-calm-petite-france": { listPriceUsd: 189 },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": { listPriceUsd: 52, compareAtPriceUsd: 58, maxGroupSize: 8 },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { listPriceUsd: 49, compareAtPriceUsd: 57, maxGroupSize: 8 },
  "seoul-suburbs-private-chartered-car-10hr": { listPriceUsd: 179, maxGroupSize: 13 },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { listPriceUsd: 59, compareAtPriceUsd: 66, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { listPriceUsd: 52, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { listPriceUsd: 47, compareAtPriceUsd: 54, maxGroupSize: 8 },
};

function parseListPriceUsd(page: SlimCatalogPage | undefined): number {
  if (!page) return 0;
  const amountLabel = page.price?.amountLabel ?? "";
  if (amountLabel) {
    const n = Number(amountLabel.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const priceLabel = page.catalog_card.priceLabel ?? "";
  const m = priceLabel.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
}

function buildRegistration(slug: string, locale: Locale): StaticTourProductRegistration | null {
  const enMap = SLIM_CATALOG_PAGES_BY_LOCALE.en ?? {};
  const localeMap = SLIM_CATALOG_PAGES_BY_LOCALE[locale] ?? enMap;
  const localePage = localeMap[slug] ?? enMap[slug];
  if (!localePage) return null;
  const cc = localePage.catalog_card;
  const override = SLUG_OVERRIDES[slug] ?? {};
  return {
    slug: cc.slug,
    title: cc.title,
    subtitle: cc.subtitle,
    region: cc.region,
    duration: cc.duration,
    stopsCount: cc.stopsCount,
    rating: cc.rating,
    reviewCount: cc.reviewCount,
    badges: cc.badges,
    heroImage: cc.heroImage,
    thumbnail: cc.thumbnail,
    priceLabel: cc.priceLabel,
    shortCardDescription: cc.shortCardDescription,
    listPriceUsd: override.listPriceUsd ?? parseListPriceUsd(enMap[slug]),
    compareAtPriceUsd: override.compareAtPriceUsd,
    maxGroupSize: override.maxGroupSize,
  };
}

const PER_LOCALE_PRODUCTS: Record<Locale, readonly StaticTourProductRegistration[]> = {
  en: SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "en")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
  ko: SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "ko")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
  zh: SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "zh")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
  "zh-TW": SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "zh-TW")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
  es: SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "es")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
  ja: SLIM_CATALOG_SLUG_ORDER.map((s) => buildRegistration(s, "ja")).filter(
    (r): r is StaticTourProductRegistration =>
      r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
  ),
};

export const STATIC_TOUR_PRODUCTS: readonly StaticTourProductRegistration[] = PER_LOCALE_PRODUCTS.en;

export function listStaticTourProducts(locale: Locale = "en"): readonly StaticTourProductRegistration[] {
  return PER_LOCALE_PRODUCTS[locale] ?? PER_LOCALE_PRODUCTS.en;
}

export function getStaticTourProductBySlug(
  slug: string,
  locale: Locale = "en",
): StaticTourProductRegistration | undefined {
  return listStaticTourProducts(locale).find((p) => p.slug === slug);
}
