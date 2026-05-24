/**
 * Import curated photos from `D:\Atoc Photos\modified\<관광지명>\*.{jpg,png,...}`
 * → WebP under `public/images/tours/<assetSlug>/`
 * → Match stops by `_poi_meta.poi_key` / `secondary_poi_keys` (+ optional `nameGuard`)
 * → Supabase Storage `tour-images` bucket (path `atoc-photos/...`, upsert)
 * → `tour_product_pages.detail_payload` full replace from updated JSON
 *
 * Usage:
 *   node scripts/import-atoc-modified-photos.mjs
 *   node scripts/import-atoc-modified-photos.mjs --source "D:/Atoc Photos/modified" --dry-run
 *   node scripts/import-atoc-modified-photos.mjs --source "D:/Atoc Photos/new" --append
 *   node scripts/import-atoc-modified-photos.mjs --no-storage --no-db
 */

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  applyCatalogHeroThumbnails,
  syncRootGalleryFromItinerary,
  firstCatalogImageFromPayload,
} from "./tour-payload-thumb-sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/**
 * @typedef {{ assetSlug: string, poiKeys: string[], nameGuard?: RegExp | null, skipJson?: boolean }} FolderSpec
 * @type {Record<string, FolderSpec>}
 */
const FOLDER_MAP = {
  "1100고지": { assetSlug: "hallasan-1100", poiKeys: ["hallasan_1100_wetland"] },
  DMZ: {
    assetSlug: "dmz",
    poiKeys: ["third_infiltration_tunnel", "dora_observatory", "gamaksan_red_bridge"],
  },
  "감악산 출렁다리": { assetSlug: "gamaksan-suspension-bridge", poiKeys: ["gamaksan_red_bridge"] },
  "감천문화마을": {
    assetSlug: "gamcheon-culture-village",
    poiKeys: ["gamcheon_culture_village"],
    nameGuard: /gamcheon|감천|culture village|마추픽추|산토리니/i,
  },
  경복궁: { assetSlug: "gyeongbokgung", poiKeys: ["gyeongbokgung_palace"] },
  광명동굴: { assetSlug: "gwangmyeong-cave", poiKeys: ["gwangmyeong_cave"] },
  광장시장: { assetSlug: "gwangjang-market", poiKeys: ["gwangjang_market"] },
  남이섬: { assetSlug: "nami-island", poiKeys: ["nami_island"] },
  녹산로: { assetSlug: "noksan-ro", poiKeys: ["noksan_ro_gasiri_blossom_road"] },
  대릉원: { assetSlug: "daereungwon", poiKeys: ["daereungwon_tomb_complex"] },
  돌문화공원: { assetSlug: "jeju-stone-park", poiKeys: ["jeju_stone_park"] },
  부산타워: {
    assetSlug: "busan-tower",
    poiKeys: ["yongdusan_park"],
    nameGuard: /yongdusan|busan tower|용두산|diamond tower|부산타워/i,
  },
  북촌한옥마을: { assetSlug: "bukchon-hanok", poiKeys: ["bukchon_hanok_village"] },
  쁘디프랑스: { assetSlug: "petite-france", poiKeys: ["petite_france"] },
  사려니숲길: { assetSlug: "saryeoni-forest", poiKeys: [], skipJson: true },
  산정호수: { assetSlug: "sanjeong-lake", poiKeys: ["sanjeong_lake"] },
  섭지코지: { assetSlug: "seopjikoji", poiKeys: ["seopjikoji"] },
  성산일출봉: { assetSlug: "seongsan-ilchulbong", poiKeys: ["seongsan_ilchulbong"] },
  성읍민속마을: { assetSlug: "seongeup-folk-village", poiKeys: ["seongeup_folk_village"] },
  송도해수욕장: { assetSlug: "songdo-beach", poiKeys: [], skipJson: true },
  수원화성: {
    assetSlug: "suwon-hwaseong",
    poiKeys: ["hwaseong_fortress", "hwaseong_haenggung"],
    nameGuard: /hwaseong|suwon|수원|화성|행궁/i,
  },
  "스타필드 도서관": {
    assetSlug: "starfield-library-suwon",
    poiKeys: ["starfield_library_suwon"],
  },
  아침고요수목원: {
    assetSlug: "garden-of-morning-calm",
    poiKeys: ["garden_of_morning_calm"],
  },
  아트밸리: { assetSlug: "pocheon-art-valley", poiKeys: ["pocheon_art_valley"] },
  아홉산숲: { assetSlug: "ahopsan-bamboo", poiKeys: ["ahopsan_bamboo_forest"] },
  애월카페거리: { assetSlug: "aewol-cafe-street", poiKeys: ["aewol_cafe_street"] },
  어승생악: { assetSlug: "hallasan-eoseungsaengak", poiKeys: ["hallasan_eoseungsaengak"] },
  에버랜드: { assetSlug: "everland", poiKeys: [], skipJson: true },
  에코랜드: { assetSlug: "jeju-ecoland", poiKeys: [], skipJson: true },
  /** 별도 장소(오설록 티뮤지엄과 무관). POI 미정 — public 폴더에만 적재, JSON 미반영 */
  "오늘은 녹차한잔": {
    assetSlug: "today-green-tea",
    poiKeys: [],
    skipJson: true,
  },
  와우정사: { assetSlug: "waujeongsa", poiKeys: ["waujeongsa_temple"] },
  유엔기념공원: { assetSlug: "un-memorial-cemetery", poiKeys: ["un_memorial_cemetery"] },
  이호테우: { assetSlug: "iho-teu", poiKeys: [], skipJson: true },
  일출랜드: { assetSlug: "ilchulland", poiKeys: ["ilchulland_micheon_cave"] },
  임진각: {
    assetSlug: "imjingak",
    poiKeys: ["imjingak_peace_park"],
    nameGuard: /imjingak|임진각|peace park|평화/i,
  },
  전농로: { assetSlug: "jeonnong-ro", poiKeys: ["jeonnong_ro_cherry_blossom_street"] },
  정방폭포: { assetSlug: "jeongbang-falls", poiKeys: ["jeongbang_falls"] },
  주상절리: {
    assetSlug: "jusangjeolli",
    poiKeys: ["daepo_jusangjeolli_cliff", "jusangjeolli_cliff"],
  },
  천제연폭포: { assetSlug: "cheonjeyeon-falls", poiKeys: ["cheonjeyeon_falls"] },
  첨성대: {
    assetSlug: "cheomseongdae",
    poiKeys: ["cheomseongdae"],
  },
  "청사포 다릿돌 전망대": {
    assetSlug: "cheongsapo-blue-line",
    poiKeys: ["cheongsapo_blue_line_park"],
  },
  카멜리아힐: { assetSlug: "camellia-hill", poiKeys: ["camellia_hill"] },
  태종대: { assetSlug: "taejongdae", poiKeys: ["taejongdae"] },
  한국민속촌: {
    assetSlug: "korean-folk-village",
    poiKeys: ["korean_folk_village", "korean_folk_village_yongin"],
  },
  함덕해수욕장: {
    assetSlug: "hamdeok-beach",
    poiKeys: ["hamdeok_seoubong_beach", "hamdeok_beach"],
  },
  해녀박물관: { assetSlug: "jeju-haenyeo-museum", poiKeys: ["jeju_haenyeo_museum"] },
  "해운대 블루라인파크": {
    assetSlug: "cheongsapo-blue-line",
    poiKeys: ["cheongsapo_blue_line_park"],
  },
  허브아일랜드: { assetSlug: "herb-island", poiKeys: ["herb_island"] },
  협재해수욕장: { assetSlug: "hyeopjae-beach", poiKeys: ["hyeopjae_beach"] },
  휴애리: { assetSlug: "hueree", poiKeys: ["hueree_natural_park"] },
  /** Gyeongju / Busan tours */
  경주교촌마을: {
    assetSlug: "gyochon-hanok-village",
    poiKeys: ["gyochon_hanok_village"],
  },
  경주국립박물관: {
    assetSlug: "gyeongju-national-museum",
    poiKeys: ["gyeongju_national_museum"],
  },
  불국사: {
    assetSlug: "bulguksa-temple",
    poiKeys: ["bulguksa_temple"],
  },
  /** Seoul (Incheon cruise + day tours) */
  남산타워: {
    assetSlug: "n-seoul-tower",
    poiKeys: ["n_seoul_tower"],
    nameGuard: /namsan|n seoul|남산타워|서울타워|타워/i,
  },
  명동: {
    assetSlug: "myeongdong",
    poiKeys: ["myeongdong"],
    nameGuard: /myeongdong|명동/i,
  },
  오설록티뮤지엄: {
    assetSlug: "osulloc-tea",
    poiKeys: ["osulloc_tea_museum"],
  },
  /**
   * 제주 환상숲 (곶자왈) — not yet on itinerary POI keys; assets only until a stop uses this key.
   */
  환상숲: {
    assetSlug: "jeju-fantasy-forest",
    poiKeys: [],
    skipJson: true,
  },
  /** 2026-05-25 atoc-photos batch — new POIs / locations (BIFF / 영남알프스 / 보문호수 / 해동용궁사) */
  BIFF광장: { assetSlug: "biff-square", poiKeys: ["biff_square"], nameGuard: /biff|film festival|광장|영화제/i },
  영남알프스: {
    assetSlug: "yeongnam-alps",
    poiKeys: ["yeongnam_alps_ice_valley_cable_car"],
    nameGuard: /yeongnam|영남알프스|alps|얼음골|cable car|케이블카/i,
  },
  보문호수: { assetSlug: "bomun-lake", poiKeys: ["bomun_lake"], nameGuard: /bomun|보문|경주월드|gyeongju world/i },
  해동용궁사: { assetSlug: "haedong-yonggungsa", poiKeys: ["haedong_yonggungsa"] },
  /** 2026-05-24 atoc-photos batch — new POIs / locations */
  한림공원: { assetSlug: "hallim-park", poiKeys: ["hallim_park"] },
  자갈치시장: {
    assetSlug: "jagalchi-market",
    poiKeys: ["jagalchi_market"],
    nameGuard: /jagalchi|자갈치/i,
  },
  인사동: {
    assetSlug: "insadong",
    poiKeys: ["insadong"],
    nameGuard: /insadong|인사동/i,
  },
  산방산: {
    assetSlug: "sanbangsan",
    poiKeys: ["sanbangsan_mountain", "yongmeori_coast"],
  },
  월정교: { assetSlug: "woljeonggyo", poiKeys: ["woljeonggyo_bridge"] },
  약천사: { assetSlug: "yakcheonsa", poiKeys: ["yakcheonsa_temple"] },
  설악산: {
    assetSlug: "seoraksan-national-park",
    poiKeys: ["seoraksan_national_park"],
    nameGuard: /seoraksan|설악/i,
  },
  청산도: { assetSlug: "cheongsando", poiKeys: ["cheongsando_slow_road"] },
  석촌호수: { assetSlug: "seokchon-lake", poiKeys: ["seokchon_lake"] },
  진해여좌천: {
    assetSlug: "jinhae-yeojwacheon",
    poiKeys: ["jinhae_yeojwacheon"],
  },
  진해경화역: {
    assetSlug: "jinhae-gyeonghwa-station",
    poiKeys: ["jinhae_gyeonghwa_station"],
  },
  감귤농장: {
    assetSlug: "jeju-tangerine-farm",
    poiKeys: ["jeju_tangerine_picking_experience"],
  },
  /** 부산 매화 — placeholder asset for plum-blossom tour gallery; no POI yet. */
  부산매화: { assetSlug: "busan-plum-blossom", poiKeys: [], skipJson: true },
  /** 경주 황남빵 본점 — bakery/food spot, not a POI; assets only. */
  황남빵: { assetSlug: "hwangnam-bread", poiKeys: [], skipJson: true },
};

