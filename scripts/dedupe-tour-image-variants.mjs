#!/usr/bin/env node
/**
 * Remove `-2.webp` / `-3.webp` collision-suffix variants when the base
 * file is also referenced in the same slot — these are visually
 * identical (the variants were byte-identical at write time before the
 * 50f4418a delete-set purged 102 of them on disk). Surviving variants
 * (where the base is NOT also referenced in the same slot) stay
 * untouched so we don't randomly drop a legitimate non-base reference.
 *
 * Scope:
 *   - `detail_payload.galleryItems`       (top-level)
 *   - per-stop  `images`                   (simple URL array)
 *   - per-stop  `galleryItems`             (rich {src, alt, caption})
 *   - per-stop  `imageCredits`             ({url, source})
 *
 * Default = dry-run. `--apply` writes the JSON files back.
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const APPLY = process.argv.includes("--apply");

const stripVariant = (src) => (typeof src === "string" ? src.replace(/-(2|3)\.webp$/, ".webp") : src);

/**
 * Given an array of items where each carries a string at `keyPath`,
 * remove items whose key is a `-2.webp`/`-3.webp` variant of another
 * key already present in the array (the base wins, variant gets dropped).
 * Returns { out, removed }.
 */
function stripCollisionVariants(arr, getKey) {
  if (!Array.isArray(arr)) return { out: arr, removed: 0 };
  // pass 1: collect all keys present so we know which bases exist
  const presentKeys = new Set();
  for (const item of arr) {
    const k = getKey(item);
    if (typeof k === "string" && k) presentKeys.add(k);
  }
  // pass 2: drop any item whose key is a variant of a present base
  let removed = 0;
  const out = [];
  for (const item of arr) {
    const k = getKey(item);
    if (typeof k !== "string" || !k) {
      out.push(item);
      continue;
    }
    const base = stripVariant(k);
    if (base !== k && presentKeys.has(base)) {
      removed += 1;
      continue;
    }
    out.push(item);
  }
  return { out, removed };
}

let touchedFiles = 0;
let totals = { topGi: 0, stopImgs: 0, stopGi: 0, stopIc: 0 };

const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
const slugs = entries.filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of slugs) {
  for (const locale of LOCALES) {
    const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
    let raw;
    try { raw = await fs.readFile(path, "utf-8"); } catch { continue; }
    let doc;
    try { doc = JSON.parse(raw); } catch { continue; }

    let fileRemoved = { topGi: 0, stopImgs: 0, stopGi: 0, stopIc: 0 };

    // top-level galleryItems
    if (Array.isArray(doc.galleryItems)) {
      const r = stripCollisionVariants(doc.galleryItems, (it) => it?.src);
      doc.galleryItems = r.out;
      fileRemoved.topGi = r.removed;
    }

    // per-stop arrays
    if (Array.isArray(doc.itineraryStops)) {
      for (const stop of doc.itineraryStops) {
        if (Array.isArray(stop.images)) {
          const r = stripCollisionVariants(stop.images, (img) => (typeof img === "object" ? img?.src : img));
          stop.images = r.out;
          fileRemoved.stopImgs += r.removed;
        }
        if (Array.isArray(stop.galleryItems)) {
          const r = stripCollisionVariants(stop.galleryItems, (it) => it?.src);
          stop.galleryItems = r.out;
          fileRemoved.stopGi += r.removed;
        }
        if (Array.isArray(stop.imageCredits)) {
          const r = stripCollisionVariants(stop.imageCredits, (ic) => ic?.url);
          stop.imageCredits = r.out;
          fileRemoved.stopIc += r.removed;
        }
      }
    }

    const fileTotal = fileRemoved.topGi + fileRemoved.stopImgs + fileRemoved.stopGi + fileRemoved.stopIc;
    if (fileTotal > 0) {
      touchedFiles += 1;
      totals.topGi += fileRemoved.topGi;
      totals.stopImgs += fileRemoved.stopImgs;
      totals.stopGi += fileRemoved.stopGi;
      totals.stopIc += fileRemoved.stopIc;
      if (APPLY) {
        const next = JSON.stringify(doc, null, 2) + "\n";
        await fs.writeFile(path, next, "utf-8");
      }
      console.log(`${slug}/${locale}  topGi=${fileRemoved.topGi}  stopImgs=${fileRemoved.stopImgs}  stopGi=${fileRemoved.stopGi}  stopIc=${fileRemoved.stopIc}`);
    }
  }
}

console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"} — files touched: ${touchedFiles}`);
console.log(`  topGi   removed: ${totals.topGi}`);
console.log(`  stopImgs removed: ${totals.stopImgs}`);
console.log(`  stopGi   removed: ${totals.stopGi}`);
console.log(`  stopIc   removed: ${totals.stopIc}`);
console.log(`  TOTAL: ${totals.topGi + totals.stopImgs + totals.stopGi + totals.stopIc}`);
