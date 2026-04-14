import { cookies } from "next/headers";

/** `tour_product_pages.locale` — middleware `NEXT_LOCALE`와 맞춤 (zh-CN → zh). */
export type TourProductPageLocale = "en" | "ko" | "zh" | "zh-TW" | "es" | "ja";

const ALLOWED = new Set<TourProductPageLocale>(["en", "ko", "zh", "zh-TW", "es", "ja"]);

export async function resolveTourProductDbLocale(): Promise<TourProductPageLocale> {
  try {
    const jar = await cookies();
    const raw = jar.get("NEXT_LOCALE")?.value?.trim();
    if (raw === "zh-CN") return "zh";
    if (raw && ALLOWED.has(raw as TourProductPageLocale)) return raw as TourProductPageLocale;
  } catch {
    // cookies() unavailable in some static contexts
  }
  return "en";
}
