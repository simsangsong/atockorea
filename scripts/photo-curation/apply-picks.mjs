/**
 * Wires `picks.json` into the site: WebP → `public/images/tours/<assetSlug>/`, Supabase
 * Storage, the six locale tour JSONs, `tour_product_pages.detail_payload` (+ hero/thumb),
 * `tours.image_url`/`gallery_images`, and `match_pois.default_image_url`/`images`.
 *
 *   node scripts/photo-curation/apply-picks.mjs --dry-run
 *   node scripts/photo-curation/apply-picks.mjs --only camellia-hill,taejongdae
 *   node scripts/photo-curation/apply-picks.mjs --no-storage --no-db
 *
 * Ordering matters: the first image of a pick is the stop hero, and
 * `tour-payload-thumb-sync.mjs` then derives the product card / OG image from the first
 * non-OPS stop, so a pick's hero can become a product thumbnail two hops later.
 */

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import {
  applyCatalogHeroThumbnails,
  syncRootGalleryFromItinerary,
  firstCatalogImageFromPayload,
} from "../tour-payload-thumb-sync.mjs";
import { detectOverlayCrop } from "./overlay-crop.mjs";
import { FORCE_CROP } from "./force-crop.mjs";
import { PRODUCT_THUMBNAILS } from "./product-thumbnails.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const LOCALES = ["en", "ko", "ja", "es", "zh", "zh-TW"];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const DRY = has("--dry-run");
const NO_STORAGE = has("--no-storage");
const NO_DB = has("--no-db");
const ONLY = argOf("--only", "");
const PICKS = argOf("--picks", join(__dirname, "picks.json"));

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

/** ASCII-safe stem — Supabase Storage rejects Hangul in object paths. */
function stemFor(file, i) {
  const s = basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 88);
  return s.length >= 4 ? `${String(i + 1).padStart(2, "0")}-${s}` : `photo-${String(i + 1).padStart(3, "0")}`;
}

async function toWebp(file, { override }) {
  const meta = await sharp(file).metadata();
  const rotated = (meta.orientation || 1) >= 5;
  const W = (rotated ? meta.height : meta.width) || 0;
  const H = (rotated ? meta.width : meta.height) || 0;

  let crop = null;
  if (override?.left) {
    const left = Math.round(W * override.left);
    crop = { left, top: 0, width: W - left, height: H, reason: "forced-left" };
  } else {
    try {
      crop = await detectOverlayCrop(file);
    } catch {
      /* detector is advisory */
    }
  }
  if (crop && crop.reason === "lens-button-uncroppable") crop = null;

  let rect = crop
    ? { ...crop }
    : { left: 0, top: 0, width: W, height: H, reason: "" };
  if (override?.bottom) {
    rect.height = Math.max(1, rect.height - Math.round(H * override.bottom));
    rect.reason = rect.reason ? `${rect.reason}+bottom` : "forced-bottom";
  }

  let pipe = sharp(file).rotate();
  if (rect.reason) {
    pipe = pipe.extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }
  const buf = await pipe
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  return { buf, crop: rect.reason ? rect : null };
}

function walkStops(node, fn) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const x of node) walkStops(x, fn);
    return;
  }
  if (typeof node !== "object") return;
  if (Array.isArray(node.itineraryStops)) for (const s of node.itineraryStops) fn(s);
  for (const k of Object.keys(node)) walkStops(node[k], fn);
}

function stopKeys(stop) {
  const out = [];
  const pk = stop?._poi_meta?.poi_key;
  if (pk) out.push(pk);
  for (const s of stop?._poi_meta?.secondary_poi_keys || []) out.push(s);
  for (const m of stop?._poi_metas || []) if (m?.poi_key) out.push(m.poi_key);
  return out;
}