const SKIP_FOLDERS = new Set(["미적용", "미배정", "새 폴더"]);

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"]);

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

function argvHas(flag) {
  return process.argv.includes(flag);
}

/** ASCII-only stem for Storage keys + stable public URLs (Supabase rejects Hangul in paths). */
function webpStemFromFile(file, index) {
  const stem = basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  if (stem.length >= 4) return stem;
  return `photo-${String(index + 1).padStart(3, "0")}`;
}

/** Pick a non-colliding `.webp` filename under `outDir` (for `--append`). */
function uniqueWebpOutPath(outDir, base) {
  let suffix = "";
  let n = 1;
  for (;;) {
    const name = `${base}${suffix}.webp`;
    const outPath = join(outDir, name);
    if (!existsSync(outPath)) return { name, outPath };
    n += 1;
    suffix = `-${n}`;
  }
}

function stopMatchesBatch(stop, batch) {
  const pk = stop?._poi_meta?.poi_key;
  const sec = stop?._poi_meta?.secondary_poi_keys || [];
  let hit = false;
  if (pk && batch.poiKeysSet.has(pk)) hit = true;
  if (!hit) {
    for (const s of sec) {
      if (batch.poiKeysSet.has(s)) {
        hit = true;
        break;
      }
    }
  }
  if (!hit) return false;
  if (batch.nameGuard) {
    const blob = `${stop.name || ""} ${stop.category || ""}`;
    if (!batch.nameGuard.test(blob)) return false;
  }
  return true;
}

