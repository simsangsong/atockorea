import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import {
  REGION_CLUSTER,
  REGION_CENTER,
  isRegionSlug,
  type RegionSlug,
} from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import { isBuilderAttraction } from "@/lib/itinerary-match-engine/poi-taxonomy";
import BuilderShell from "@/components/itinerary-builder/BuilderShell";

/**
 * Unified planner shell (Phase 10.3 D21).
 *
 * Previously `/itinerary-builder` was a separate intake-form page that
 * collected preferences and pushed to `/itinerary-builder/[region]?...`.
 * That double-screen redundancy is removed: this route IS the planner.
 * Region defaults to busan (or comes from `?region=`); changes from the
 * `<PlannerTopRail>` chip strip trigger a hard navigation so POIs are
 * re-fetched server-side. All other preferences (date · party · lang ·
 * duration · pickup · port · ship) live in URL params and update via
 * `router.replace({scroll:false})` — see D5 share-able-link discipline.
 *
 * The legacy `/itinerary-builder/[region]` route is preserved as a
 * 308 redirect that forwards into this one (preserves SEO + bookmark
 * continuity).
 */

// Force runtime fetch — match_pois is small and refreshed rarely; serve
// from CDN-edge with 5-minute ISR for performance.
export const revalidate = 300;

const DEFAULT_REGION: RegionSlug = "busan";

export const metadata: Metadata = {
  title: "Build Your Custom Korea Itinerary | AtoC Korea",
  description:
    "Pick stops on the map, see your live price, book with card on file. No charge today, captured on tour day.",
};

export default async function ItineraryBuilderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  /**
   * Audit fix #5/#6 (Phase 10.3.2): rewrite the URL to a canonical
   * (region, track) pair so it never contradicts itself.
   *   - `?region=` missing or invalid → coerce to DEFAULT_REGION.
   *   - `?track=dmz` always implies `region=seoul` (DMZ is Seoul-only —
   *     deep-links like `?region=jeju&track=dmz` previously rendered a
   *     DMZ product card while LivePriceCard treated the trip as Jeju
   *     and the share-link continued to mis-report the region).
   * All other params (date, party, lang, duration, hours, ship, port,
   * pickup, intent, locale, origin, …) are preserved verbatim.
   */
  const requestedRegion = typeof sp.region === "string" ? sp.region : null;
  const requestedTrack = typeof sp.track === "string" ? sp.track : null;
  const canonicalRegion: RegionSlug =
    requestedTrack === "dmz"
      ? "seoul"
      : isRegionSlug(requestedRegion ?? "")
        ? (requestedRegion as RegionSlug)
        : DEFAULT_REGION;
  if (requestedRegion !== canonicalRegion) {
    const qs = new URLSearchParams();
    qs.set("region", canonicalRegion);
    for (const [k, v] of Object.entries(sp)) {
      if (k === "region") continue;
      if (Array.isArray(v)) {
        for (const item of v) if (item) qs.append(k, item);
      } else if (v) {
        qs.set(k, v);
      }
    }
    redirect(`/itinerary-builder?${qs.toString()}`);
  }
  const region: RegionSlug = canonicalRegion;

  const cluster = REGION_CLUSTER[region];
  const center = REGION_CENTER[region];

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("match_pois")
    .select(
      "poi_key, name_en, name_ko, names_other_locales, content_locales, region, category, default_image_url, default_stay_minutes, lat, lng, stop_role, is_attraction, is_operational, builder_profile_source, builder_profile_version, poi_meta, description, highlights, images, why_on_route, smart_notes, visit_basics, convenience",
    )
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null);

  if (error) {
    throw new Error(`Failed to load POIs for ${region}: ${error.message}`);
  }
  const pois = ((data ?? []) as MatchPoiRow[]).filter(
    (p) => p.is_attraction === true || (p.is_attraction == null && isBuilderAttraction(p.poi_key)),
  );

  return (
    <SitePageShell>
      <main className="min-h-screen bg-white/55">
        <BuilderShell
          region={region}
          pois={pois}
          center={center}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        />
      </main>
    </SitePageShell>
  );
}
