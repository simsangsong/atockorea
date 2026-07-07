import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  REGION_CLUSTER,
  isRegionSlug,
  type RegionSlug,
} from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import { isBuilderAttraction, hasBuilderPhoto } from "@/lib/itinerary-match-engine/poi-taxonomy";

/**
 * GET /api/itinerary-builder/pois?region=busan|jeju|seoul
 *
 * Phase 11 D30 — lets `HomeBuilderSection` lazy-fetch POIs on first
 * interaction so the landing page ships zero builder bytes for visitors
 * who never engage the planner. Mirrors the SELECT in
 * `app/itinerary-builder/page.tsx` exactly (pre-Phase-11 SSR path) so the
 * rendered builder is identical whether POIs arrived via SSR (`?region=`
 * deep-link) or via this endpoint (cold visit + interaction).
 *
 * POIs are region-scoped public content that changes rarely, so the response
 * is edge-cacheable per `?region=` (see GET header). No per-user state.
 */
const POIS_CACHE = "public, s-maxage=600, stale-while-revalidate=3600";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  if (!isRegionSlug(region ?? "")) {
    return NextResponse.json(
      { ok: false, error: "invalid_region" },
      { status: 400 },
    );
  }

  const cluster = REGION_CLUSTER[region as RegionSlug];
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("match_pois")
    .select(
      "poi_key, name_en, name_ko, names_other_locales, content_locales, region, category, default_image_url, default_stay_minutes, lat, lng, stop_role, is_attraction, is_operational, builder_profile_source, builder_profile_version, poi_meta, description, highlights, images, why_on_route, smart_notes, visit_basics, convenience",
    )
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null)
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const pois = ((data ?? []) as MatchPoiRow[]).filter(
    (p) =>
      (p.is_attraction === true ||
        (p.is_attraction == null && isBuilderAttraction(p.poi_key))) &&
      // Phase A — hide POIs without a displayable photo from the builder.
      hasBuilderPhoto(p),
  );

  return NextResponse.json(
    { ok: true, region, pois },
    { headers: { "Cache-Control": POIS_CACHE } },
  );
}
