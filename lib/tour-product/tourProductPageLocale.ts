/** `tour_product_pages.locale` — middleware `NEXT_LOCALE`와 맞춤 (zh-CN → zh). */
export type TourProductPageLocale =
  | "en"
  | "ko"
  | "zh"
  | "zh-TW"
  | "es"
  | "ja"
  | "fr"
  | "de"
  | "it"
  | "ru";

export const TOUR_PRODUCT_PAGE_LOCALES = new Set<TourProductPageLocale>([
  "en",
  "ko",
  "zh",
  "zh-TW",
  "es",
  "ja",
  "fr",
  "de",
  "it",
  "ru",
]);

/**
 * The 6 locales that predate the fr/de/it/ru expansion.
 *
 * Two kinds of table are keyed by this rather than by the full content locale:
 *   1. hand-written per-locale copy (chatbot labels, assistant blurbs), and
 *   2. the static JSON bundle registry, which has files for these 6 only.
 *
 * Page CONTENT is unaffected — it comes from `tour_product_pages`, which has
 * real rows for all 10 locales. These tables are the surrounding chrome, and
 * fr/de/it/ru read the English column via {@link toTourProductBaseLocale}.
 */
export type TourProductBaseLocale = "en" | "ko" | "zh" | "zh-TW" | "es" | "ja";

export const TOUR_PRODUCT_BASE_LOCALES = new Set<TourProductBaseLocale>([
  "en",
  "ko",
  "zh",
  "zh-TW",
  "es",
  "ja",
]);

/**
 * Narrows a content locale to one the 6-column tables actually have.
 *
 * 🔴 Do NOT use this on the product page's own content path — that would undo
 * the fr/de/it/ru launch. It is only for tables that were authored with 6
 * columns and whose copy the translated pages do not consume.
 */
export function toTourProductBaseLocale(locale: string): TourProductBaseLocale {
  return TOUR_PRODUCT_BASE_LOCALES.has(locale as TourProductBaseLocale)
    ? (locale as TourProductBaseLocale)
    : "en";
}

/**
 * Narrows any site UI `Locale` (10 locales) down to a `TourProductPageLocale`.
 *
 * Since 2026-08-08 all 10 site locales have tour content, so this is now an
 * identity for supported locales and an `en` fallback for anything else.
 *
 * Client-safe (no `next/headers`) — import this from client components
 * instead of `resolveTourProductDbLocale.ts`, which pulls in `cookies()`.
 */
export function toTourProductPageLocale(locale: string): TourProductPageLocale {
  return TOUR_PRODUCT_PAGE_LOCALES.has(locale as TourProductPageLocale)
    ? (locale as TourProductPageLocale)
    : "en";
}