function applyStopImages(stop, paths) {
  if (!paths.length) return;
  const nameRef = (stop.name || "Stop").slice(0, 120);
  stop.image = paths[0];
  stop.images = [...paths];
  stop.imageCredits = paths.map((url) => ({ url, source: "atoc-korea" }));
  stop.galleryItems = paths.map((src, i) => ({
    id: i + 1,
    type: "photo",
    src,
    location: nameRef,
    caption: `${nameRef} — photo ${i + 1}`,
    alt: `${nameRef} — gallery image ${i + 1}`,
  }));
}

async function main() {
  loadEnvLocal();
  const picks = JSON.parse(readFileSync(PICKS, "utf8"));
  const onlySet = ONLY ? new Set(ONLY.split(",").map((s) => s.trim())) : null;

  let supabase = null;
  if (!DRY && (!NO_STORAGE || !NO_DB)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) {
      console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
      process.exit(1);
    }
    supabase = createClient(url, key);
  }

  /** @type {{poiKeys:string[], paths:string[], set:Set<string>}[]} */
  const batches = [];
  const poiImages = new Map(); // poi_key -> public paths
  const cropped = [];

  for (const [slug, pick] of Object.entries(picks)) {
    if (onlySet && !onlySet.has(slug)) continue;
    if (!pick.hero) continue;
    const frames = [pick.hero, ...pick.gallery];
    const outDir = join(ROOT, "public", "images", "tours", slug);
    if (!DRY) mkdirSync(outDir, { recursive: true });

    const paths = [];
    for (let i = 0; i < frames.length; i += 1) {
      const f = frames[i];
      const role = i === 0 ? "H" : `g${i}`;
      const override = FORCE_CROP.get(`${slug}/${role}`);
      const name = `${stemFor(f.path, i)}.webp`;
      const pub = `/images/tours/${slug}/${name}`;
      if (DRY) {
        console.log(`[dry] ${slug}/${role} ${basename(f.path)} → ${pub}`);
        paths.push(pub);
        continue;
      }
      const { buf, crop } = await toWebp(f.path, { override });
      writeFileSync(join(outDir, name), buf);
      if (crop) cropped.push(`${slug}/${role} ${crop.reason}`);
      paths.push(pub);

      if (!NO_STORAGE && supabase) {
        const { error } = await supabase.storage
          .from("tour-images")
          .upload(`atoc-photos/${slug}/${name}`, buf, {
            contentType: "image/webp",
            upsert: true,
          });
        if (error) console.error(`  storage ${slug}/${name}: ${error.message}`);
      }
    }

    // `promote` moves one already-converted frame to the front so it becomes the stop hero
    // (and, through it, `match_pois.default_image_url` — the POI card). Deliberately does
    // NOT renumber the files: `product-thumbnails.mjs` addresses frames by filename, and
    // renumbering would silently break those references.
    if (pick.promote) {
      const target = paths.find((p) => basename(p).startsWith(`${pick.promote}-`));
      if (!target) console.warn(`  promote ${pick.promote} not found in ${slug}`);
      else paths.splice(0, 0, ...paths.splice(paths.indexOf(target), 1));
    }

    // Assets the site already ships that are worth keeping alongside the curated set —
    // replacing a stop wholesale would otherwise throw away good photography that simply
    // is not in the D: library (e.g. the three Woljeonggyo frames under /images/itinerary).
    for (const extra of pick.extraPaths || []) {
      if (!existsSync(join(ROOT, "public", extra.replace(/^\//, "")))) {
        console.warn(`  extraPath missing on disk, skipped: ${extra}`);
        continue;
      }
      if (!paths.includes(extra)) paths.push(extra);
    }

    console.log(`${slug}: ${paths.length} images → ${pick.poiKeys.join(", ") || "(no poi keys)"}`);
    if (pick.poiKeys.length) {
      batches.push({ poiKeys: pick.poiKeys, paths, set: new Set(pick.poiKeys) });
      for (const k of pick.poiKeys) if (!poiImages.has(k)) poiImages.set(k, paths);
    }
  }

  if (cropped.length) {
    console.log(`\nOverlay crops applied (${cropped.length}):\n  ${cropped.join("\n  ")}`);
  }
  if (!batches.length) {
    console.log("No POI batches — nothing to wire.");
    return;
  }

  // ── tour JSONs ────────────────────────────────────────────────────────────
  const staticRoot = join(ROOT, "components", "product-tour-static");
  const touched = [];

  for (const folder of readdirSync(staticRoot, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    for (const locale of LOCALES) {
      const abs = join(staticRoot, folder.name, `${folder.name}.${locale}.json`);
      if (!existsSync(abs)) continue;
      let data;
      try {
        data = JSON.parse(readFileSync(abs, "utf8"));
      } catch {
        continue;
      }
      let dirty = false;
      walkStops(data, (stop) => {
        if (!stop || typeof stop !== "object") return;
        const keys = stopKeys(stop);
        if (!keys.length) return;
        // Prefer a batch that owns the stop's PRIMARY key over one that only matches a
        // secondary key, so a compound stop keeps its headline POI's photos.
        const primary = keys[0];
        const match =
          batches.find((b) => b.set.has(primary)) || batches.find((b) => keys.some((k) => b.set.has(k)));
        if (!match) return;
        applyStopImages(stop, match.paths);
        dirty = true;
      });
      if (!dirty) continue;
      // A deliberate card image wins over "first non-OPS stop". Without this, re-running
      // the photo pipeline would quietly hand four Busan products the same frame again.
      const thumb =
        PRODUCT_THUMBNAILS[folder.name]?.image || firstCatalogImageFromPayload(data);
      if (thumb) applyCatalogHeroThumbnails(data, thumb);
      syncRootGalleryFromItinerary(data);
      if (!DRY) writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      touched.push({ slug: folder.name, locale, abs });
    }
  }
  console.log(`\nTour JSONs updated: ${touched.length}`);

  if (DRY || NO_DB || !supabase) {
    console.log("Skipping DB writes.");
    return;
  }

  // ── tour_product_pages ────────────────────────────────────────────────────
  for (const { slug, locale, abs } of touched) {
    const payload = JSON.parse(readFileSync(abs, "utf8"));
    const hero = firstCatalogImageFromPayload(payload);
    const { error } = await supabase
      .from("tour_product_pages")
      .update({
        detail_payload: payload,
        ...(hero ? { hero_image_url: hero, thumbnail_url: hero } : {}),
      })
      .eq("slug", slug)
      .eq("locale", locale);
    if (error) console.warn(`  tour_product_pages ${slug}/${locale}: ${error.message}`);
  }
  console.log(`tour_product_pages synced: ${touched.length} rows`);

  // ── tours (card image + gallery) ──────────────────────────────────────────
  const enSlugs = [...new Set(touched.filter((t) => t.locale === "en").map((t) => t.slug))];
  for (const slug of enSlugs) {
    const payload = JSON.parse(
      readFileSync(join(staticRoot, slug, `${slug}.en.json`), "utf8")
    );
    const hero = firstCatalogImageFromPayload(payload);
    const gallery = (payload.galleryItems || [])
      .map((g) => g?.src)
      .filter((s) => typeof s === "string" && s.startsWith("/images/"));
    const patch = {};
    if (hero) patch.image_url = hero;
    if (gallery.length) patch.gallery_images = gallery;
    if (!Object.keys(patch).length) continue;
    const { error } = await supabase.from("tours").update(patch).eq("slug", slug);
    if (error) console.warn(`  tours ${slug}: ${error.message}`);
  }
  console.log(`tours synced: ${enSlugs.length} rows`);

  // ── match_pois (builder pins + arrival cards) ─────────────────────────────
  let poiOk = 0;
  for (const [poiKey, paths] of poiImages.entries()) {
    const { error, count } = await supabase
      .from("match_pois")
      .update({ default_image_url: paths[0], images: paths }, { count: "exact" })
      .eq("poi_key", poiKey);
    if (error) console.warn(`  match_pois ${poiKey}: ${error.message}`);
    else if (count) poiOk += 1;
  }
  console.log(`match_pois synced: ${poiOk}/${poiImages.size} keys`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
