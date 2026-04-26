/**
 * Slug → per-locale `tour_product_full_page_v1` JSON bundle registry.
 *
 * The catch-all `app/tour-product/[slug]/page.tsx` reads from here to resolve
 * the static JSON fallback when Supabase is unavailable or `detail_payload` is
 * incomplete. New small-group tours register themselves by adding:
 *
 *   1. `<slug>.{en,ko,ja,zh,zh-TW,es}.json` files next to the slug folder
 *   2. An entry in `STATIC_TOUR_PRODUCT_BUNDLES` below
 *   3. (optional) A catalog_card row in `staticTourProductRegistry.ts`
 *
 * No per-slug React component or page.tsx is needed.
 */

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { TourProductFullPageJson } from "./tourProductFullPageJsonTypes";

import jejuGrandEn from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import jejuGrandKo from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.ko.json";
import jejuGrandJa from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.ja.json";
import jejuGrandZh from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh.json";
import jejuGrandZhTW from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh-TW.json";
import jejuGrandEs from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.es.json";
import southwestEn from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";
import southJejuClassicBusEn from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.en.json";
import southJejuClassicBusKo from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.ko.json";
import southJejuClassicBusJa from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.ja.json";
import southJejuClassicBusZh from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.zh.json";
import southJejuClassicBusZhTW from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.zh-TW.json";
import southJejuClassicBusEs from "@/components/product-tour-static/south-jeju-classic-bus-tour/south-jeju-classic-bus-tour.es.json";
import southwestJejuScenicBusEn from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.en.json";
import southwestJejuScenicBusKo from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.ko.json";
import southwestJejuScenicBusJa from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.ja.json";
import southwestJejuScenicBusZh from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.zh.json";
import southwestJejuScenicBusZhTW from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.zh-TW.json";
import southwestJejuScenicBusEs from "@/components/product-tour-static/southwest-jeju-scenic-bus-tour/southwest-jeju-scenic-bus-tour.es.json";
import eastJejuClassicBusEn from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.en.json";
import eastJejuClassicBusKo from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.ko.json";
import eastJejuClassicBusJa from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.ja.json";
import eastJejuClassicBusZh from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.zh.json";
import eastJejuClassicBusZhTW from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.zh-TW.json";
import eastJejuClassicBusEs from "@/components/product-tour-static/east-jeju-classic-bus-tour/east-jeju-classic-bus-tour.es.json";
import jejuCruiseShoreBusEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json";
import jejuCruiseShoreBusKo from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ko.json";
import jejuCruiseShoreBusJa from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ja.json";
import jejuCruiseShoreBusZh from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh.json";
import jejuCruiseShoreBusZhTW from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh-TW.json";
import jejuCruiseShoreBusEs from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.es.json";
import jejuCruiseShoreSmallGroupEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json";
import jejuCruiseShoreSmallGroupKo from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ko.json";
import jejuCruiseShoreSmallGroupJa from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ja.json";
import jejuCruiseShoreSmallGroupZh from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh.json";
import jejuCruiseShoreSmallGroupZhTW from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh-TW.json";
import jejuCruiseShoreSmallGroupEs from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.es.json";
import eastSignatureEn from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json";
import eastSignatureKo from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.ko.json";
import eastSignatureJa from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.ja.json";
import eastSignatureZh from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.zh.json";
import eastSignatureZhTW from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.zh-TW.json";
import eastSignatureEs from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.es.json";
import busanTopAttractionsEn from "@/components/product-tour-static/busan-top-attractions-authentic-one-day-tour/busan-top-attractions-authentic-one-day-tour.en.json";
import busanShoreExcursionCruiseEn from "@/components/product-tour-static/busan-city-tour-shore-excursion-cruise-guests/busan-city-tour-shore-excursion-cruise-guests.en.json";

export type TourProductLocaleBundle = Partial<Record<TourProductPageLocale, TourProductFullPageJson>> & {
  en: TourProductFullPageJson;
};

/**
 * Canonical small-group tour bundles. `en` is required so all locales have a
 * fallback; additional locales are merged only when present.
 *
 * `east-signature-nature-core` is registered for shared loaders (e.g. AI assistant
 * context). The dedicated `app/tour-product/east-signature-nature-core/page.tsx`
 * still takes routing precedence over the catch-all `[slug]` route.
 */
