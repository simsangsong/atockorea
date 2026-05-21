/**
 * Curated representative-image overrides for itinerary-builder POIs.
 *
 * PURPOSE — the standing injection point for images that exist locally
 * (under `public/images/...`) but are referenced by NO source tour stop and NO
 * POI-knowledge-base entry. The seed/enrich scripts and the POI audit consult
 * this map so a re-seed cannot silently revert a hand-wired image back to null.
 *
 * This is NOT the runtime read path: the builder UI reads
 * `match_pois.default_image_url` from the DB. This map exists to keep the data
 * PIPELINE deterministic — when a writer (seed-match-pois-from-tour-jsons.mjs,
 * enrich-match-pois-from-tour-jsons.mjs) runs, it must prefer these values.
 *
 * Format note: `.mjs` (not `.ts`) on purpose — the seed/enrich scripts are
 * plain-node `.mjs` and cannot import a `.ts` module; `.mjs` is importable by
 * node, by tsx (the audit script), and by Next/TS if ever needed.
 *
 * Keep it SMALL and reviewed. A POI fixable at its source — a tour JSON
 * `stop.image`, or a KB `default_image_url` — should be fixed THERE, not here.
 * Entries here are only for assets-not-in-source.
 *
 * Provenance verified 2026-05-21 — see
 * docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md (Phase 0).
 *
 * @typedef {{ defaultImageUrl: string, images?: string[], note?: string }} BuilderPoiImageOverride
 * @type {Record<string, BuilderPoiImageOverride>}
 */
export const BUILDER_POI_IMAGE_OVERRIDES = {
  woljeonggyo_bridge: {
    defaultImageUrl: "/images/itinerary/woljeonggyo-front-day.webp",
    images: [
      "/images/itinerary/woljeonggyo-front-day.webp",
      "/images/itinerary/woljeonggyo-reflection.webp",
      "/images/itinerary/woljeonggyo-pavilion-night.webp",
    ],
    note: "Orphan in DB (pointed at /tours/ahopsan-bamboo/, an AI image); absent from tour JSON + KB, so no re-seed reproduces or repairs it. Local /itinerary asset wired.",
  },
  tongdosa_temple: {
    defaultImageUrl: "/images/itinerary/tongdosa-iljumun.webp",
    images: [
      "/images/itinerary/tongdosa-iljumun.webp",
      "/images/itinerary/tongdosa-yeongsanjeon.webp",
    ],
    note: "default_image_url was null; local /itinerary asset exists but is referenced by no source stop.",
  },

  // These carry CORRECT curated /images/itinerary assets that are referenced by
  // no source tour stop (their filenames match the POI — not pollution). Pinned
  // here so a re-seed reproduces them instead of nulling default_image_url.
  // Identified via `node scripts/seed-match-pois-from-tour-jsons.mjs --dry-run`
  // (2026-05-21): these computed to null while the live DB held a good image.
  gukje_market: {
    defaultImageUrl: "/images/itinerary/gukje-market-arcade-sign-forest.webp",
    note: "Correct curated asset, absent from source stops — pinned for re-seed determinism.",
  },
  bomun_lake: {
    defaultImageUrl: "/images/itinerary/bomun-lake-cherry-blossom-promenade.webp",
    note: "Correct curated asset, absent from source stops — pinned for re-seed determinism.",
  },
  songaksan: {
    defaultImageUrl: "/images/itinerary/songaksan-coastal-monument.webp",
    note: "Correct curated asset, absent from source stops — pinned for re-seed determinism.",
  },
};
