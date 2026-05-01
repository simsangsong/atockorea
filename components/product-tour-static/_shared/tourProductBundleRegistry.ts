/**
 * Slug → per-locale `tour_product_full_page_v1` JSON bundle registry.
 *
 * The catch-all `app/tour-product/[slug]/page.tsx` reads from here to resolve
 * the static JSON fallback when Supabase is unavailable or `detail_payload` is
 * incomplete. v17 batch ships EN-only — locale overlays were wiped to avoid
 * structural drift; non-EN visitors fall back to EN until re-translated.
 */

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { StaticTourProductBundleSlug } from "./tourProductBundleSlugs";
import type { TourProductFullPageJson } from "./tourProductFullPageJsonTypes";

import busanGyeongjuUnescoLegacyEn from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json";
import busanPlumCherryBlossomEn from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json";
import busanPrivateCarCharterCruiseShoreEn from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json";
import busanSmallGroupSightseeingCruiseEn from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json";
import busanSpringCherryBlossomGyeongjuEn from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json";
import busanTopAttractionsDayEn from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.en.json";
import eastSignatureEn from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json";
import fromBusanGyeongjuAncientCapitalEn from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.en.json";
import fromIncheonSeoulDayCruiseEn from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json";
import incheonSeoulPrivateCarShoreCruiseEn from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json";
import jejuCherryBlossomEastEn from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json";
import jejuCruiseShoreBusEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json";
import jejuCruiseShoreSmallGroupEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json";
import jejuEasternUnescoSpotsEn from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json";
import jejuGrandHighlightsLoopEn from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import jejuHydrangeaFestivalEastEn from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json";
import jejuHydrangeaFestivalSouthwestEn from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json";
import jejuIslandPrivateCarCharterEn from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json";
import jejuSouthernTopUnescoSpotsEn from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json";
import jejuWestSouthFullDayAuthenticEn from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json";
import jejuWinterSouthwestTangerineEn from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.en.json";
import pocheonSanjeongLakeHerbIslandEn from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json";
import seoulDmzPrivate3rdTunnelEn from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json";
import seoulPrivateNamiMorningCalmEn from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json";
import seoulSeoraksanSokchoBeachEn from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json";
import seoulSuburbsPrivateCharteredCarEn from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json";
import seoulSuwonHwaseongFolkVillageEn from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.en.json";
import seoulSuwonHwaseongGwangmyeongCaveEn from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json";
import seoulSuwonHwaseongWaujeongsaEn from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json";
import southwestHallasanOsullocAewolEn from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";

export type TourProductLocaleBundle = Partial<Record<TourProductPageLocale, TourProductFullPageJson>> & {
  en: TourProductFullPageJson;
};

/**
 * JSON imports come through as deeply-narrowed tuple literals; the authoring-side
 * contract only cares about the structural shape, so we bridge through `unknown`.
 */
function asBundleEntry(v: unknown): TourProductFullPageJson {
  return v as TourProductFullPageJson;
}

/** Shallow merge with `en` as base so locale files can override e.g. `bookingSupportSteps` only. */
function mergeFullPageWithLocaleBase(
  en: TourProductFullPageJson,
  loc: TourProductFullPageJson,
): TourProductFullPageJson {
  const merged: TourProductFullPageJson = { ...en, ...loc };
  if (loc.sectionUi && typeof loc.sectionUi === "object" && en.sectionUi && typeof en.sectionUi === "object") {
    merged.sectionUi = {
      ...(en.sectionUi as Record<string, string>),
      ...(loc.sectionUi as Record<string, string>),
    } as TourProductFullPageJson["sectionUi"];
  } else if (loc.sectionUi) {
    merged.sectionUi = loc.sectionUi as TourProductFullPageJson["sectionUi"];
  }
  return merged;
}

/**
 * v17 batch — 30 EN-only bundles. Re-translation will repopulate ko/ja/zh/zh-TW/es
 * in subsequent batches; until then non-EN visitors fall back to EN.
 */
