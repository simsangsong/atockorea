#!/usr/bin/env node
/**
 * Itinerary Builder Phase 6.5 — enrich `match_pois` with the rich
 * itineraryStops content from the static tour JSONs.
 *
 * Each tour JSON has an `itineraryStops` array; each stop carries
 * description / highlights / smartNotes / visitBasics / convenience /
 * whyOnRoute / image / images. The Phase 1 seed only pulled a subset
 * (name + image url + stay minutes + category). This script fills in
 * the rest so the new POI catalog grid + detail modal can render a
 * proper stop card.
 *
 * Strategy:
 *   - Walk components/product-tour-static/**\/<slug>.en.json
 *   - Index by `_poi_meta.poi_key`
 *   - For each POI's first-seen tour, capture description / highlights /
 *     smartNotes / visitBasics / convenience / whyOnRoute / images.
 *   - For subsequent tours: merge images union; keep first description.
 *   - Skip operational stops + route_variant_*.
 *
 * Data-quality rules (POI Data Quality master plan, Phase 5):
 *   - Empty structured objects ({}) and empty arrays are treated as MISSING
 *     (normalized to null), never written as "field exists".
 *   - Signal-A wrong-POI images are filtered out of the images union.
 *   - Curated override images (poi-image-overrides.mjs) are prepended.
 *   - The UPDATE payload OMITS empty fields, so enrich never wipes good DB
 *     data with null when a source happens to be empty.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-match-pois-from-tour-jsons.mjs [--dry-run]
 */
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { BUILDER_POI_IMAGE_OVERRIDES } from "../lib/itinerary-builder/poi-image-overrides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const DRY_RUN = process.argv.includes("--dry-run");

function isRealPoi(meta) {
  if (!meta || typeof meta.poi_key !== "string") return false;
  if (meta.match === "transit_only") return false;
  if (meta.poi_key.startsWith("OPS_")) return false;
  if (meta.poi_key.startsWith("route_variant_")) return false;
  return true;
}

// --- Data-quality helpers (shared semantics with the seed script) ---

function isValidImageUrl(url) {
  return typeof url === "string" && url.trim().length > 0;
}

