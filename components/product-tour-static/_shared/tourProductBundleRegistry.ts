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

export type TourProductLocaleBundle = Partial<Record<TourProductPageLocale, TourProductFullPageJson>> & {
  en: TourProductFullPageJson;
};

/**
 * Canonical small-group tour bundles. `en` is required so all locales have a
 * fallback; additional locales are merged only when present.
 *
 * East Signature is intentionally NOT registered here — its slug keeps a
 * dedicated `app/tour-product/east-signature-nature-core/page.tsx` that reads
 * from in-code `staticProductData.ts` (reference / golden path).
 */
/**
 * Cast helper — JSON imports come through as deeply-narrowed tuple literals
 * (via TS's JSON import narrowing); the authoring-side contract only cares
 * about the structural shape, so we bridge through `unknown`.
 */
function asBundleEntry(v: unknown): TourProductFullPageJson {
  return v as TourProductFullPageJson;
}

export const STATIC_TOUR_PRODUCT_BUNDLES: Record<string, TourProductLocaleBundle> = {
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
  return bundle[locale] ?? bundle.en;
}

export function isStaticTourProductBundleRegistered(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATIC_TOUR_PRODUCT_BUNDLES, slug);
}

export function listStaticTourProductBundleSlugs(): readonly string[] {
  return Object.keys(STATIC_TOUR_PRODUCT_BUNDLES);
}
