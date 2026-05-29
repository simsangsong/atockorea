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
 * Phase 13 D36 — restored as a real page after Phase 11 had absorbed the
 * planner into `/`. The home-absorbed surface caused a duplicate-timeline
 * UX (AI panel result stripe + ResultTimeline both showing the same cart)
 * and lost the dedicated canvas the planner needs. Hero "Build myself"
 * conditions arrive here via URL params + `?autoRun=1`, so the matcher
 * fires automatically and the customer lands on a populated itinerary.
 *
 * Canonical URL rules (kept from Phase 10):
 *  - `?region=…` defaults to busan; invalid slug redirects to default.
 *  - `?track=dmz` forces `region=seoul` (DMZ is Seoul-only).
 *  - All other planner params (date / party / lang / duration / hours /
 *    ship / pickup / port / intent / autoRun) flow through unchanged.
 */

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
      <main className="min-h-screen bg-stone-50">
        <BuilderShell
          region={region}
          pois={pois}
          center={center}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
          placement="page"
        />
      </main>
    </SitePageShell>
  );
}
