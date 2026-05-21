#!/usr/bin/env node
/**
 * Itinerary Builder Phase 1 — seed `match_pois` from existing tour JSON files.
 *
 * Walks all `components/product-tour-static/<slug>/<slug>.<locale>.json`,
 * extracts each itineraryStop with a real `_poi_meta.poi_key`, dedupes,
 * and upserts into `match_pois`.
 *
 * - Skips operational stops (`match: "transit_only"` OR poi_key starts with `OPS_`).
 * - First-seen-wins for image/category/duration/region (en read first).
 * - Locale names spread across `name_en` / `name_ko` / `names_other_locales`.
 *
 * Image selection (POI Data Quality master plan, Phase 4):
 *   1. curated override (lib/itinerary-builder/poi-image-overrides.mjs) — wins
 *   2. first VALID stop.images[] item (non-empty, not Signal-A wrong-POI)
 *   3. first VALID stop.image
 *   4. null (a no-image POI is reported for the Track B photo backlog)
 * "Signal A" rejects a /images/tours/<folder>/ image whose folder token shares
 * no overlap with the POI key/name (e.g. jeonnong_ro -> /tours/ilchulland/...),
 * so a re-seed cannot reintroduce known cross-POI image pollution.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seed-match-pois-from-tour-jsons.mjs [--dry-run]
 *
 * See docs/itinerary-builder-plan.md §F Phase 1 +
 *     docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md.
 */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { BUILDER_POI_IMAGE_OVERRIDES } from "../lib/itinerary-builder/poi-image-overrides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");

const LOCALES_ORDERED = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const OTHER_LOCALES = ["ja", "zh", "zh-TW", "es"];
const DRY_RUN = process.argv.includes("--dry-run");

function parseDuration(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(min|minute|hour|hr)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  return unit.startsWith("h") ? Math.round(v * 60) : Math.round(v);
}

function normalizeRegion(raw) {
  if (!raw) return null;
  const lc = String(raw).toLowerCase().trim();
  if (lc.includes("busan")) return "busan";
  if (lc.includes("jeju")) return "jeju";
  if (lc.includes("incheon")) return "incheon";
  if (lc.includes("seoul")) return "seoul";
  if (lc.includes("gyeongju")) return "gyeongju";
  if (lc.includes("yangsan")) return "yangsan";
  return lc.split(/[\s/+&,]/)[0] || null;
}

function isRealPoi(meta) {
  if (!meta || typeof meta.poi_key !== "string") return false;
  if (meta.match === "transit_only") return false;
  if (meta.poi_key.startsWith("OPS_")) return false;
  // route_variant_* keys are tour-design metadata (route choices), not visitable POIs.
  // They were caught in the first Phase 1 seed and have been deleted from the catalog;
  // exclude them here so re-runs don't re-introduce them.
  if (meta.poi_key.startsWith("route_variant_")) return false;
  return true;
}

// --- Image validity (POI Data Quality master plan, Phase 4 / Signal A) ---

