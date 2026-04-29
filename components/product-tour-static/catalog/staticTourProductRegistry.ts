/**
 * Static catalog registry — one card per registered tour-product slug.
 *
 * v17 batch: each entry is derived directly from the slug's
 * `<slug>.en.json#catalog_card`, with a small per-slug override map for
 * `listPriceUsd` (used by checkout / sticky-bar fallbacks) and optional
 * `compareAtPriceUsd` / `maxGroupSize` (display-only).
 *
 * Detail page: `/tour-product/[slug]` (catch-all). Consumers: home v2 best-match
 * preview, /match page, sitemap.
 */

import busanGyeongjuUnescoLegacy from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json";
import busanPlumCherryBlossom from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json";
import busanPrivateCarCharterCruiseShore from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json";
import busanSmallGroupSightseeingCruise from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json";
import busanSpringCherryBlossomGyeongju from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json";
import busanTopAttractionsDay from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.en.json";
import eastSignaturePage from "../east-signature-nature-core/east-signature-nature-core.en.json";
import fromBusanGyeongjuAncientCapital from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.en.json";
import fromIncheonSeoulDayCruise from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json";
import incheonSeoulPrivateCarShoreCruise from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json";
import jejuCherryBlossomEast from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json";
import jejuCruiseShoreBus from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json";
import jejuCruiseShoreSmallGroup from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json";
import jejuEasternUnescoSpots from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json";
import jejuGrandPage from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import jejuHydrangeaFestivalEast from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json";
import jejuHydrangeaFestivalSouthwest from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json";
import jejuIslandPrivateCarCharter from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json";
import jejuSouthernTopUnescoSpots from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json";
import jejuWestSouthFullDayAuthentic from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json";
import jejuWinterSouthwestTangerine from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.en.json";
import pocheonSanjeongLakeHerbIsland from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json";
import seoulDmzPrivate3rdTunnel from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json";
import seoulPrivateNamiMorningCalm from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json";
import seoulSeoraksanSokchoBeach from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json";
import seoulSuburbsPrivateCharteredCar from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json";
import seoulSuwonHwaseongFolkVillage from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.en.json";
import seoulSuwonHwaseongGwangmyeongCave from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json";
import seoulSuwonHwaseongWaujeongsa from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json";
import southwestHallasanOsullocAewol from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";

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

type PageJsonShape = {
  catalog_card: CatalogCardJsonShape;
  price?: { amountLabel?: unknown };
};

/**
 * Parse `listPriceUsd` from authoring JSON. Prefer `price.amountLabel`
 * ("78"), fall back to digits in `catalog_card.priceLabel`
 * ("From US$78 per person"). Returns 0 when nothing parseable is present
 * (cruise-shore / TBD pricing) — sticky bar / checkout treats 0 as
 * "confirm at booking".
 */
function parseListPriceUsd(page: PageJsonShape): number {
  const amountLabel = page.price && typeof page.price.amountLabel === "string" ? page.price.amountLabel : "";
  if (amountLabel) {
    const n = Number(amountLabel.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const priceLabel = page.catalog_card?.priceLabel ?? "";
  const m = priceLabel.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
}

function registrationFromCatalogCard(
  page: PageJsonShape,
  opts: { listPriceUsd?: number; compareAtPriceUsd?: number; maxGroupSize?: number } = {},
): StaticTourProductRegistration {
  const cc = page.catalog_card;
  const listPriceUsd = opts.listPriceUsd ?? parseListPriceUsd(page);
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
    listPriceUsd,
    compareAtPriceUsd: opts.compareAtPriceUsd,
    maxGroupSize: opts.maxGroupSize,
  };
}

/** East Signature Nature Core — flagship template SKU */
export const eastSignatureNatureCoreStaticProduct: StaticTourProductRegistration =
  registrationFromCatalogCard(eastSignaturePage as PageJsonShape, {
    compareAtPriceUsd: 78,
    maxGroupSize: 8,
  });

export const jejuGrandHighlightsLoopStaticProduct: StaticTourProductRegistration =
  registrationFromCatalogCard(jejuGrandPage as PageJsonShape, {
    compareAtPriceUsd: 95,
    maxGroupSize: 8,
  });

export const southwestHallasanOsullocAewolStaticProduct: StaticTourProductRegistration =
  registrationFromCatalogCard(southwestHallasanOsullocAewol as PageJsonShape, {
    maxGroupSize: 8,
  });

export const STATIC_TOUR_PRODUCTS: readonly StaticTourProductRegistration[] = [
  eastSignatureNatureCoreStaticProduct,
  jejuGrandHighlightsLoopStaticProduct,
  southwestHallasanOsullocAewolStaticProduct,

  registrationFromCatalogCard(busanGyeongjuUnescoLegacy as PageJsonShape),
  registrationFromCatalogCard(busanPlumCherryBlossom as PageJsonShape),
  registrationFromCatalogCard(busanPrivateCarCharterCruiseShore as PageJsonShape),
  registrationFromCatalogCard(busanSmallGroupSightseeingCruise as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(busanSpringCherryBlossomGyeongju as PageJsonShape),
  registrationFromCatalogCard(busanTopAttractionsDay as PageJsonShape, { maxGroupSize: 12 }),
  registrationFromCatalogCard(fromBusanGyeongjuAncientCapital as PageJsonShape),
  registrationFromCatalogCard(fromIncheonSeoulDayCruise as PageJsonShape),
  registrationFromCatalogCard(incheonSeoulPrivateCarShoreCruise as PageJsonShape),
  registrationFromCatalogCard(jejuCherryBlossomEast as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuCruiseShoreBus as PageJsonShape),
  registrationFromCatalogCard(jejuCruiseShoreSmallGroup as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuEasternUnescoSpots as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuHydrangeaFestivalEast as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuHydrangeaFestivalSouthwest as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuIslandPrivateCarCharter as PageJsonShape),
  registrationFromCatalogCard(jejuSouthernTopUnescoSpots as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuWestSouthFullDayAuthentic as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(jejuWinterSouthwestTangerine as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(pocheonSanjeongLakeHerbIsland as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(seoulDmzPrivate3rdTunnel as PageJsonShape),
  registrationFromCatalogCard(seoulPrivateNamiMorningCalm as PageJsonShape),
  registrationFromCatalogCard(seoulSeoraksanSokchoBeach as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(seoulSuburbsPrivateCharteredCar as PageJsonShape),
  registrationFromCatalogCard(seoulSuwonHwaseongFolkVillage as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(seoulSuwonHwaseongGwangmyeongCave as PageJsonShape, { maxGroupSize: 8 }),
  registrationFromCatalogCard(seoulSuwonHwaseongWaujeongsa as PageJsonShape, { maxGroupSize: 8 }),
];

export function getStaticTourProductBySlug(slug: string): StaticTourProductRegistration | undefined {
  return STATIC_TOUR_PRODUCTS.find((p) => p.slug === slug);
}
