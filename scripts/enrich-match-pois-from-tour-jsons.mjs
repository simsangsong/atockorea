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
 *   - For each POI's first-seen tour, capture:
 *       description (long text)
 *       highlights (array)
 *       smartNotes (object)
 *       visitBasics (object)
 *       convenience (object)
 *       whyOnRoute (per-tour but useful as fallback)
 *       images (gallery)
 *   - For subsequent tours: merge images union; keep first description.
 *   - Skip operational stops + route_variant_*.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-match-pois-from-tour-jsons.mjs [--dry-run]
 */
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

function takeImageList(stop) {
  const arr = [];
  if (Array.isArray(stop.images)) {
    for (const img of stop.images) if (typeof img === "string") arr.push(img);
  }
  if (typeof stop.image === "string") arr.push(stop.image);
  if (Array.isArray(stop.galleryItems)) {
    for (const g of stop.galleryItems) if (g && typeof g.src === "string") arr.push(g.src);
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
        acc.highlights = stop.highlights.filter((h) => typeof h === "string");
      }
      if (!acc.smart_notes && stop.smartNotes && typeof stop.smartNotes === "object") {
        acc.smart_notes = stop.smartNotes;
      }
      if (!acc.visit_basics && stop.visitBasics && typeof stop.visitBasics === "object") {
        acc.visit_basics = stop.visitBasics;
      }
      if (!acc.convenience && stop.convenience && typeof stop.convenience === "object") {
        acc.convenience = stop.convenience;
      }
      if (!acc.why_on_route && typeof stop.whyOnRoute === "string" && stop.whyOnRoute.trim()) {
        acc.why_on_route = stop.whyOnRoute.trim();
      }
      // Images: union across all tours that include this POI
      acc.images = mergeImagesArray(acc.images, takeImageList(stop));
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
    const payload = {
      description: acc.description,
      highlights: acc.highlights,
      smart_notes: acc.smart_notes,
      visit_basics: acc.visit_basics,
      convenience: acc.convenience,
      why_on_route: acc.why_on_route,
      images: acc.images.length > 0 ? acc.images : null,
    };
    if (payload.description) withDescription++;
    if (payload.images) withImages++;
    if (payload.highlights) withHighlights++;
    if (DRY_RUN) continue;
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
