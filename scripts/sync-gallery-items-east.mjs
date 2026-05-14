/**
 * Sync galleryItems[].src in east-signature-nature-core JSON files to use
 * the verified, curated stop images instead of off-topic Unsplash placeholders.
 *
 * Mapping (gallery item id → POI key + image index):
 *   1 "코스 전체 분위기"        → seongsan_ilchulbong   [0]  (iconic hero)
 *   2 "돌문화로 시작하는 시간"   → jeju_stone_park       [0]
 *   3 "일출랜드 용암동굴 정원"   → ilchulland_micheon_cave [0]
 *   4 "마을에서 마무리"          → seongeup_folk_village  [0]
 *   5 "분화구와 해안"            → seongsan_ilchulbong   [3]  (different angle)
 *   6 "탁 트인 해안선"           → seopjikoji            [0]
 *
 * Walks the entire JSON tree, so it patches both the top-level
 * `galleryItems` and the nested copy under sections[].props.galleryItems.
 *
 * Usage:  node scripts/sync-gallery-items-east.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIR = join(ROOT, "components", "product-tour-static", "east-signature-nature-core");

const MAPPING = {
  1: { poi: "seongsan_ilchulbong", index: 0 },
  2: { poi: "jeju_stone_park", index: 0 },
  3: { poi: "ilchulland_micheon_cave", index: 0 },
  4: { poi: "seongeup_folk_village", index: 0 },
  5: { poi: "seongsan_ilchulbong", index: 3 },
  6: { poi: "seopjikoji", index: 0 },
};

function buildPoiImageMap(doc) {
  const out = new Map();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (Array.isArray(node.itineraryStops)) {
      for (const s of node.itineraryStops) {
        const pk = s?._poi_meta?.poi_key;
        if (pk && Array.isArray(s.images) && s.images.length) {
          if (!out.has(pk)) out.set(pk, s.images);
        }
      }
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(doc);
  return out;
}

function patchGallery(doc, poiMap) {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (Array.isArray(node.galleryItems)) {
      for (const item of node.galleryItems) {
        if (!item || typeof item.id !== "number") continue;
        const m = MAPPING[item.id];
        if (!m) continue;
        const pool = poiMap.get(m.poi);
        if (!pool || !pool.length) continue;
        const newSrc = pool[Math.min(m.index, pool.length - 1)];
        if (newSrc && newSrc !== item.src) {
          item.src = newSrc;
          count++;
        }
      }
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(doc);
  return count;
}

const files = readdirSync(DIR).filter(
  (f) => f.endsWith(".json") && !f.endsWith(".bak.json") && !f.endsWith(".bak2")
);

for (const f of files) {
  const p = join(DIR, f);
  const raw = readFileSync(p, "utf8");
  const doc = JSON.parse(raw);
  const poiMap = buildPoiImageMap(doc);
  if (poiMap.size === 0) {
    console.log(`  ${f} — no POI images found, skipping`);
    continue;
  }
  const patched = patchGallery(doc, poiMap);
  if (patched === 0) {
    console.log(`  ${f} — already in sync`);
    continue;
  }
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`  ${f} — patched ${patched} galleryItems`);
}

console.log("\ndone.");