function isValidImageUrl(url) {
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * Signal A — a `/images/tours/<folder>/` image whose folder token shares no
 * overlap with the POI's key/name is probably the wrong POI's image
 * (e.g. jeonnong_ro_cherry_blossom_street pointing at /tours/ilchulland/...).
 * Scoped to the shared tours-folder convention; returns false for anything else.
 */
function isProbablyWrongPoiImage(poiKey, name, url) {
  if (!isValidImageUrl(url)) return false;
  const m = url.match(/^\/images\/tours\/([^/]+)\//);
  if (!m) return false; // only judge the shared tours-folder convention
  const folderTokens = m[1].toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (folderTokens.length === 0) return false;
  const poiTokens = `${poiKey} ${name || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const overlap = folderTokens.some((ft) =>
    poiTokens.some((pt) => pt === ft || pt.includes(ft) || ft.includes(pt))
  );
  return !overlap;
}

/** First valid, non-wrong-POI image from a stop (override + KB handled elsewhere). */
function firstValidImage(stop, poiKey, name) {
  const candidates = [];
  if (Array.isArray(stop.images)) candidates.push(...stop.images);
  if (typeof stop.image === "string") candidates.push(stop.image);
  for (const url of candidates) {
    if (!isValidImageUrl(url)) continue;
    if (isProbablyWrongPoiImage(poiKey, name, url)) continue;
    return url;
  }
  return null;
}

function listTourDirs() {
  return readdirSync(TOURS_DIR).filter((entry) => {
    const full = join(TOURS_DIR, entry);
    try {
      return statSync(full).isDirectory();
    } catch {
      return false;
    }
  });
}

const pois = new Map(); // poi_key → row accumulator

function mergeStop(stop, region, locale) {
  const key = stop._poi_meta.poi_key;
  let acc = pois.get(key);
  if (!acc) {
    acc = {
      poi_key: key,
      name_en: null,
      name_ko: null,
      names_other_locales: {},
      region,
      default_image_url: null,
      poi_meta: {
        sources: stop._poi_meta.sources || [],
        verified: !!stop._poi_meta.verified,
        kb_version: stop._poi_meta.kb_version || null,
        verified_date: stop._poi_meta.verified_date || null,
      },
      stop_role: "attraction",
      is_attraction: true,
      category: null,
      default_stay_minutes: null,
      _seenLocales: new Set(),
      _seenTours: new Set(),
    };
    pois.set(key, acc);
  }

  if (locale === "en") acc.name_en = stop.name || acc.name_en;
  else if (locale === "ko") acc.name_ko = stop.name || acc.name_ko;
  else if (OTHER_LOCALES.includes(locale) && stop.name) {
    acc.names_other_locales[locale] = stop.name;
  }

  // Prefer the first VALID, non-wrong-POI image. The curated override (if any)
  // is applied at shapeForUpsert and always wins over whatever is found here.
  if (!acc.default_image_url) {
    const img = firstValidImage(stop, key, acc.name_en || stop.name || key);
    if (img) acc.default_image_url = img;
  }
  if (!acc.category && typeof stop.category === "string") {
    acc.category = stop.category;
  }
  if (acc.default_stay_minutes == null) {
    const parsed = parseDuration(stop.duration);
    if (parsed != null) acc.default_stay_minutes = parsed;
  }
  if (!acc.region && region) acc.region = region;

  acc._seenLocales.add(locale);
}

function walkTours() {
  const dirs = listTourDirs();
  let toursScanned = 0;
  let filesScanned = 0;
  for (const slug of dirs) {
    let tourRegion = null;
    for (const locale of LOCALES_ORDERED) {
      const file = join(TOURS_DIR, slug, `${slug}.${locale}.json`);
      if (!existsSync(file)) continue;
      filesScanned++;
      let json;
      try {
        json = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        console.warn(`Skip ${file}: parse error ${e.message}`);
        continue;
      }
      // EN file (read first) sets the tour's region for subsequent locales
      if (locale === "en" || !tourRegion) {
        tourRegion =
          normalizeRegion(json.catalog_card?.region) ||
          normalizeRegion(json.hero?.meta?.region) ||
          tourRegion;
      }
      const stops = Array.isArray(json.itineraryStops) ? json.itineraryStops : [];
      for (const stop of stops) {
        if (!isRealPoi(stop._poi_meta)) continue;
        mergeStop(stop, tourRegion, locale);
        const acc = pois.get(stop._poi_meta.poi_key);
        if (acc) acc._seenTours.add(slug);
      }
    }
    toursScanned++;
  }
  return { toursScanned, filesScanned };
}

function shapeForUpsert(acc) {
  const namesOther = Object.keys(acc.names_other_locales).length
    ? acc.names_other_locales
    : null;
  const override = BUILDER_POI_IMAGE_OVERRIDES[acc.poi_key];
  return {
    poi_key: acc.poi_key,
    name_en: acc.name_en,
    name_ko: acc.name_ko,
    names_other_locales: namesOther,
    region: acc.region,
    // Curated override wins; otherwise the validated stop image (or null).
    default_image_url: override?.defaultImageUrl ?? acc.default_image_url,
    poi_meta: acc.poi_meta,
    stop_role: acc.stop_role,
    is_attraction: acc.is_attraction,
    category: acc.category,
    default_stay_minutes: acc.default_stay_minutes,
  };
}

async function main() {
  console.log("Walking tour JSONs...");
  const { toursScanned, filesScanned } = walkTours();
  console.log(`Scanned ${toursScanned} tour dirs / ${filesScanned} locale files`);
  console.log(`Found ${pois.size} unique POI keys`);

  // Per-region breakdown
  const byRegion = {};
  for (const acc of pois.values()) {
    const r = acc.region || "(null)";
    byRegion[r] = (byRegion[r] || 0) + 1;
  }
  console.log("By region:", byRegion);

  // POIs missing name_en (should be 0 after audit)
  const missingNameEn = [...pois.values()].filter((p) => !p.name_en).map((p) => p.poi_key);
  if (missingNameEn.length) {
    console.warn(`WARNING: ${missingNameEn.length} POIs missing name_en:`, missingNameEn);
  }

  // POIs that end up with no image even after the override — Track B photo backlog.
  const noImage = [...pois.values()]
    .filter((p) => !BUILDER_POI_IMAGE_OVERRIDES[p.poi_key]?.defaultImageUrl && !p.default_image_url)
    .map((p) => p.poi_key);
  if (noImage.length) {
    console.warn(`NOTE: ${noImage.length} POIs have no default_image_url (need a real photo):`, noImage);
  }

  const rows = [...pois.values()].map(shapeForUpsert);

  // Write a JSON snapshot for review
  const snapshotPath = join(ROOT, "scripts/seed-match-pois-snapshot.json");
  writeFileSync(snapshotPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Snapshot written to ${snapshotPath}`);

  if (DRY_RUN) {
    console.log("[--dry-run] Skipping upsert. Done.");
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY env"
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Upsert in chunks of 50
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("match_pois")
      .upsert(chunk, { onConflict: "poi_key" });
    if (error) {
      console.error("Upsert error at chunk starting", i, error);
      process.exit(1);
    }
    console.log(`Upserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