function applyStopImages(stop, publicPaths, stopNameForMeta, appendMode) {
  if (!publicPaths.length) return;
  const nameRef = (stopNameForMeta || stop.name || "Stop").slice(0, 120);
  const prevImages = Array.isArray(stop.images)
    ? stop.images.filter((u) => typeof u === "string" && u.trim())
    : [];
  const prevHero = typeof stop.image === "string" && stop.image.trim() ? stop.image.trim() : "";

  let mergedPaths;
  if (appendMode) {
    const seen = new Set();
    mergedPaths = [];
    for (const u of [...prevImages, ...publicPaths]) {
      const s = typeof u === "string" ? u.trim() : "";
      if (!s || seen.has(s)) continue;
      seen.add(s);
      mergedPaths.push(s);
    }
    if (!mergedPaths.length) return;
  } else {
    mergedPaths = [...publicPaths];
  }

  const first = mergedPaths[0];
  stop.image = appendMode && prevHero ? prevHero : first;
  stop.images = mergedPaths;
  stop.imageCredits = mergedPaths.map((url) => ({ url, source: "atoc-korea" }));

  stop.galleryItems = mergedPaths.map((src, i) => ({
    id: i + 1,
    type: "photo",
    src,
    location: nameRef,
    caption: `${nameRef} — photo ${i + 1}`,
    alt: `${nameRef} — gallery image ${i + 1}`,
  }));
}

