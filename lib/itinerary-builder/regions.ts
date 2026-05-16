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

export const REGION_SLUGS = ["busan", "jeju"] as const;
export type RegionSlug = (typeof REGION_SLUGS)[number];

/** Admin-region tags that should appear on each region's map. */
export const REGION_CLUSTER: Record<RegionSlug, readonly string[]> = {
  busan: ["busan", "yangsan", "gyeongju", "ulsan", "miryang"],
  jeju: ["jeju"],
};

/** Map centroid per region for initial camera. */
export const REGION_CENTER: Record<RegionSlug, { lat: number; lng: number; zoom: number }> = {
  busan: { lat: 35.18, lng: 129.07, zoom: 9 },
  jeju: { lat: 33.40, lng: 126.55, zoom: 10 },
};

export function isRegionSlug(value: string | undefined): value is RegionSlug {
  return typeof value === "string" && (REGION_SLUGS as readonly string[]).includes(value);
}
