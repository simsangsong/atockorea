#!/usr/bin/env node
/**
 * Keep POI catalog photos and product itineraryStop photos on one canonical
 * URL set per poi_key.
 *
 * Canonical rule:
 *   1. If match_pois already has valid default_image_url/images, keep that
 *      curated POI-library set and copy it into every static itineraryStop
 *      locale for the same _poi_meta.poi_key.
 *   2. If the DB row has no valid photos, use valid image URLs found in the
 *      tour JSON stops and write them back to match_pois.
 *
 * This avoids throwing away curated local assets while still making the POI
 * library and itineraryStops render the same photo set.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-match-poi-photos-with-tour-jsons.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
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

function isValidImageUrl(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s) return false;
  // Translation QA artifacts occasionally wrapped URLs in Markdown/code notes.
  if (/[`>]/.test(s) || /note:/i.test(s)) return false;
  return s.startsWith("/") || /^https?:\/\//i.test(s);
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!isValidImageUrl(value)) continue;
    const v = value.trim();
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function stopImages(stop) {
  const values = [];
  if (isValidImageUrl(stop.image)) values.push(stop.image);
  if (Array.isArray(stop.images)) values.push(...stop.images);
  return unique(values);
}

function jsonFileToSlugLocale(filePath, slug) {
  const m = filePath.match(new RegExp(`${slug}\\.(en|ko|ja|es|zh|zh-TW)\\.json$`));
  return m ? m[1] : null;
}

function listTourFiles() {
  const files = [];
  for (const slug of readdirSync(TOURS_DIR).sort((a, b) => a.localeCompare(b))) {
    const dir = join(TOURS_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;
    for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      if (!entry.endsWith(".json")) continue;
      if (!entry.startsWith(`${slug}.`)) continue;
      const locale = jsonFileToSlugLocale(entry, slug);
      if (!locale) continue;
      files.push({ slug, locale, path: join(dir, entry) });
    }
  }
  return files;
}

async function loadDbRows() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY env");
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("match_pois")
    .select("poi_key, default_image_url, images, content_locales")
    .not("content_locales", "is", null);
  if (error) throw error;
  return { sb, rows: data ?? [] };
}

function collectSourceImages(files) {
  const byPoi = new Map();
  let stopCount = 0;
  let invalidImageValues = 0;
  for (const file of files) {
    const json = JSON.parse(readFileSync(file.path, "utf8"));
    for (const stop of json.itineraryStops ?? []) {
      if (!isRealPoi(stop._poi_meta)) continue;
      stopCount++;
      const raw = [
        ...(typeof stop.image === "string" ? [stop.image] : []),
        ...(Array.isArray(stop.images) ? stop.images : []),
      ];
      invalidImageValues += raw.filter((v) => typeof v === "string" && v.trim() && !isValidImageUrl(v)).length;
      const imgs = stopImages(stop);
      if (!imgs.length) continue;
      const key = stop._poi_meta.poi_key;
      const current = byPoi.get(key) ?? [];
      byPoi.set(key, unique([...current, ...imgs]));
    }
  }
  return { byPoi, stopCount, invalidImageValues };
}

function buildCanonicals(rows, sourceImagesByPoi) {
  const canon = new Map();
  for (const row of rows) {
    const dbImages = unique([
      row.default_image_url,
      ...(Array.isArray(row.images) ? row.images : []),
    ]);
    const sourceImages = sourceImagesByPoi.get(row.poi_key) ?? [];
    const images = dbImages.length ? dbImages : sourceImages;
    if (!images.length) continue;
    canon.set(row.poi_key, {
      poi_key: row.poi_key,
      default_image_url: images[0],
      images,
      source: dbImages.length ? "db" : "itineraryStops",
    });
  }
  return canon;
}

function patchTourJsonFiles(files, canon) {
  let changedFiles = 0;
  let changedStops = 0;
  for (const file of files) {
    const json = JSON.parse(readFileSync(file.path, "utf8"));
    let changed = false;
    for (const stop of json.itineraryStops ?? []) {
      if (!isRealPoi(stop._poi_meta)) continue;
      const c = canon.get(stop._poi_meta.poi_key);
      if (!c) continue;
      const nextImage = c.default_image_url;
      const nextImages = c.images;
      const currentImages = stopImages(stop);
      if (stop.image !== nextImage || JSON.stringify(currentImages) !== JSON.stringify(nextImages)) {
        stop.image = nextImage;
        stop.images = nextImages;
        changed = true;
        changedStops++;
      }
    }
    if (changed) {
      changedFiles++;
      if (!DRY_RUN) writeFileSync(file.path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    }
  }
  return { changedFiles, changedStops };
}

async function patchDbRows(sb, canon) {
  let updated = 0;
  const sourceBreakdown = { db: 0, itineraryStops: 0 };
  for (const c of canon.values()) {
    sourceBreakdown[c.source]++;
    if (DRY_RUN) continue;
    const { error } = await sb
      .from("match_pois")
      .update({ default_image_url: c.default_image_url, images: c.images })
      .eq("poi_key", c.poi_key);
    if (error) {
      console.warn(`DB update failed for ${c.poi_key}: ${error.message}`);
      continue;
    }
    updated++;
  }
  return { updated: DRY_RUN ? 0 : updated, sourceBreakdown };
}

async function main() {
  const files = listTourFiles();
  const { sb, rows } = await loadDbRows();
  const { byPoi: sourceImagesByPoi, stopCount, invalidImageValues } = collectSourceImages(files);
  const canon = buildCanonicals(rows, sourceImagesByPoi);
  const filePatch = patchTourJsonFiles(files, canon);
  const dbPatch = await patchDbRows(sb, canon);

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    filesScanned: files.length,
    localizedStopInstances: stopCount,
    dbPoiRows: rows.length,
    sourcePoiWithImages: sourceImagesByPoi.size,
    canonicalPhotoPois: canon.size,
    invalidImageValues,
    changedFiles: filePatch.changedFiles,
    changedStops: filePatch.changedStops,
    dbRowsUpdated: dbPatch.updated,
    canonicalSourceBreakdown: dbPatch.sourceBreakdown,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
