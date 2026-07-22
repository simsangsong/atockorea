import { cookies } from "next/headers";

/** `tour_product_pages.locale` — middleware `NEXT_LOCALE`와 맞춤 (zh-CN → zh). */
export type TourProductPageLocale = "en" | "ko" | "zh" | "zh-TW" | "es" | "ja";

const ALLOWED = new Set<TourProductPageLocale>(["en", "ko", "zh", "zh-TW", "es", "ja"]);

function normalize(raw: string | undefined | null): TourProductPageLocale | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "zh-CN") return "zh";
  if (ALLOWED.has(trimmed as TourProductPageLocale)) return trimmed as TourProductPageLocale;
  return null;
}

/**
 * Narrows any site UI `Locale` (10 locales) down to a `TourProductPageLocale`
 * (6 locales — tour catalog/content translation hasn't reached fr/de/it/ru
 * yet). Falls back to `en` for locales without translated tour content.
 */
export function toTourProductPageLocale(locale: string): TourProductPageLocale {
  return ALLOWED.has(locale as TourProductPageLocale) ? (locale as TourProductPageLocale) : "en";
}

/**
 * Resolves the locale to use for tour product pages.
 *
 * Order of precedence:
 *   1. Explicit `hint` argument — used by the admin preview iframe and other
 *      contexts that need to force a specific locale via `?locale=xx` query.
 *   2. `NEXT_LOCALE` cookie set by the language switcher / middleware.
 *   3. `en` fallback.
 *
 * `hint` accepts the same values as the cookie (en, ko, zh, zh-TW, es, ja, zh-CN).
 */
export async function resolveTourProductDbLocale(
  hint?: string | string[] | null,
): Promise<TourProductPageLocale> {
  // 1) Explicit query/header hint (preview, A/B tests, etc.)
  const hintStr = Array.isArray(hint) ? hint[0] : hint;
  const fromHint = normalize(hintStr);
  if (fromHint) return fromHint;

  // 2) Cookie set by the language switcher
  try {
    const jar = await cookies();
    const fromCookie = normalize(jar.get("NEXT_LOCALE")?.value);
    if (fromCookie) return fromCookie;
  } catch {
    // cookies() unavailable in some static contexts
  }

  // 3) Default
  return "en";
}