/**
 * Cast helper — JSON imports come through as deeply-narrowed tuple literals
 * (via TS's JSON import narrowing); the authoring-side contract only cares
 * about the structural shape, so we bridge through `unknown`.
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

export const STATIC_TOUR_PRODUCT_BUNDLES: Record<string, TourProductLocaleBundle> = {
  "east-signature-nature-core": {
    en: asBundleEntry(eastSignatureEn),
    ko: asBundleEntry(eastSignatureKo),
    ja: asBundleEntry(eastSignatureJa),
    zh: asBundleEntry(eastSignatureZh),
    "zh-TW": asBundleEntry(eastSignatureZhTW),
    es: asBundleEntry(eastSignatureEs),
  },
  "jeju-grand-highlights-loop": {
    en: asBundleEntry(jejuGrandEn),
    ko: asBundleEntry(jejuGrandKo),
    ja: asBundleEntry(jejuGrandJa),
    zh: asBundleEntry(jejuGrandZh),
    "zh-TW": asBundleEntry(jejuGrandZhTW),
    es: asBundleEntry(jejuGrandEs),
  },
  "southwest-hallasan-osulloc-aewol": {
    en: asBundleEntry(southwestEn),
  },
  "south-jeju-classic-bus-tour": {
    en: asBundleEntry(southJejuClassicBusEn),
    ko: asBundleEntry(southJejuClassicBusKo),
    ja: asBundleEntry(southJejuClassicBusJa),
    zh: asBundleEntry(southJejuClassicBusZh),
    "zh-TW": asBundleEntry(southJejuClassicBusZhTW),
    es: asBundleEntry(southJejuClassicBusEs),
  },
  "southwest-jeju-scenic-bus-tour": {
    en: asBundleEntry(southwestJejuScenicBusEn),
    ko: asBundleEntry(southwestJejuScenicBusKo),
    ja: asBundleEntry(southwestJejuScenicBusJa),
    zh: asBundleEntry(southwestJejuScenicBusZh),
    "zh-TW": asBundleEntry(southwestJejuScenicBusZhTW),
    es: asBundleEntry(southwestJejuScenicBusEs),
  },
  "east-jeju-classic-bus-tour": {
    en: asBundleEntry(eastJejuClassicBusEn),
    ko: asBundleEntry(eastJejuClassicBusKo),
    ja: asBundleEntry(eastJejuClassicBusJa),
    zh: asBundleEntry(eastJejuClassicBusZh),
    "zh-TW": asBundleEntry(eastJejuClassicBusZhTW),
    es: asBundleEntry(eastJejuClassicBusEs),
  },
  "jeju-cruise-shore-excursion-bus-tour": {
    en: asBundleEntry(jejuCruiseShoreBusEn),
    ko: asBundleEntry(jejuCruiseShoreBusKo),
    ja: asBundleEntry(jejuCruiseShoreBusJa),
    zh: asBundleEntry(jejuCruiseShoreBusZh),
    "zh-TW": asBundleEntry(jejuCruiseShoreBusZhTW),
    es: asBundleEntry(jejuCruiseShoreBusEs),
  },
  "jeju-cruise-shore-excursion-small-group-tour": {
    en: asBundleEntry(jejuCruiseShoreSmallGroupEn),
    ko: asBundleEntry(jejuCruiseShoreSmallGroupKo),
    ja: asBundleEntry(jejuCruiseShoreSmallGroupJa),
    zh: asBundleEntry(jejuCruiseShoreSmallGroupZh),
    "zh-TW": asBundleEntry(jejuCruiseShoreSmallGroupZhTW),
    es: asBundleEntry(jejuCruiseShoreSmallGroupEs),
  },
  "busan-top-attractions-authentic-one-day-tour": {
    en: asBundleEntry(busanTopAttractionsEn),
  },
  "busan-city-tour-shore-excursion-cruise-guests": {
    en: asBundleEntry(busanShoreExcursionCruiseEn),
  },
};

/**
 * @returns The locale-specific bundle, falling back to `en` if missing.
 *          `null` when the slug is not registered.
 */
export function getStaticTourProductFullPageJson(
  slug: string,
  locale: TourProductPageLocale,
): TourProductFullPageJson | null {
  const bundle = STATIC_TOUR_PRODUCT_BUNDLES[slug];
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
