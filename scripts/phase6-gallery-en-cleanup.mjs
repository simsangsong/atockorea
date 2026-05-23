/**
 * Tour-content Phase 6 EN — gallery location/caption language cleanup.
 *
 * Master plan §6 has two halves: (a) src↔location attribution mismatches
 * (143 candidates surfaced by the cross-check; almost all require photo-
 * file verification) and (b) non-English residual strings in EN gallery
 * items. This commit handles half (b) — purely mechanical language swaps
 * INSIDE `galleryItems[].location/caption/alt` ONLY. Description body
 * stays untouched, so informational parentheticals like `Gamcheon Culture
 * Village (감천문화마을)` are preserved.
 *
 * Earlier draft (reverted) did a whole-file `txt.split.join` which corrupted
 * description bodies into `Gamcheon Culture Village (Gamcheon Culture
 * Village)` style awkward repetitions. This version walks the JSON tree
 * and only rewrites fields whose path enters galleryItems.
 *
 * Residual patterns swept here:
 *   - "Ahopsan Bamboo Forest (아홉산숲)" → "Ahopsan Bamboo Forest"
 *   - "태종대 해안 절벽"               → "Taejongdae coastal cliff"
 *   - "감천문화마을"                    → "Gamcheon Culture Village"
 *   - "용두산공원 & 부산타워"           → "Yongdusan Park & Busan Tower"
 *   - "용두산공원"                      → "Yongdusan Park"
 *   - "Templo Waujeongsa"               → "Waujeongsa Temple"  (Spanish leak)
 *
 * Memory rule `feedback_data_preservation` — surgical, scope-limited swaps.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

const SWAPS = [
  ["Ahopsan Bamboo Forest (아홉산숲)", "Ahopsan Bamboo Forest"],
  ["태종대 해안 절벽", "Taejongdae coastal cliff"],
  ["용두산공원 & 부산타워", "Yongdusan Park & Busan Tower"],
  ["용두산공원", "Yongdusan Park"],
  ["감천문화마을", "Gamcheon Culture Village"],
  ["Templo Waujeongsa", "Waujeongsa Temple"],
];

const TARGET_FIELDS = new Set(["location", "caption", "alt"]);

/** Walk an array of objects; rewrite TARGET_FIELDS in place. */
function sweepGalleryArray(items) {
  if (!Array.isArray(items)) return 0;
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const k of Object.keys(item)) {
      if (TARGET_FIELDS.has(k) && typeof item[k] === "string") {
        for (const [n, r] of SWAPS) {
          if (item[k].includes(n)) {
            item[k] = item[k].split(n).join(r);
            count++;
          }
        }
      }
    }
  }
  return count;
}

/** Recursively find every `galleryItems` array in the document and sweep it. */
function sweepAllGalleryArrays(node) {
  if (Array.isArray(node)) {
    let c = 0;
    for (const n of node) c += sweepAllGalleryArrays(n);
    return c;
  }
  if (node && typeof node === "object") {
    let c = 0;
    for (const k of Object.keys(node)) {
      if (k === "galleryItems" && Array.isArray(node[k])) {
        c += sweepGalleryArray(node[k]);
      } else {
        c += sweepAllGalleryArrays(node[k]);
      }
    }
    return c;
  }
  return 0;
}

const slugs = readdirSync(ROOT).filter((s) => existsSync(`${ROOT}/${s}/${s}.en.json`));

let total = 0;
const touched = new Set();
for (const slug of slugs) {
  const path = `${ROOT}/${slug}/${slug}.en.json`;
  const raw = readFileSync(path, "utf8");
  const j = JSON.parse(raw);
  const c = sweepAllGalleryArrays(j);
  if (c > 0) {
    writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
    touched.add(slug);
    total += c;
    console.log(`  ${slug}: ${c} galleryItems field rewrite${c > 1 ? "s" : ""}`);
  }
}

console.log(`\ntotal swaps applied: ${total} across ${touched.size} slug(s)`);
