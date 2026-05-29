import { cookies } from "next/headers";
import { HomeMainBody } from "@/components/home/HomeMainBody";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { FEATURED_PRODUCT_SLUGS } from "@/components/home/v2/sections";
import { createServerClient } from "@/lib/supabase";
import { loadTourProductCardMediaBySlug } from "@/lib/tour-product/resolveTourProductCardMedia.server";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import {
  REGION_CLUSTER,
  isRegionSlug,
  type RegionSlug,
} from "@/lib/itinerary-builder/regions";
import { isBuilderAttraction } from "@/lib/itinerary-match-engine/poi-taxonomy";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

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
 */

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Korea Day Tours Checked by Our Team",
  description: "Korea day tours checked by our team before they're listed, with routes, guides, and local operations reviewed on the ground.",
  url: "/",
  tags: ["Korea tours", "Seoul tours", "Busan tours", "Jeju tours", "day tours", "travel Korea"],
});

const SUPPORTED_LOCALES = new Set(["en", "ko", "zh", "zh-TW", "ja", "es"]);

function resolveLocaleFromCookie(value: string | undefined): string {
  if (!value) return "en";
  if (value === "zh-CN") return "zh";
  return SUPPORTED_LOCALES.has(value) ? value : "en";
}

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

/**
 * Phase 11 D30 — SSR-prefetch POIs for the home-embedded builder when an
 * inbound link carries `?region=`. Cold landing visits skip this; the
 * builder lazy-fetches on first interaction so TTFB stays unaffected.
 */
async function loadBuilderPois(region: RegionSlug): Promise<MatchPoiRow[]> {
  try {
    const cluster = REGION_CLUSTER[region];
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("match_pois")
      .select(
        "poi_key, name_en, name_ko, names_other_locales, content_locales, region, category, default_image_url, default_stay_minutes, lat, lng, stop_role, is_attraction, is_operational, builder_profile_source, builder_profile_version, poi_meta, description, highlights, images, why_on_route, smart_notes, visit_basics, convenience",
      )
      .in("region", cluster as unknown as string[])
      .not("name_en", "is", null)
      .not("lat", "is", null);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MatchPoiRow[]).filter(
      (p) =>
        p.is_attraction === true ||
        (p.is_attraction == null && isBuilderAttraction(p.poi_key)),
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[/] builder POI prefetch failed:", (e as Error)?.message);
    }
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const rawRegion = typeof sp.region === "string" ? sp.region : null;
  const builderRegion: RegionSlug | null =
    rawRegion && isRegionSlug(rawRegion) ? (rawRegion as RegionSlug) : null;

  // Phase 11 audit fix #10 — run the two SSR fetches in parallel so a
  // `?region=` deep-link doesn't pay sum-of-round-trips on TTFB.
  const [featuredMediaBySlug, builderPois] = await Promise.all([
    loadFeaturedMediaBySlug(locale),
    builderRegion ? loadBuilderPois(builderRegion) : Promise.resolve(null),
  ]);

  return (
    <SitePageShell>
      <main className="bg-transparent">
        <HomeMainBody
          featuredMediaBySlug={featuredMediaBySlug}
          builderInitialRegion={builderRegion}
          builderInitialPois={builderPois}
          builderMapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
          builderApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        />
      </main>
    </SitePageShell>
  );
}
