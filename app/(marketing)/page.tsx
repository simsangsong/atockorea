import { HomeMainBody } from "@/components/home/HomeMainBody";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { FEATURED_PRODUCT_SLUGS } from "@/components/home/v2/sections";
import { createServerClient } from "@/lib/supabase";
import { loadTourProductCardMediaBySlug } from "@/lib/tour-product/resolveTourProductCardMedia.server";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";

/**
 * Default home (`/`). Stays a server component so we can pre-resolve the
 * Most-Loved rail thumbnails server-side and pass them down to
 * `FeaturedProductsShowcase` — without this the rail flashes the build-time
 * static catalog image and then flips to the admin-saved image once the
 * client effect resolves (user-reported 2026-05-25).
 *
 * Locale-prefixed home pages (`/ko`, `/ja`, …) stay `'use client'` for now
 * and continue to use the client-only fallback path — they don't get the
 * SSR pre-fetch. `/` is the most-visited entry, so this covers the bulk
 * of traffic.
 *
 * Phase 13 D36 — the Phase-11 `?region=` POI prefetch is REMOVED because
 * the builder is back at `/itinerary-builder` (which loads its own POIs
 * server-side). The home page no longer needs builder bytes.
 */

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Korea Day Tours Checked by Our Team",
  description: "Korea day tours checked by our team before they're listed, with routes, guides, and local operations reviewed on the ground.",
  url: "/",
  tags: ["Korea tours", "Seoul tours", "Busan tours", "Jeju tours", "day tours", "travel Korea"],
});

// ISR: `/` is always the English home — middleware redirects any non-`en`
// visitor to `/{locale}` before this route renders — so we no longer read the
// NEXT_LOCALE cookie (a dynamic API that forced per-request SSR). Removing it
// lets `/` be statically generated + revalidated and served from the CDN edge,
// which is the dominant TTFB win for far-from-origin visitors. Featured-rail
// thumbnails refresh on the revalidate cycle (and on-demand admin edits surface
// within it).
export const revalidate = 600;

async function loadFeaturedMediaBySlug(locale: string): Promise<TourProductCardMediaMap> {
  try {
    const supabase = createServerClient();
    return await loadTourProductCardMediaBySlug(
      supabase,
      Array.from(new Set(FEATURED_PRODUCT_SLUGS)),
      locale,
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[/] featured media prefetch failed:", (e as Error)?.message);
    }
    return {};
  }
}

export default async function HomePage() {
  const featuredMediaBySlug = await loadFeaturedMediaBySlug("en");

  return (
    <SitePageShell>
      <main className="bg-transparent">
        <HomeMainBody featuredMediaBySlug={featuredMediaBySlug} />
      </main>
    </SitePageShell>
  );
}
