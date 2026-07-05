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
 *
 * ⚠ Client-bundle note (D1, 2026-07-05): importing this module pulls ALL SIX
 * locales (~60KB gz) into the chunk. That's fine on the server and tolerable
 * where it's already shipped (home), but new client surfaces should prefer
 * `staticTourCatalogCards.lazy.ts` (EN inline + active locale lazy-loaded).
 * The registration builder + SLUG_OVERRIDES live in
 * `catalogRegistrationBuilder.ts` — shared by both paths, never duplicated.
 */

import type { TourProductPageLocale as Locale } from "@/lib/tour-product/resolveTourProductDbLocale";
import {
  SLIM_CATALOG_PAGES_BY_LOCALE,
  SLIM_CATALOG_SLUG_ORDER,
} from "./catalogCards.generated";
import {
  buildCatalogRegistrations,
  type StaticTourProductRegistration,
} from "./catalogRegistrationBuilder";

export type { StaticTourProductRegistration };

export const STATIC_TOUR_PRODUCT_DETAIL_PREFIX = "/tour-product" as const;

export function hrefStaticTourProductDetail(slug: string): string {
  return `${STATIC_TOUR_PRODUCT_DETAIL_PREFIX}/${slug}`;
}

const EN_MAP = SLIM_CATALOG_PAGES_BY_LOCALE.en ?? {};

function buildLocale(locale: string): readonly StaticTourProductRegistration[] {
  return buildCatalogRegistrations(
    SLIM_CATALOG_SLUG_ORDER,
    SLIM_CATALOG_PAGES_BY_LOCALE[locale] ?? EN_MAP,
    EN_MAP,
  );
}

const PER_LOCALE_PRODUCTS: Record<Locale, readonly StaticTourProductRegistration[]> = {
  en: buildLocale("en"),
  ko: buildLocale("ko"),
  zh: buildLocale("zh"),
  "zh-TW": buildLocale("zh-TW"),
  es: buildLocale("es"),
  ja: buildLocale("ja"),
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
