#!/usr/bin/env node
/**
 * Fixer for Category B from audit-tour-images-precision.mjs.
 * Strips an image src from a stop's images / galleryItems / imageCredits
 * when:
 *   1) the SAME exact src appears on another stop in the same tour, AND
 *   2) the src's path token matches that other stop's identity tokens
 *      (so the other stop is the photo's true "home"), AND
 *   3) the path token does NOT match this stop's identity tokens
 *      (so this stop is genuinely borrowing).
 *
 * Stops where the photo's token matches NO stop in the tour ("no home")
 * are left untouched and listed for manual review.
 *
 * Usage:
 *   node scripts/fix-cross-stop-mismatch.mjs           # dry-run
 *   node scripts/fix-cross-stop-mismatch.mjs --apply   # write JSON
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const LOCALES = process.argv.includes("--all-locales")
  ? ["en", "ko", "ja", "zh", "zh-TW", "es"]
  : ["en"];
const APPLY = process.argv.includes("--apply");

const normalizeToken = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

function tokensFromSrc(src) {
  const m1 = src.match(/^\/images\/tours\/([^/]+)\//);
  if (m1) return [normalizeToken(m1[1])];
  const m2 = src.match(/^\/images\/itinerary\/([^./]+)\.webp/);
  if (m2) {
    const stem = normalizeToken(m2[1]);
    const parts = stem.split("-");
    const variants = new Set([stem]);
    for (let n = 1; n <= Math.min(3, parts.length); n++) {
      variants.add(parts.slice(0, n).join("-"));
    }
    return [...variants];
  }
  const m3 = src.match(/^\/images\/([^/]+)\//);
  if (m3) return [normalizeToken(m3[1])];
  return [];
}

function stopIdentityTokens(stop) {
  const fields = [
    stop?._poi_meta?.poi_key,
    stop?.poiKey,
    stop?.name,
    stop?.title,
    stop?.locationName,
    stop?.location,
  ].filter(Boolean);
  const set = new Set();
  for (const f of fields) {
    const norm = normalizeToken(f);
    if (!norm) continue;
    set.add(norm);
    for (const part of norm.split("-")) {
      if (part.length >= 3) set.add(part);
    }
  }
  return set;
}

function stopLabel(stop) {
  return (
    stop?.name ||
    stop?.title ||
    stop?.locationName ||
    stop?._poi_meta?.poi_key ||
    stop?.poiKey ||
    "(unnamed stop)"
  );
}

function srcMatchesStop(srcTokens, stopTokens) {
  if (srcTokens.length === 0 || stopTokens.size === 0) return false;
  for (const t of srcTokens) {
    if (!t) continue;
    if (stopTokens.has(t)) return true;
    for (const st of stopTokens) {
      if (st.length < 4 || t.length < 4) continue;
      if (st.startsWith(t) || t.startsWith(st)) return true;
      if (st.includes(t) || t.includes(st)) return true;
    }
  }
  return false;
}

function srcOfImageEntry(img) {
  return typeof img === "object" ? img?.src : img;
}

function removeFromList(arr, predicate) {
  if (!Array.isArray(arr)) return 0;
  let removed = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      arr.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

const TARGET_SLUGS = new Set([
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "seoul-dmz-private-3rd-tunnel-suspension-bridge",
  "busan-cruise-shore-excursion-bus-tour",
  "busan-top-attractions-day-tour",
]);

const stats = {
  filesTouched: 0,
  stopsStripped: 0,
  srcsRemoved: 0,
  noHomeCases: [], // {slug, locale, src, stops}
  perTourSummary: new Map(), // slug → count
};

const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
const slugs = entries
  .filter((d) => d.isDirectory() && TARGET_SLUGS.has(d.name))
  .map((d) => d.name)
  .sort();

for (const slug of slugs) {
  for (const locale of LOCALES) {
    const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
    let raw;
    try { raw = await fs.readFile(path, "utf-8"); } catch { continue; }
    let doc;
    try { doc = JSON.parse(raw); } catch { continue; }

    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    if (stops.length === 0) continue;

    const stopMeta = stops.map((s) => ({
      stop: s,
      label: stopLabel(s),
      tokens: stopIdentityTokens(s),
      srcs: new Set(),
    }));
    for (const m of stopMeta) {
      for (const img of m.stop.images ?? []) {
        const s = srcOfImageEntry(img);
        if (typeof s === "string") m.srcs.add(s);
      }
      for (const it of m.stop.galleryItems ?? []) {
        if (typeof it?.src === "string") m.srcs.add(it.src);
      }
    }

    // reverse map src → stop indices
    const srcToIdx = new Map();
    stopMeta.forEach((m, idx) => {
      for (const s of m.srcs) {
        if (!srcToIdx.has(s)) srcToIdx.set(s, new Set());
        srcToIdx.get(s).add(idx);
      }
    });

    let fileChanged = false;
    for (const [src, idxSet] of srcToIdx) {
      if (idxSet.size < 2) continue;
      const srcTokens = tokensFromSrc(src);
      const homeIdxs = [...idxSet].filter((i) => srcMatchesStop(srcTokens, stopMeta[i].tokens));
      const borrowerIdxs = [...idxSet].filter((i) => !homeIdxs.includes(i));
      if (homeIdxs.length === 0) {
        stats.noHomeCases.push({
          slug, locale, src,
          stops: [...idxSet].map((i) => stopMeta[i].label),
        });
        continue;
      }
      if (borrowerIdxs.length === 0) continue;
      for (const bi of borrowerIdxs) {
        const stop = stopMeta[bi].stop;
        const a = removeFromList(stop.images, (img) => srcOfImageEntry(img) === src);
        const b = removeFromList(stop.galleryItems, (it) => it?.src === src);
        const c = removeFromList(stop.imageCredits, (ic) => ic?.url === src);
        if (a + b + c > 0) {
          stats.stopsStripped++;
          stats.srcsRemoved += a + b + c;
          fileChanged = true;
          if (!stats.perTourSummary.has(slug)) stats.perTourSummary.set(slug, 0);
          stats.perTourSummary.set(slug, stats.perTourSummary.get(slug) + (a + b + c));
          if (!APPLY) {
            console.log(`  [${slug}/${locale}] strip from "${stopMeta[bi].label}"  ${src}  (removed ${a + b + c} refs)`);
          }
        }
      }
    }

    if (fileChanged) {
      stats.filesTouched++;
      if (APPLY) {
        await fs.writeFile(path, JSON.stringify(doc, null, 2) + "\n", "utf-8");
      }
    }
  }
}

console.log(`\n=== FIX SUMMARY ${APPLY ? "(APPLIED)" : "(DRY-RUN)"} ===`);
console.log(`  files touched         : ${stats.filesTouched}`);
console.log(`  borrower entries cut  : ${stats.stopsStripped}`);
console.log(`  total src refs removed: ${stats.srcsRemoved}`);
console.log(`  no-home cases skipped : ${stats.noHomeCases.length}`);
console.log(`\nPer tour:`);
for (const [slug, count] of stats.perTourSummary) {
  console.log(`  ${slug}  → ${count} refs removed`);
}
if (stats.noHomeCases.length > 0) {
  console.log(`\nNO-HOME CASES (need manual review — photo's path token matches no stop):`);
  const uniqByKey = new Map();
  for (const c of stats.noHomeCases) {
    const k = `${c.slug}::${c.src}::${c.stops.sort().join("|")}`;
    if (!uniqByKey.has(k)) uniqByKey.set(k, c);
  }
  for (const c of uniqByKey.values()) {
    console.log(`  [${c.slug}]  ${c.src}`);
    console.log(`    appears on: ${c.stops.join(" / ")}`);
  }
}
console.log(`\n${APPLY ? "WROTE FILES." : "Run again with --apply to write."}`);
