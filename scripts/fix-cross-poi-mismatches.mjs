#!/usr/bin/env node
/**
 * Remove cross-POI photo mismatches identified by the audit.
 *
 * Rule: a stop with _poi_meta.poi_key K should only carry images whose folder
 * matches K (or one of K's allowed aliases inside the same complex).
 *
 * Confirmed safe pairings (do not strip across these):
 *   - hwaseong_fortress <-> hwaseong_haenggung -> folder `suwon-hwaseong`
 *     (same fortress complex)
 *   - dora_observatory <-> third_infiltration_tunnel -> folder `dmz`
 *     (same DMZ tour zone, generic landscape ok)
 *   - ilchulland_micheon_cave <-> ilchulland_themed_gardens -> folder `ilchulland`
 *     (same property)
 *
 * Confirmed mismatches to strip:
 *   - un_memorial_cemetery loses `haedong-yonggungsa/*` and `taejongdae/*`
 *   - gamaksan_red_bridge loses `dmz/*` (different place)
 *   - jeonnong_ro_cherry_blossom_street loses `ilchulland/*`
 *   - noksan_ro_gasiri_blossom_road loses `ilchulland/*`
 *   - suwon_nammun_market loses `suwon-hwaseong/*`
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const DRY_RUN = process.argv.includes("--dry-run");

// poi_key -> list of folder names whose photos are allowed in that stop
const ALLOWED_FOLDERS = {
  hwaseong_fortress: ["suwon-hwaseong"],
  hwaseong_haenggung: ["suwon-hwaseong"],
  suwon_nammun_market: ["suwon-nammun-market"], // strip suwon-hwaseong from here
  dora_observatory: ["dmz"],
  third_infiltration_tunnel: ["dmz"],
  gamaksan_red_bridge: ["gamaksan-suspension-bridge"], // strip dmz from here
  ilchulland_micheon_cave: ["ilchulland"],
  ilchulland_themed_gardens: ["ilchulland"],
  jeonnong_ro_cherry_blossom_street: ["jeonnong-ro", "noksan-ro"],
  noksan_ro_gasiri_blossom_road: ["noksan-ro", "jeonnong-ro"],
  un_memorial_cemetery: ["un-memorial-cemetery"],
  haedong_yonggungsa: ["haedong-yonggungsa"],
  taejongdae: ["taejongdae"],
};

function poiFolderFromPath(p) {
  const m = /^\/images\/tours\/([^\/]+)\//.exec(p);
  return m ? m[1] : null;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, obj) {
  const txt = JSON.stringify(obj, null, 2) + "\n";
  writeFileSync(path, txt, "utf8");
}

function listSlugLocales() {
  const out = [];
  for (const slug of readdirSync(TOURS_DIR)) {
    const full = join(TOURS_DIR, slug);
    if (!statSync(full).isDirectory()) continue;
    if (slug === "_shared" || slug === "catalog") continue;
    for (const f of readdirSync(full)) {
      const m = new RegExp(`^${slug}\\.([a-zA-Z-]+)\\.json$`).exec(f);
      if (m) out.push({ slug, locale: m[1], path: join(full, f) });
    }
  }
  return out;
}

function stripBadFromImageList(images, poiKey) {
  if (!Array.isArray(images)) return { images, removed: [] };
  const allowed = ALLOWED_FOLDERS[poiKey];
  if (!allowed) return { images, removed: [] };
  const removed = [];
  const next = [];
  for (const img of images) {
    const path = typeof img === "string" ? img : (img && (img.src || img.url || img.imageUrl));
    if (!path) {
      next.push(img);
      continue;
    }
    const folder = poiFolderFromPath(path);
    if (folder && !allowed.includes(folder)) {
      removed.push(path);
      continue;
    }
    next.push(img);
  }
  return { images: next, removed };
}

function fixDoc(doc) {
  const changes = [];
  if (!Array.isArray(doc?.itineraryStops)) return changes;
  for (const stop of doc.itineraryStops) {
    const poiKey = stop?._poi_meta?.poi_key;
    if (!poiKey) continue;
    if (!ALLOWED_FOLDERS[poiKey]) continue;
    const allowed = ALLOWED_FOLDERS[poiKey];
    if (Array.isArray(stop.images)) {
      const { images, removed } = stripBadFromImageList(stop.images, poiKey);
      if (removed.length) {
        stop.images = images;
        changes.push({ stop: stop.name, poiKey, field: "images", removed });
      }
    }
    if (Array.isArray(stop.photos)) {
      const { images, removed } = stripBadFromImageList(stop.photos, poiKey);
      if (removed.length) {
        stop.photos = images;
        changes.push({ stop: stop.name, poiKey, field: "photos", removed });
      }
    }
    // Replace stop.image / stop.imageUrl only when a same-stop replacement exists
    const safeReplace = (val) => {
      if (typeof val !== "string") return val;
      const folder = poiFolderFromPath(val);
      if (!folder || allowed.includes(folder)) return val;
      // pick first allowed image from stop.images / stop.photos
      for (const list of [stop.images, stop.photos]) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const p = typeof item === "string" ? item : (item && (item.src || item.url || item.imageUrl));
          if (typeof p !== "string") continue;
          const f = poiFolderFromPath(p);
          if (f && allowed.includes(f)) return p;
        }
      }
      return val; // no safe replacement — leave as-is, flag in changes
    };
    if (typeof stop.image === "string") {
      const before = stop.image;
      const after = safeReplace(stop.image);
      if (after !== before) {
        stop.image = after;
        changes.push({ stop: stop.name, poiKey, field: "image(single)", removed: [before], replacement: after });
      } else if (poiFolderFromPath(before) && !allowed.includes(poiFolderFromPath(before))) {
        changes.push({ stop: stop.name, poiKey, field: "image(single)-LEFT_FOR_BOOST", kept: before, note: "no safe replacement in stop.images; needs photo boost" });
      }
    }
    if (typeof stop.imageUrl === "string") {
      const before = stop.imageUrl;
      const after = safeReplace(stop.imageUrl);
      if (after !== before) {
        stop.imageUrl = after;
        changes.push({ stop: stop.name, poiKey, field: "imageUrl(single)", removed: [before], replacement: after });
      } else if (poiFolderFromPath(before) && !allowed.includes(poiFolderFromPath(before))) {
        changes.push({ stop: stop.name, poiKey, field: "imageUrl(single)-LEFT_FOR_BOOST", kept: before, note: "no safe replacement in stop.images; needs photo boost" });
      }
    }
  }
  return changes;
}

function main() {
  const files = listSlugLocales();
  let totalChanges = 0;
  let totalFilesChanged = 0;
  const log = [];
  for (const { slug, locale, path } of files) {
    const doc = readJson(path);
    if (!doc) continue;
    const changes = fixDoc(doc);
    if (changes.length) {
      totalChanges += changes.length;
      totalFilesChanged++;
      log.push({ slug, locale, changes });
      if (!DRY_RUN) writeJson(path, doc);
    }
  }
  const summary = {
    dryRun: DRY_RUN,
    filesScanned: files.length,
    filesChanged: totalFilesChanged,
    stopsAffected: totalChanges,
  };
  console.log("Summary:", summary);
  console.log("Sample changes:");
  for (const entry of log.slice(0, 5)) {
    console.log(`\n[${entry.slug} ${entry.locale}]`);
    for (const c of entry.changes) {
      const rm = c.removed?.length ?? (c.kept ? 1 : 0);
      console.log(`  ${c.stop} (${c.poiKey}) ${c.field} - ${rm} item${c.note ? ` [${c.note}]` : ""}`);
      for (const p of c.removed ?? []) console.log(`    - removed: ${p}`);
      if (c.replacement) console.log(`    + replaced with: ${c.replacement}`);
      if (c.kept) console.log(`    ! kept (boost needed): ${c.kept}`);
    }
  }
  console.log(`\nTotal log entries: ${log.length}`);
}

main();