function walkItineraryStops(node, fn) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const x of node) walkItineraryStops(x, fn);
    return;
  }
  if (typeof node !== "object") return;
  if (Array.isArray(node.itineraryStops)) {
    for (const stop of node.itineraryStops) fn(stop);
  }
  for (const k of Object.keys(node)) walkItineraryStops(node[k], fn);
}

function jsonFileToSlugLocale(relPath) {
  const m = relPath.match(
    /product-tour-static[/\\]([^/\\]+)[/\\]([^/\\]+)\.(en|ko|ja|es|zh|zh-TW)\.json$/,
  );
  if (!m) return null;
  const folder = m[1];
  const fileSlug = m[2];
  if (folder !== fileSlug) return null;
  return { slug: folder, locale: m[3] };
}

async function convertToWebpBuffer(buf) {
  return sharp(buf)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

async function main() {
  loadEnvLocal();

  const dryRun = argvHas("--dry-run");
  const append = argvHas("--append");
  const noStorage = argvHas("--no-storage");
  const noDb = argvHas("--no-db");

  const ix = process.argv.indexOf("--source");
  const sourceRoot =
    ix >= 0 && process.argv[ix + 1]
      ? process.argv[ix + 1]
      : "D:/Atoc Photos/modified";

  if (!existsSync(sourceRoot)) {
    console.error(`Source folder not found: ${sourceRoot}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let supabase = null;
  if (!noStorage || !noDb) {
    if (!supabaseUrl || !supabaseKey) {
      console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
      process.exit(1);
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }

  /** @type {{ poiKeys: string[], paths: string[], poiKeysSet: Set<string>, nameGuard: RegExp | null }[]} */
  const importBatches = [];

  const dirs = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let wroteAnyFile = false;

  for (const dirName of dirs) {
    if (SKIP_FOLDERS.has(dirName)) {
      console.log(`Skip folder: ${dirName}`);
      continue;
    }
    const spec = FOLDER_MAP[dirName];
    if (!spec) {
      console.warn(`No mapping for folder "${dirName}" — add to FOLDER_MAP in script`);
      continue;
    }

    const dirPath = join(sourceRoot, dirName);
    const files = readdirSync(dirPath)
      .map((f) => join(dirPath, f))
      .filter((p) => {
        try {
          if (!statSync(p).isFile()) return false;
          return IMG_EXT.has(extname(p).toLowerCase());
        } catch {
          return false;
        }
      })
      .sort();

    if (!files.length) {
      console.warn(`No images in ${dirPath}`);
      continue;
    }

    const outDir = join(ROOT, "public", "images", "tours", spec.assetSlug);
    if (!dryRun) {
      mkdirSync(outDir, { recursive: true });
      if (!append && existsSync(outDir)) {
        for (const f of readdirSync(outDir)) {
          if (f.toLowerCase().endsWith(".webp")) unlinkSync(join(outDir, f));
        }
      }
    }

    const publicPaths = [];
    for (let i = 0; i < files.length; i++) {
      const srcFile = files[i];
      const base = webpStemFromFile(srcFile, i);
      const { outPath, name: outName } =
        append && !dryRun && existsSync(outDir)
          ? uniqueWebpOutPath(outDir, base)
          : { outPath: join(outDir, `${base}.webp`), name: `${base}.webp` };
      const pub = `/images/tours/${spec.assetSlug}/${outName}`;

      if (dryRun) {
        console.log(`[dry-run] ${srcFile} → ${outPath} (${pub})`);
        publicPaths.push(pub);
        continue;
      }

      const inputBuf = readFileSync(srcFile);
      const webpBuf = await convertToWebpBuffer(inputBuf);
      writeFileSync(outPath, webpBuf);
      publicPaths.push(pub);
      wroteAnyFile = true;
      console.log(`WebP: ${srcFile} → ${outPath}`);

      if (!noStorage && supabase) {
        const storagePath = `atoc-photos/${spec.assetSlug}/${outName}`;
        const { error } = await supabase.storage
          .from("tour-images")
          .upload(storagePath, webpBuf, {
            contentType: "image/webp",
            upsert: true,
          });
        if (error) console.error(`Storage upload error ${storagePath}:`, error.message);
        else console.log(`Storage OK: tour-images/${storagePath}`);
      }
    }

    console.log(
      `Folder "${dirName}" → ${publicPaths.length} WebP, keys: ${spec.poiKeys.length ? spec.poiKeys.join(", ") : "(assets only)"}`,
    );

    if (!spec.skipJson && spec.poiKeys.length) {
      const poiKeysSet = new Set(spec.poiKeys);
      const guard = spec.nameGuard ?? null;
      const existing = importBatches.find(
        (b) => setsEqual(b.poiKeysSet, poiKeysSet) && b.nameGuard === guard,
      );
      if (existing) {
        existing.paths.push(...publicPaths);
        console.log(`Merged into existing batch (${spec.poiKeys.join(", ")}), +${publicPaths.length} images`);
      } else {
        importBatches.push({
          poiKeys: spec.poiKeys,
          paths: [...publicPaths],
          poiKeysSet,
          nameGuard: guard,
        });
      }
    }
  }

  if (!importBatches.length) {
    console.log(
      wroteAnyFile
        ? "Images written; no JSON batches (assets-only folders or empty keys)."
        : "Nothing to do.",
    );
    if (!wroteAnyFile) return;
  }

  const staticRoot = join(ROOT, "components", "product-tour-static");
  const modifiedJson = [];

  function visitTourJson(absPath) {
    const rel = absPath.slice(ROOT.length + 1).replace(/\\/g, "/");
    const id = jsonFileToSlugLocale(rel);
    if (!id) return;

    let data;
    try {
      data = JSON.parse(readFileSync(absPath, "utf8"));
    } catch {
      return;
    }

    let touched = false;
    walkItineraryStops(data, (stop) => {
      if (!stop || typeof stop !== "object") return;
      const pk = stop?._poi_meta?.poi_key;
      const matching = importBatches.filter((b) => stopMatchesBatch(stop, b));
      if (!matching.length) return;
      matching.sort((a, b) => {
        const aPri = pk && a.poiKeysSet.has(pk) ? 0 : 1;
        const bPri = pk && b.poiKeysSet.has(pk) ? 0 : 1;
        return aPri - bPri;
      });
      applyStopImages(stop, matching[0].paths, stop.name, append);
      touched = true;
    });

    const thumb = firstCatalogImageFromPayload(data);
    if (thumb && applyCatalogHeroThumbnails(data, thumb)) touched = true;
    if (syncRootGalleryFromItinerary(data)) touched = true;

    if (touched) {
      if (!dryRun) {
        writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      }
      modifiedJson.push({ ...id, absPath });
      console.log(`${dryRun ? "[dry-run] would update" : "Updated"} ${rel}`);
    }
  }

  function walkTourDir(d) {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walkTourDir(p);
      else if (ent.isFile() && /\.(en|ko|ja|es|zh|zh-TW)\.json$/.test(ent.name)) {
        visitTourJson(p);
      }
    }
  }

  if (importBatches.length) {
    walkTourDir(staticRoot);
  }

  if (importBatches.length && !modifiedJson.length) {
    console.log("No itinerary stops matched processed POI batches (check poi_key / nameGuard).");
  }

  if (!noDb && supabase && !dryRun && modifiedJson.length) {
    const done = new Set();
    for (const { slug, locale } of modifiedJson) {
      const key = `${slug}|${locale}`;
      if (done.has(key)) continue;
      done.add(key);
      const fp = join(staticRoot, slug, `${slug}.${locale}.json`);
      const payload = JSON.parse(readFileSync(fp, "utf8"));
      const heroRel = firstCatalogImageFromPayload(payload);
      const { error } = await supabase
        .from("tour_product_pages")
        .update({
          detail_payload: payload,
          ...(heroRel
            ? { hero_image_url: heroRel, thumbnail_url: heroRel }
            : {}),
        })
        .eq("slug", slug)
        .eq("locale", locale);
      if (error) console.warn(`DB update ${slug}/${locale}: ${error.message}`);
      else console.log(`DB detail_payload synced: ${slug} (${locale})`);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
