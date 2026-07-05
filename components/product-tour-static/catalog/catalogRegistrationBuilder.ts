/**
 * Pure catalog-registration builder — extracted from
 * `staticTourCatalogCards.ts` (D1, 2026-07-05) so the lazy per-locale client
 * path (`staticTourCatalogCards.lazy.ts`) can build registrations WITHOUT
 * importing the combined 6-locale generated data module.
 *
 * ⚠ SLUG_OVERRIDES lives HERE and only here — it is a real pricing surface
 * (see tour price/type change runbook). Do not copy it into other modules.
 */

import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";
import type { SlimCatalogPage } from "./catalogCards.generated";

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

/** Locale-invariant per-slug overrides — kept in sync with the heavy registry. */
type SlugOverride = {
  listPriceUsd?: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

const SLUG_OVERRIDES: Record<string, SlugOverride> = {
  "east-signature-nature-core": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-grand-highlights-loop": { listPriceUsd: 93, maxGroupSize: 8 },
  "southwest-hallasan-osulloc-aewol": { listPriceUsd: 49, maxGroupSize: 8 },
  "busan-gyeongju-unesco-legacy-tour-national-museum": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  // Klook prep 2026-06-29: +$5 sale price, discount REMOVE (compareAtPriceUsd dropped).
  "busan-small-group-sightseeing-tour-cruise-passengers": { listPriceUsd: 84, maxGroupSize: 8 },
  "busan-top-attractions-day-tour": { listPriceUsd: 34, maxGroupSize: 12 },
  "from-busan-gyeongju-ancient-capital-day-tour": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "from-incheon-seoul-day-tour-cruise-guests": { listPriceUsd: 69, compareAtPriceUsd: 76, maxGroupSize: 8 },
  "incheon-seoul-private-car-shore-excursion-cruise": { listPriceUsd: 424, maxGroupSize: 12 },
  "jeju-cherry-blossom-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-cruise-shore-excursion-bus-tour": { listPriceUsd: 59 },
  "jeju-cruise-shore-excursion-small-group-tour": { listPriceUsd: 77, maxGroupSize: 8 },
  "jeju-eastern-unesco-spots-day-tour": { listPriceUsd: 49, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-east-route": { listPriceUsd: 64, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-southwest-route": { listPriceUsd: 64, maxGroupSize: 8 },
  "jeju-southern-top-unesco-spots-tour": { listPriceUsd: 49, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-west-south-full-day-authentic-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "pocheon-sanjeong-lake-herb-island-art-valley": { listPriceUsd: 54, maxGroupSize: 8 },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { listPriceUsd: 419, maxGroupSize: 15 },
  "seoul-private-nami-morning-calm-petite-france": { listPriceUsd: 194 },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": { listPriceUsd: 53, compareAtPriceUsd: 58, maxGroupSize: 8 },
  "seoul-seoraksan-nami-island-morning-calm-day-tour": { listPriceUsd: 71, maxGroupSize: 8 },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { listPriceUsd: 49, compareAtPriceUsd: 57, maxGroupSize: 8 },
  "seoul-suburbs-private-chartered-car-10hr": { listPriceUsd: 184, maxGroupSize: 13 },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { listPriceUsd: 60, compareAtPriceUsd: 66, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { listPriceUsd: 53, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { listPriceUsd: 51, compareAtPriceUsd: 54, maxGroupSize: 8 },
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

export function buildRegistrationFromMaps(
  slug: string,
  localeMap: Record<string, SlimCatalogPage>,
  enMap: Record<string, SlimCatalogPage>,
): StaticTourProductRegistration | null {
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

/** Build the full consumer-visible list for one locale (blocked slugs filtered). */
export function buildCatalogRegistrations(
  slugOrder: readonly string[],
  localeMap: Record<string, SlimCatalogPage>,
  enMap: Record<string, SlimCatalogPage>,
): readonly StaticTourProductRegistration[] {
  return slugOrder
    .map((slug) => buildRegistrationFromMaps(slug, localeMap, enMap))
    .filter(
      (r): r is StaticTourProductRegistration =>
        r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
    );
}
