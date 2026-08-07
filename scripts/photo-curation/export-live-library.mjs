/**
 * Exports the photos that are actually LIVE to `D:/live/<관광지>/`, so they can be reused
 * without re-deriving which file belongs to which attraction.
 *
 * "Live" is decided by the **database**, not the repo — `tour_product_pages.detail_payload`
 * and `match_pois` are what customers actually get served. A file can sit in `public/`
 * forever without ever being rendered.
 *
 * Attribution is taken from the payload itself (each itinerary stop carries its
 * `_poi_meta.poi_key` next to its images), not guessed from filenames. Filename guessing
 * breaks on exactly the cases that matter — `nami-metasequoia-sunset-lake.webp` and
 * `haedong-yonggungsa-sunset-cliff.webp` do not share a naming scheme.
 *
 * Each POI folder gets:
 *   *.webp        the live, shipped asset (cropped, resized, q95)
 *   _원본/         the untouched source frame from the D: library, where one exists —
 *                 higher resolution and uncropped, which is what a re-crop needs
 *
 *   node scripts/photo-curation/export-live-library.mjs [--dest D:/live] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
import { POI_FOLDER_MAP } from "./library-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const args = process.argv.slice(2);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const DEST = argOf("--dest", "D:/live");
const DRY = args.includes("--dry-run");

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
loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * Logistics stops (pickup / return / lunch) carry photos too, but they are not places —
 * and they hide inside *nested* route-variant itineraries, so a top-level scan misses
 * them. They must not become folders here.
 */
const NOT_A_PLACE = /^(OPS_|route_variant)|(^|_)(pickup|return|lunch|dropoff)(_|$)/;

/** poi_key → 한글 폴더명. Three sources, most specific first. */
const koByPoi = new Map();
for (const [ko, spec] of Object.entries(POI_FOLDER_MAP)) {
  for (const k of spec.poiKeys) if (!koByPoi.has(k)) koByPoi.set(k, ko);
}
/** POIs the D: library has no folder for — their photos arrived by other routes. */
for (const [k, ko] of Object.entries({
  haedong_yonggungsa: "해동용궁사",
  jagalchi_market: "자갈치시장",
  gukje_market: "국제시장",
  biff_square: "BIFF 광장",
  insadong: "인사동",
  seoraksan_national_park: "설악산",
  tongdosa_temple: "통도사",
  suwon_nammun_market: "수원 남문시장",
  jeonnong_ro_cherry_blossom_street: "전농로 벚꽃길",
  naksansa_temple: "낙산사",
  naksan_beach: "낙산해수욕장",
  amethyst_cave_themepark: "자수정동굴나라",
  yeongnam_alps_ice_valley_cable_car: "영남알프스 얼음골",
  seokchon_lake: "석촌호수",
  cheongsando_slow_road: "청산도",
  jinhae_yeojwacheon: "여좌천 벚꽃길",
  jinhae_gyeonghwa_station: "경화역 벚꽃길",
})) {
  if (!koByPoi.has(k)) koByPoi.set(k, ko);
}

/** poi_key → Set<public path> */
const byPoi = new Map();
const add = (poiKey, p) => {
  if (!poiKey || NOT_A_PLACE.test(poiKey)) return;
  if (typeof p !== "string" || !p.startsWith("/images/")) return;
  if (!byPoi.has(poiKey)) byPoi.set(poiKey, new Set());
  byPoi.get(poiKey).add(p);
};

function walkStops(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => walkStops(n, fn));
    return;
  }
  if (Array.isArray(node.itineraryStops)) node.itineraryStops.forEach(fn);
  for (const k of Object.keys(node)) walkStops(node[k], fn);
}

// ── live set, from the DB ───────────────────────────────────────────────────
{
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("tour_product_pages")
      .select("slug, detail_payload")
      .eq("locale", "en")
      .range(from, from + 49);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      walkStops(row.detail_payload, (stop) => {
        const pk = stop?._poi_meta?.poi_key;
        if (!pk || NOT_A_PLACE.test(pk)) return;
        add(pk, stop.image);
        for (const u of stop.images || []) add(pk, u);
      });
    }
    if (data.length < 50) break;
    from += 50;
  }
}
{
  const { data, error } = await supabase
    .from("match_pois")
    .select("poi_key, name_ko, default_image_url, images");
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    if (row.name_ko && !koByPoi.has(row.poi_key)) koByPoi.set(row.poi_key, row.name_ko);
    add(row.poi_key, row.default_image_url);
    for (const u of row.images || []) add(row.poi_key, u);
  }
}

// ── source originals, so a re-crop has something to work from ───────────────
/** public path → original source path */
const originOf = new Map();
{
  const picks = JSON.parse(readFileSync(join(__dirname, "picks.json"), "utf8"));
  for (const [slug, p] of Object.entries(picks)) {
    if (!p.hero) continue;
    [p.hero, ...p.gallery].forEach((f, i) => {
      const stem = basename(f.path).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 88);
      const name = stem.length >= 4 ? `${String(i + 1).padStart(2, "0")}-${stem}.webp` : `photo-${String(i + 1).padStart(3, "0")}.webp`;
      originOf.set(`/images/tours/${slug}/${name}`, f.path);
    });
  }
}

const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "_").trim();
let copied = 0;
let origins = 0;
let missing = 0;
const index = [];

for (const [poiKey, set] of [...byPoi.entries()].sort()) {
  const ko = koByPoi.get(poiKey) || poiKey;
  const dir = join(DEST, safe(ko));
  const files = [...set].sort();
  const present = files.filter((p) => existsSync(join(ROOT, "public", p.replace(/^\//, ""))));
  missing += files.length - present.length;
  if (!present.length) continue;
  if (!DRY) mkdirSync(dir, { recursive: true });

  for (const p of present) {
    const src = join(ROOT, "public", p.replace(/^\//, ""));
    if (!DRY) copyFileSync(src, join(dir, basename(p)));
    copied += 1;
    const origin = originOf.get(p);
    if (origin && existsSync(origin)) {
      if (!DRY) {
        mkdirSync(join(dir, "_원본"), { recursive: true });
        copyFileSync(origin, join(dir, "_원본", basename(origin)));
      }
      origins += 1;
    }
  }
  index.push(`${safe(ko)}\t${poiKey}\t${present.length}장`);
}

if (!DRY) {
  writeFileSync(
    join(DEST, "_INDEX.txt"),
    [
      "라이브 사진 — 관광지별 정리",
      "=".repeat(60),
      "",
      "판정 기준: 라이브 DB(tour_product_pages.detail_payload + match_pois)가 실제로",
      "참조하는 파일만. public/ 에 남아 있어도 아무도 안 부르는 파일은 제외했다.",
      "귀속은 페이로드 안의 스톱별 _poi_meta.poi_key 로 — 파일명 추측이 아니다.",
      "",
      "각 폴더:",
      "  *.webp   라이브에 나간 그 파일 (크롭·리사이즈·q95 적용본)",
      "  _원본/    D: 라이브러리의 원본 프레임 (고해상도·무크롭, 재크롭용)",
      "",
      "폴더\tpoi_key\t장수",
      "-".repeat(60),
      ...index,
      "",
      `합계: ${index.length}개 관광지 / ${copied}장 (원본 ${origins}장 동봉)`,
    ].join("\n"),
    "utf8"
  );
}

console.log(`${DRY ? "[dry] " : ""}${index.length} POI folders, ${copied} live files, ${origins} originals`);
if (missing) console.log(`⚠ ${missing} live references had no file on disk`);
