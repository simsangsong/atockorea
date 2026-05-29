/**
 * Region-cluster definitions for the itinerary builder.
 *
 * Phase 2 tagged each POI with its literal admin region (busan, yangsan,
 * gyeongju, etc.). For UI filtering we group adjacent regions into the
 * tour-cluster the user thinks in terms of — e.g. "Busan tour" naturally
 * includes Tongdosa (Yangsan) and Bulguksa (Gyeongju) as day-trip stops.
 *
 * See docs/itinerary-builder-plan.md §B D1 (jeju + busan MVP) + §F Phase 2
 * close-out note.
 */

export const REGION_SLUGS = ["busan", "jeju", "seoul"] as const;
export type RegionSlug = (typeof REGION_SLUGS)[number];

/** Admin-region tags that should appear on each region's map. */
export const REGION_CLUSTER: Record<RegionSlug, readonly string[]> = {
  busan: ["busan", "yangsan", "gyeongju", "ulsan", "miryang"],
  jeju: ["jeju"],
  // Seoul cluster: central Seoul POIs + Gyeonggi day-trip corridors
  // (Suwon, Nami Island, Hwaseong Fortress) + Gangwon (Seoraksan, Chuncheon,
  // Gangneung) + Incheon (cruise terminal). Phase 9 surcharge model prices the
  // Gyeonggi (+₩30k) / Gangwon (+₩50k) day-trips.
  seoul: ["seoul", "gyeonggi", "gangwon", "incheon"],
};

/** Map centroid per region for initial camera.
 *
 *  Phase 15 — zooms lowered so the entire region cluster is visible on
 *  first paint (was Jeju 10 / Busan 9 / Seoul 10 → city-level crop on
 *  mobile, especially when only one POI was matched). New defaults:
 *   - Jeju: 9 (whole island + a bit of ocean)
 *   - Busan: 8 (Busan + Yangsan/Gyeongju/Ulsan/Miryang cluster)
 *   - Seoul: 9 (greater Seoul + Gyeonggi day-trip corridors)
 *  Lat/lng nudged slightly to keep the cluster centered on a 16:9-ish
 *  mobile aspect (40-42vh × full-width). */
export const REGION_CENTER: Record<RegionSlug, { lat: number; lng: number; zoom: number }> = {
  busan: { lat: 35.55, lng: 129.05, zoom: 8 },
  jeju: { lat: 33.39, lng: 126.55, zoom: 9 },
  seoul: { lat: 37.55, lng: 127.10, zoom: 9 },
};

export function isRegionSlug(value: string | undefined): value is RegionSlug {
  return typeof value === "string" && (REGION_SLUGS as readonly string[]).includes(value);
}