export const STATIC_TOUR_PRODUCT_BUNDLES: Record<StaticTourProductBundleSlug, TourProductLocaleBundle> = {
  "busan-gyeongju-unesco-legacy-tour-national-museum": { en: asBundleEntry(busanGyeongjuUnescoLegacyEn) },
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": { en: asBundleEntry(busanPlumCherryBlossomEn) },
  "busan-private-car-charter-cruise-shore": { en: asBundleEntry(busanPrivateCarCharterCruiseShoreEn) },
  "busan-small-group-sightseeing-tour-cruise-passengers": { en: asBundleEntry(busanSmallGroupSightseeingCruiseEn) },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": { en: asBundleEntry(busanSpringCherryBlossomGyeongjuEn) },
  "busan-top-attractions-day-tour": { en: asBundleEntry(busanTopAttractionsDayEn) },
  "east-signature-nature-core": { en: asBundleEntry(eastSignatureEn) },
  "from-busan-gyeongju-ancient-capital-day-tour": { en: asBundleEntry(fromBusanGyeongjuAncientCapitalEn) },
  "from-incheon-seoul-day-tour-cruise-guests": { en: asBundleEntry(fromIncheonSeoulDayCruiseEn) },
  "incheon-seoul-private-car-shore-excursion-cruise": { en: asBundleEntry(incheonSeoulPrivateCarShoreCruiseEn) },
  "jeju-cherry-blossom-tour-east-route": { en: asBundleEntry(jejuCherryBlossomEastEn) },
  "jeju-cruise-shore-excursion-bus-tour": { en: asBundleEntry(jejuCruiseShoreBusEn) },
  "jeju-cruise-shore-excursion-small-group-tour": { en: asBundleEntry(jejuCruiseShoreSmallGroupEn) },
  "jeju-eastern-unesco-spots-day-tour": { en: asBundleEntry(jejuEasternUnescoSpotsEn) },
  "jeju-grand-highlights-loop": { en: asBundleEntry(jejuGrandHighlightsLoopEn) },
  "jeju-hydrangea-festival-tour-east-route": { en: asBundleEntry(jejuHydrangeaFestivalEastEn) },
  "jeju-hydrangea-festival-tour-southwest-route": { en: asBundleEntry(jejuHydrangeaFestivalSouthwestEn) },
  "jeju-island-private-car-charter-tour": { en: asBundleEntry(jejuIslandPrivateCarCharterEn) },
  "jeju-southern-top-unesco-spots-tour": { en: asBundleEntry(jejuSouthernTopUnescoSpotsEn) },
  "jeju-west-south-full-day-authentic-tour": { en: asBundleEntry(jejuWestSouthFullDayAuthenticEn) },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { en: asBundleEntry(jejuWinterSouthwestTangerineEn) },
  "pocheon-sanjeong-lake-herb-island-art-valley": { en: asBundleEntry(pocheonSanjeongLakeHerbIslandEn) },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { en: asBundleEntry(seoulDmzPrivate3rdTunnelEn) },
  "seoul-private-nami-morning-calm-petite-france": { en: asBundleEntry(seoulPrivateNamiMorningCalmEn) },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { en: asBundleEntry(seoulSeoraksanSokchoBeachEn) },
  "seoul-suburbs-private-chartered-car-10hr": { en: asBundleEntry(seoulSuburbsPrivateCharteredCarEn) },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { en: asBundleEntry(seoulSuwonHwaseongFolkVillageEn) },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { en: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveEn) },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { en: asBundleEntry(seoulSuwonHwaseongWaujeongsaEn) },
  "southwest-hallasan-osulloc-aewol": { en: asBundleEntry(southwestHallasanOsullocAewolEn) },
};

/**
 * @returns The locale-specific bundle, falling back to `en` if missing.
 *          `null` when the slug is not registered.
 */
export function getStaticTourProductFullPageJson(
  slug: string,
  locale: TourProductPageLocale,
): TourProductFullPageJson | null {
  const bundle = (STATIC_TOUR_PRODUCT_BUNDLES as Record<string, TourProductLocaleBundle | undefined>)[slug];
  if (!bundle) return null;
  if (locale === "en" || !bundle[locale]) {
    return bundle.en;
  }
  return mergeFullPageWithLocaleBase(bundle.en, bundle[locale]);
}

export function isStaticTourProductBundleRegistered(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATIC_TOUR_PRODUCT_BUNDLES, slug);
}

export function listStaticTourProductBundleSlugs(): readonly string[] {
  return Object.keys(STATIC_TOUR_PRODUCT_BUNDLES);
}
