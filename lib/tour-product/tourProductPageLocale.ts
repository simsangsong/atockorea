/** `tour_product_pages.locale` — middleware `NEXT_LOCALE`와 맞춤 (zh-CN → zh). */
export type TourProductPageLocale = "en" | "ko" | "zh" | "zh-TW" | "es" | "ja";

export const TOUR_PRODUCT_PAGE_LOCALES = new Set<TourProductPageLocale>([
  "en",
  "ko",
  "zh",
  "zh-TW",
  "es",
  "ja",
]);

/**
 * Narrows any site UI `Locale` (10 locales) down to a `TourProductPageLocale`
 * (6 locales — tour catalog/content translation hasn't reached fr/de/it/ru
 * yet). Falls back to `en` for locales without translated tour content.
 *
 * Client-safe (no `next/headers`) — import this from client components
 * instead of `resolveTourProductDbLocale.ts`, which pulls in `cookies()`.
 */
export function toTourProductPageLocale(locale: string): TourProductPageLocale {
  return TOUR_PRODUCT_PAGE_LOCALES.has(locale as TourProductPageLocale)
    ? (locale as TourProductPageLocale)
    : "en";
}
