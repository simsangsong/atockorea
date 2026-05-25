import { cookies } from "next/headers";
import { SLIM_CATALOG_SLUG_ORDER } from "@/components/product-tour-static/catalog/catalogCards.generated";
import { createServerClient } from "@/lib/supabase";
import { loadTourProductCardMediaBySlug } from "@/lib/tour-product/resolveTourProductCardMedia.server";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import ToursListClient from "./ToursListClient";

/**
 * Server wrapper for the catalogue page. Reads the locale cookie, pre-resolves
 * admin v2 thumbnails for every catalog slug, and hands the map to the client.
 *
 * Why split? `ToursListClient` is `'use client'` and uses the static catalog
 * to seed `<ShelvesContainer>` and the flat-grid view. Without an SSR
 * pre-fetch the first render shows the build-time static thumbnail and then
 * flips to the admin-saved image once the client effect resolves
 * (user-visible flash reported 2026-05-25).
 *
 * Supabase failure is swallowed — the client still re-fetches via
 * `/api/tour-product-card-media`, so the worst case degrades back to the
 * old flashing behaviour rather than blocking the page.
 */
const SUPPORTED_LOCALES = new Set(["en", "ko", "zh", "zh-TW", "ja", "es"]);

function resolveLocaleFromCookie(value: string | undefined): string {
  if (!value) return "en";
  if (value === "zh-CN") return "zh";
  return SUPPORTED_LOCALES.has(value) ? value : "en";
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
    return {};
  }
}

export default async function ToursListPage() {
  const cookieStore = await cookies();
  const locale = resolveLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const initialMediaBySlug = await loadInitialMediaBySlug(locale);
  return <ToursListClient initialMediaBySlug={initialMediaBySlug} />;
}
