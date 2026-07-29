/**
 * P7.1 — what photo a POI actually has.
 *
 * 🔴 This exists because the planner was reading ONE column. `match_pois` has
 * 124 rows; 12 have `default_image_url` and 75 have a non-empty `images[]`.
 * The planner read only the former, so the screen where a guest picks their day
 * rendered 11 photos out of 124 (8.9%) — while the read-only view next door,
 * which reads the tour's own itinerary, looked fine. "No photos" was never a
 * content problem; it was a column problem.
 *
 * Measured 2026-07-30 against live `match_pois`:
 *
 *     default_image_url present            12  ( 9.7%)   ← what the planner read
 *       …file actually in public/          11  ( 8.9%)   ← what a guest SAW
 *     images[0] present                    75  (60.5%)
 *     any candidate present                76  (61.3%)
 *       …file actually in public/          73  (58.9%)   ← what a guest sees now
 *     no candidate at all                  48  (38.7%)   ← content gate, owner
 *
 * Every stored URL is a repo-local `/images/...` path (checked: 76/76), which
 * is why `scripts/qa-poi-image-coverage.ts` can verify existence rather than
 * guess at it.
 *
 * 🔴 Why a CHAIN and not `default_image_url || images[0]`:
 * `images[0]` is not reliably the one that exists. Measured —
 *   • `sanbangsan_mountain`  images[0] photo-002.webp MISSING, images[1] photo-001.webp PRESENT
 *   • `hueree_natural_park`  images[0] and [1] MISSING, images[2] PRESENT
 * So the obvious two-term fallback would have thrown away two photos that are
 * sitting in the repo. Consumers walk the candidates and fall to the swatch
 * only when every one of them has failed.
 */

export interface PoiImageSource {
  default_image_url?: string | null;
  /** jsonb array in Postgres; the pois API already selects it. */
  images?: string[] | null;
}

/**
 * Ordered, de-duplicated photo candidates for a POI — best guess first.
 *
 * `default_image_url` leads because it is the curated pick where one exists;
 * `images` follows in stored order. Duplicates are dropped so a dead URL that
 * appears in both places is not retried twice.
 */
export function poiImageCandidates(poi: PoiImageSource | null | undefined): string[] {
  if (!poi) return [];
  const out: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const url = value.trim();
    if (!url || out.includes(url)) return;
    out.push(url);
  };
  push(poi.default_image_url);
  if (Array.isArray(poi.images)) for (const url of poi.images) push(url);
  return out;
}

/** True when this POI can show a photo at all (before any load is attempted). */
export function poiHasImage(poi: PoiImageSource | null | undefined): boolean {
  return poiImageCandidates(poi).length > 0;
}
