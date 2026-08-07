/**
 * Walks the consolidated photo library (plus `EXTRA_SOURCES`) and emits a manifest row
 * per image with its true (EXIF-rotated) pixel size.
 *
 *   node scripts/photo-curation/build-manifest.mjs --out photo-manifest.json
 */

import sharp from "sharp";
import { readdirSync, statSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { LIBRARY_ROOT, EXTRA_SOURCES } from "./library-map.mjs";

const args = process.argv.slice(2);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OUT = argOf("--out", "photo-manifest.json");
const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"]);

/** @type {{region:string,poi:string,bucket:string,path:string,size:number,w:number,h:number,ar:number}[]} */
const rows = [];

function walk(region, poi, bucket, dir) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(region, poi, bucket ? `${bucket}/${e.name}` : e.name, p);
      continue;
    }
    if (!IMG.has(extname(e.name).toLowerCase())) continue;
    rows.push({
      region,
      poi,
      bucket,
      path: p.replace(/\\/g, "/"),
      size: statSync(p).size,
      w: 0,
      h: 0,
      ar: 0,
    });
  }
}

for (const r of readdirSync(LIBRARY_ROOT, { withFileTypes: true })) {
  if (!r.isDirectory()) continue;
  const regionDir = join(LIBRARY_ROOT, r.name);
  for (const sub of readdirSync(regionDir, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const subDir = join(regionDir, sub.name);
    // Jeju carries an extra area level: 제주 / 07_중문·안덕·대정 / 주상절리 / 여름
    if (/^\d\d_/.test(sub.name)) {
      for (const poi of readdirSync(subDir, { withFileTypes: true })) {
        if (poi.isDirectory()) walk(`${r.name}/${sub.name}`, poi.name, "", join(subDir, poi.name));
      }
    } else {
      walk(r.name, sub.name, "", subDir);
    }
  }
}

for (const src of EXTRA_SOURCES) walk(src.region, src.poi, "", src.dir);

const BATCH = 32;
for (let i = 0; i < rows.length; i += BATCH) {
  await Promise.all(
    rows.slice(i, i + BATCH).map(async (row) => {
      try {
        const m = await sharp(row.path).metadata();
        const rotated = (m.orientation || 1) >= 5;
        row.w = rotated ? m.height || 0 : m.width || 0;
        row.h = rotated ? m.width || 0 : m.height || 0;
        row.ar = row.h ? Number((row.w / row.h).toFixed(3)) : 0;
      } catch {
        /* unreadable — leave zeros so the pre-filter drops it */
      }
    })
  );
}

writeFileSync(OUT, JSON.stringify(rows, null, 1));
console.log(`${rows.length} images → ${OUT}`);
