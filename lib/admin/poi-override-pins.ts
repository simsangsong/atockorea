/**
 * Curated POI image "override pin" lookup for the admin match_pois editor.
 *
 * Image edits to `match_pois.default_image_url` can be reverted by the re-seed
 * pipeline (scripts/seed-match-pois-from-tour-jsons.mjs +
 * lib/itinerary-builder/poi-image-overrides.mjs) unless the curated override
 * map agrees. The admin editor surfaces an "override-pinned" badge for any
 * poi_key present in that map so ops knows a re-seed wins for those rows.
 *
 * IMPORTANT (planner §F Phase 8 / decision D11, verified on `main` 2026-05-21):
 * `poi-image-overrides.mjs` lives on the `fix/itinerary-builder-poi-data-quality`
 * branch and is ABSENT on `main`. When the file is missing this helper returns
 * an empty Set — the badge simply never shows, with no build break — and it
 * auto-activates once the dq branch merges the override map to `main`.
 *
 * The read strategy is text + regex (NOT a dynamic `import()`) so the bundler
 * never tries to resolve a possibly-absent module, and so we don't couple to
 * the file's exact export shape. Result is memoised per server process.
 */
import fs from 'node:fs';
import path from 'node:path';

const OVERRIDE_MAP_PATH = path.join(
  process.cwd(),
  'lib',
  'itinerary-builder',
  'poi-image-overrides.mjs',
);

let cache: Set<string> | null = null;

export function getOverridePinnedKeys(): Set<string> {
  if (cache) return cache;
  const keys = new Set<string>();
  try {
    if (fs.existsSync(OVERRIDE_MAP_PATH)) {
      const src = fs.readFileSync(OVERRIDE_MAP_PATH, 'utf8');
      // Override maps are objects keyed by poi_key (`tongdosa_temple: '/img…'`
      // or `'biff_square': "/img…"`). Capture an optionally-quoted lowercase
      // identifier immediately followed by `:` and a quoted string value.
      // Inner keys of nested object values may also match, but those are
      // filtered out at call sites by intersecting with real poi_keys.
      const re = /['"]?([a-z][a-z0-9_]{2,})['"]?\s*:\s*['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        keys.add(m[1]);
      }
    }
  } catch {
    // Degrade silently to "no overrides known".
  }
  cache = keys;
  return keys;
}

export function isOverridePinned(poiKey: string): boolean {
  return getOverridePinnedKeys().has(poiKey);
}
