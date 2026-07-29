import { SLIM_CATALOG_SLUG_ORDER } from "@/components/product-tour-static/catalog/catalogCards.generated";
import { createServerClient } from "@/lib/supabase";
import { loadTourProductCardMediaBySlug } from "@/lib/tour-product/resolveTourProductCardMedia.server";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import ToursListClient from "./ToursListClient";

/**
 * Shared server body for the catalogue page, rendered by both the canonical
 * EN route (`/tours/list`) and the localized routes
 * (`app/[locale]/tours/list`). Mirrors the T1 tour-product pattern: the
 * locale is a ROUTE input, never `cookies()` — reading the cookie here is
 * what forced per-request dynamic SSR (CDN MISS on every bottom-nav tap,
 * 0.6~1.5s TTFB in the 2026-07-04 baseline).
 *
 * The admin-v2 thumbnail seed still happens server-side (the 2026-05-25
 * "static thumbnail flashes then flips" report), but at ISR-regeneration time
 * instead of per request; admin saves revalidate these paths immediately
 * (see `app/api/admin/tour-product-pages/[slug]/route.ts`).
 */

/** URL prefixes served by `app/[locale]/tours/list` (en lives at the bare path). */
export const TOURS_LIST_URL_LOCALES = ["ko", "ja", "es", "zh-CN", "zh-TW"] as const;

/** `NEXT_LOCALE` / URL locale → `tour_product_pages.locale` (zh-CN rows are stored as "zh"). */
export function toursListDbLocaleFromUrlLocale(urlLocale: string): string | null {
  if (urlLocale === "zh-CN") return "zh";
  if ((TOURS_LIST_URL_LOCALES as readonly string[]).includes(urlLocale)) {
    return urlLocale;
  }
  return null;
}

async function loadInitialMediaBySlug(locale: string): Promise<TourProductCardMediaMap> {
  try {
    const supabase = createServerClient();
    return await loadTourProductCardMediaBySlug(
      supabase,
      SLIM_CATALOG_SLUG_ORDER as readonly string[],
      locale,
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[/tours/list] initial media prefetch failed:", (e as Error)?.message);
    }
    // Supabase failure is swallowed — the client still re-fetches via
    // `/api/tour-product-card-media`, so the worst case degrades back to the
    // old flashing behaviour rather than blocking the page.
    return {};
  }
}

export async function ToursListPageBody({ locale }: { locale: string }) {
  const initialMediaBySlug = await loadInitialMediaBySlug(locale);
  return <ToursListClient initialMediaBySlug={initialMediaBySlug} />;
}