/** Signal A — see seed-match-pois-from-tour-jsons.mjs for the full rationale. */
function isProbablyWrongPoiImage(poiKey, name, url) {
  if (!isValidImageUrl(url)) return false;
  const m = url.match(/^\/images\/tours\/([^/]+)\//);
  if (!m) return false;
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

/** Returns the object only if it has meaningful keys, else null ({} -> null). */
function meaningfulObject(o) {
  return o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length > 0 ? o : null;
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

const pois = new Map();

function mergeImagesArray(existing, incoming) {
  const seen = new Set(existing);
  for (const u of incoming) {
    if (typeof u === "string" && u && !seen.has(u)) {
      seen.add(u);
    }
  }
  return [...seen];
}

/** Valid, non-wrong-POI images only (drops "" placeholders + cross-POI pollution). */
function takeImageList(stop, poiKey) {
  const arr = [];
  if (Array.isArray(stop.images)) {
    for (const img of stop.images) {
      if (isValidImageUrl(img) && !isProbablyWrongPoiImage(poiKey, null, img)) arr.push(img);
    }
  }
  if (isValidImageUrl(stop.image) && !isProbablyWrongPoiImage(poiKey, null, stop.image)) {
    arr.push(stop.image);
  }
  if (Array.isArray(stop.galleryItems)) {
    for (const g of stop.galleryItems) {
      if (g && isValidImageUrl(g.src) && !isProbablyWrongPoiImage(poiKey, null, g.src)) arr.push(g.src);
    }
  }
  return arr;
}

function walkTours() {
  const dirs = listTourDirs();
  let filesScanned = 0;
  for (const slug of dirs) {
    const file = join(TOURS_DIR, slug, `${slug}.en.json`);
    if (!existsSync(file)) continue;
    filesScanned++;
    let json;
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      console.warn(`Skip ${file}: parse error ${e.message}`);
      continue;
    }
    const stops = Array.isArray(json.itineraryStops) ? json.itineraryStops : [];
    for (const stop of stops) {
      if (!isRealPoi(stop._poi_meta)) continue;
      const key = stop._poi_meta.poi_key;
      let acc = pois.get(key);
      if (!acc) {
        acc = {
          poi_key: key,
          description: null,
          highlights: null,
          smart_notes: null,
          visit_basics: null,
          convenience: null,
          why_on_route: null,
          images: [],
          _tour_sources: [],
        };
        pois.set(key, acc);
      }
      acc._tour_sources.push(slug);
      // First-seen wins for the singular fields
      if (!acc.description && typeof stop.description === "string" && stop.description.trim()) {
        acc.description = stop.description.trim();
      }
      if (!acc.highlights && Array.isArray(stop.highlights) && stop.highlights.length > 0) {
        const hs = stop.highlights.filter((h) => typeof h === "string" && h.trim());
        if (hs.length) acc.highlights = hs;
      }
      // Empty {} is treated as missing — never captured.
      if (!acc.smart_notes) {
        const v = meaningfulObject(stop.smartNotes);
        if (v) acc.smart_notes = v;
      }
      if (!acc.visit_basics) {
        const v = meaningfulObject(stop.visitBasics);
        if (v) acc.visit_basics = v;
      }
      if (!acc.convenience) {
        const v = meaningfulObject(stop.convenience);
        if (v) acc.convenience = v;
      }
      if (!acc.why_on_route && typeof stop.whyOnRoute === "string" && stop.whyOnRoute.trim()) {
        acc.why_on_route = stop.whyOnRoute.trim();
      }
      // Images: union across all tours that include this POI (valid + non-wrong only)
      acc.images = mergeImagesArray(acc.images, takeImageList(stop, key));
    }
  }
  return filesScanned;
}

async function main() {
  console.log("Walking tour JSONs (en only)...");
  const filesScanned = walkTours();
  console.log(`  scanned ${filesScanned} *.en.json files · ${pois.size} POIs captured`);

  // Skip if no payload — should never happen given Phase 1 ran, but defensive
  if (pois.size === 0) {
    console.error("No POI payload collected.");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let updates = 0;
  let withDescription = 0;
  let withImages = 0;
  let withHighlights = 0;

  for (const acc of pois.values()) {
    // Prepend curated override images (assets-not-in-source) ahead of the union.
    let imgs = acc.images;
    const override = BUILDER_POI_IMAGE_OVERRIDES[acc.poi_key];
    if (override?.images?.length) {
      imgs = mergeImagesArray(override.images, imgs);
    }

    // Build payload with ONLY non-empty fields — never wipe good DB data with null.
    const payload = {};
    if (acc.description) payload.description = acc.description;
    if (acc.highlights && acc.highlights.length) payload.highlights = acc.highlights;
    if (meaningfulObject(acc.smart_notes)) payload.smart_notes = acc.smart_notes;
    if (meaningfulObject(acc.visit_basics)) payload.visit_basics = acc.visit_basics;
    if (meaningfulObject(acc.convenience)) payload.convenience = acc.convenience;
    if (acc.why_on_route) payload.why_on_route = acc.why_on_route;
    if (imgs.length) payload.images = imgs;

    if (payload.description) withDescription++;
    if (payload.images) withImages++;
    if (payload.highlights) withHighlights++;
    if (DRY_RUN) continue;
    if (Object.keys(payload).length === 0) continue; // nothing to write for this POI

    const { error } = await sb.from("match_pois").update(payload).eq("poi_key", acc.poi_key);
    if (error) {
      console.error(`  UPDATE error ${acc.poi_key}:`, error);
      continue;
    }
    updates++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`POIs touched: ${DRY_RUN ? pois.size + " (dry-run)" : updates}`);
  console.log(`  with description: ${withDescription}`);
  console.log(`  with highlights:  ${withHighlights}`);
  console.log(`  with images[]:    ${withImages}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
