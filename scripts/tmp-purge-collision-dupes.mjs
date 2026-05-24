/**
 * Read .tmp-dupes-spec.json and purge byte-identical collision duplicates:
 *
 *  1. In every locale JSON under components/product-tour-static/<slug>/,
 *     rewrite references to the -N.webp duplicate → base.webp, then dedupe
 *     any galleryItems/itineraryStops images that collapse to the same src.
 *  2. Same rewrite + dedupe for the live tour_product_pages.detail_payload
 *     in Supabase, via parameterized SQL.
 *  3. Delete the -N.webp files from public/images/tours/.
 *  4. Try to delete the matching object from the `tour-images` Supabase
 *     Storage bucket (best-effort).
 *
 *   node scripts/tmp-purge-collision-dupes.mjs
 */
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, existsSync } from "fs";
import { join, posix } from "path";
import { createClient } from "@supabase/supabase-js";

const SPEC_PATH = ".tmp-dupes-spec.json";
const STATIC_ROOT = "components/product-tour-static";
const BUCKET = "tour-images";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supa = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

// Build (oldSrc → newSrc) map for url replacement.
// Both keys: full /images/tours/<folder>/<file>.webp paths.
const REWRITES = new Map();
const DELETE_FILES = []; // [{ absPath, urlPath, storageKey }]
for (const f of spec) {
  // Normalize windows backslashes
  const relDir = f.dir.split(/[\\/]/).slice(1).join("/"); // strip leading "public"
  const baseUrl = "/" + posix.join(relDir, f.base);
  for (const dup of f.identicalDupes) {
    const dupUrl = "/" + posix.join(relDir, dup);
    REWRITES.set(dupUrl, baseUrl);
    const absPath = join(f.dir, dup);
    // Storage key in atoc-photos/<assetSlug>/<file.webp> mapping — we don't
    // know the assetSlug→folder map at runtime; just try both stem paths.
    const folderName = relDir.split("/").pop();
    DELETE_FILES.push({ absPath, urlPath: dupUrl, storageKey: `atoc-photos/${folderName}/${dup}` });
  }
}

console.log(`[plan] rewrites: ${REWRITES.size}, file deletes: ${DELETE_FILES.length}\n`);

// ---------- Step 1: rewrite JSON files ----------
function rewriteDeep(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = rewriteDeep(node[i]);
    return node;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) node[k] = rewriteDeep(node[k]);
    return node;
  }
  if (typeof node === "string" && REWRITES.has(node)) return REWRITES.get(node);
  return node;
}

function dedupeGalleryItems(items) {
  if (!Array.isArray(items)) return items;
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const src = it?.src;
    if (typeof src === "string") {
      if (seen.has(src)) continue;
      seen.add(src);
    }
    out.push(it);
  }
  return out;
}

function dedupeItineraryStops(stops) {
  if (!Array.isArray(stops)) return stops;
  for (const stop of stops) {
    if (Array.isArray(stop?.images)) {
      const seenSrc = new Set();
      stop.images = stop.images.filter((img) => {
        const s = typeof img === "string" ? img : img?.src;
        if (typeof s !== "string") return true;
        if (seenSrc.has(s)) return false;
        seenSrc.add(s);
        return true;
      });
    }
  }
  return stops;
}

let jsonsTouched = 0;
const slugDirs = readdirSync(STATIC_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
for (const slug of slugDirs) {
  for (const locale of ["en", "ko", "ja", "zh", "zh-TW", "es"]) {
    const fp = join(STATIC_ROOT, slug, `${slug}.${locale}.json`);
    if (!existsSync(fp)) continue;
    const original = readFileSync(fp, "utf8");
    let data;
    try { data = JSON.parse(original); } catch { continue; }
    const before = JSON.stringify(data);
    rewriteDeep(data);
    if (data.galleryItems) data.galleryItems = dedupeGalleryItems(data.galleryItems);
    if (data.itineraryStops) data.itineraryStops = dedupeItineraryStops(data.itineraryStops);
    const after = JSON.stringify(data);
    if (after !== before) {
      writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", "utf8");
      jsonsTouched += 1;
    }
  }
}
console.log(`[step 1] JSON files modified: ${jsonsTouched}`);

// ---------- Step 2: rewrite Supabase detail_payload ----------
const { data: rows, error } = await supa
  .from("tour_product_pages")
  .select("slug, locale, detail_payload");
if (error) { console.error("supa select failed:", error); process.exit(1); }

let dbTouched = 0;
for (const row of rows) {
  if (!row.detail_payload) continue;
  const before = JSON.stringify(row.detail_payload);
  rewriteDeep(row.detail_payload);
  if (row.detail_payload.galleryItems) row.detail_payload.galleryItems = dedupeGalleryItems(row.detail_payload.galleryItems);
  if (row.detail_payload.itineraryStops) row.detail_payload.itineraryStops = dedupeItineraryStops(row.detail_payload.itineraryStops);
  const after = JSON.stringify(row.detail_payload);
  if (after !== before) {
    const { error: ue } = await supa
      .from("tour_product_pages")
      .update({ detail_payload: row.detail_payload })
      .eq("slug", row.slug)
      .eq("locale", row.locale);
    if (ue) { console.error(`update failed ${row.slug}/${row.locale}:`, ue.message); }
    else { dbTouched += 1; }
  }
}
console.log(`[step 2] tour_product_pages rows updated: ${dbTouched}`);

// ---------- Step 3: delete files on disk ----------
let deleted = 0;
for (const f of DELETE_FILES) {
  if (existsSync(f.absPath)) {
    try { unlinkSync(f.absPath); deleted += 1; } catch (e) {
      console.error(`disk delete failed ${f.absPath}: ${e.message}`);
    }
  }
}
console.log(`[step 3] disk files deleted: ${deleted}`);

// ---------- Step 4: try to delete from Storage ----------
const keys = DELETE_FILES.map((f) => f.storageKey);
const { data: removed, error: rmErr } = await supa.storage.from(BUCKET).remove(keys);
if (rmErr) console.error(`storage remove failed: ${rmErr.message}`);
else console.log(`[step 4] storage objects removed: ${removed?.length ?? 0}`);

console.log(`\n[done]`);
