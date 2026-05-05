/**
 * 제주(`components/product-tour-static/jeju-*`) 투어 JSON의 모든 itinerary 블록에
 * Unsplash 검색 결과 URL을 `itineraryStops[].images` (및 선택 시 대표 `image`)로 채웁니다.
 *
 * 준비: `.env.local` 에 UNSPLASH_ACCESS_KEY
 *
 *   npx tsx scripts/jeju-tour-fill-unsplash-images.ts --dry-run --only jeju-eastern-unesco-spots-day-tour
 *   npx tsx scripts/jeju-tour-fill-unsplash-images.ts --only jeju-eastern-unesco-spots-day-tour
 *   npx tsx scripts/jeju-tour-fill-unsplash-images.ts --replace-images --delay-ms 2000
 *
 * 관광지만 번호 순으로 출력 후 종료(API 없음):
 *   npx tsx scripts/jeju-tour-fill-unsplash-images.ts --list-only
 *
 * Unsplash 가이드라인(저작자 표시, hotlink 규칙 등) 준수는 서비스 측 UI/정책에서 처리하세요.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { searchUnsplashPhotoUrls } from "../lib/stock-images/unsplashSearch";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- tsx
// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STATIC = join(ROOT, "components", "product-tour-static");

/** poi_key별로 크로스‑상품 재사용 (API 호출·한도 절약) */
const GLOBAL_POI_CACHE = new Map<string, string[]>();

function loadEnvLocalDotenvStyle() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

function argvFlag(flag: string): string | undefined {
  const ix = process.argv.indexOf(flag);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return undefined;
}

type StopLike = {
  number?: number;
  name?: string;
  category?: string;
  image?: string;
  images?: unknown;
  _poi_meta?: { poi_key?: string };
};

function isSkippableStop(s: StopLike): boolean {
  const name = (s.name || "").toLowerCase();
  const cat = (s.category || "").toLowerCase();
  const pk = (s._poi_meta?.poi_key || "").toLowerCase();
  if (pk.startsWith("ops_lunch") || pk.startsWith("lunch_")) return true;
  if (pk.startsWith("route_variant_") || pk === "route_variant_custom") return true;
  if (cat.includes("pickup") || cat.includes("drop") || cat.includes("logistics")) return true;
  if (cat === "lunch" || /^lunch\s*\(/i.test(s.name || "") || /^lunch\s+[—–-]/i.test(s.name || "")) return true;
  if (/lunch|점심|ランチ|午餐|午歺/i.test(name) || /lunch|점심|ランチ|午餐|午歺|midday|식사|cuisine/i.test(cat)) return true;
  if (
    /pickup|drop-?off|dropoff|terminal pickup|cruise terminal|픽업|드롭|하차|집결|집합\s*장소/.test(name)
  ) {
    return true;
  }
  if (/^hotel\s+pickup|^free\s+time|^rest\s+at\s|^transit\s+only/i.test(name)) return true;
  return false;
}

function slugShort(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function stablePoiKey(stop: StopLike): string {
  const pk = stop._poi_meta?.poi_key?.trim();
  if (pk) return pk;
  const slug = slugShort(stop.name || "unknown");
  return slug.length > 0 ? slug : "unknown_stop";
}

/** 브래킷 등 제거한 관광지 표기 — 검색 첫 타자에 이름 우선 사용 */
function cleanSpotLabelForSearch(englishName: string): string {
  return englishName
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]{0,220}\)/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUnsplashQuery(englishName: string): string {
  const s = cleanSpotLabelForSearch(englishName);
  if (!s) return "Jeju Island South Korea landscape";
  return `${s} Jeju South Korea`.slice(0, 200);
}

function primaryWords(name: string, maxWords: number): string {
  return name
    .replace(/\[[^\]]*\]/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\w\s\-가-힣]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, maxWords)
    .join(" ")
    .trim();
}

function poiKeyedSearchHints(poiKey: string | undefined): string[] {
  if (!poiKey) return [];
  const h: Record<string, string[]> = {
    seongeup_folk_village: [
      "Seongeup Folk Village Jeju Korea traditional hanok",
      "Seongeup Jeju thatched roof houses",
      "Korean folk village stone wall Jeju",
      "Jeju traditional village landscape",
    ],
    ilchulland_micheon_cave: ["lava cave Jeju Korea", "Jeju volcanic cave"],
    jeju_haenyeo_museum: ["Jeju diving women Korea haenyeo", "women divers Jeju sea"],
    hamdeok_seoubong_beach: ["Hamdeok beach Jeju turquoise water"],
    seopjikoji: ["Seopjikoji cape Jeju coast", "Jeju east coast lighthouse"],
    daepo_jusangjeolli_cliff: ["Jusangjeolli cliffs Jeju basalt columns"],
    cheonjiyeon_falls: ["Cheonjiyeon waterfall Jeju"],
    hallasan_1100_wetland: ["Hallasan mountain Jeju trail", "Hallasan 1100 wetland"],
    olle_maeil_market: ["traditional market Jeju Seogwipo"],
    hyeopjae_beach: ["Hyeopjae beach Jeju white sand turquoise"],
    hallim_park: ["Hallim park Jeju bonsai lava cave gardens"],
    camellia_hill: ["Jeju Camellia Arboretum garden winter flowers"],
    osulloc_tea_museum: ["Osulloc tea field Jeju green tea plantation"],
    cheonjeyeon_falls: ["Cheonjeyeon waterfalls Jeju three tier falls"],
    songaksan: ["Songaksan Jeju volcanic coast oreum hike"],
    hallasan_eorimok_trail: ["Hallasan trail Jeju dormant volcano forest"],
    jeju_tangerine_picking_experience: ["tangerine farm Jeju orchard harvest"],
    hueree_natural_park: ["Jeju Hydrangea garden farm flowers purple"],
    hallasan_eoseungsaengak: ["Hallasan trail Jeju mountain forest"],
    jeongbang_falls: ["Jeju Jeongbang waterfall ocean cliff waterfall"],
    noksan_ro_gasiri_blossom_road: ["cherry blossom road Jeju scenic drive"],
    jeonnong_ro_cherry_blossom_street: ["cherry blossoms Jeju city street tunnel"],
    ilchulland_themed_gardens: ["theme park garden Jeju flowers landscape"],
    seongsan_ilchulbong: [
      "Seongsan Ilchulbong crater Jeju UNESCO",
      "Seongsan Ilchulbong crater Jeju",
      "Jeju Sunrise Peak crater",
    ],
  };
  return h[poiKey] ?? [];
}

async function fetchUnsplashForPoi(
  stopName: string,
  poiKey: string | undefined,
  perPage: number,
  maxUrls: number
): Promise<{ urls: string[]; rawTotal?: number; usedQuery: string }> {
  const extra = poiKeyedSearchHints(poiKey);
  const bare = cleanSpotLabelForSearch(stopName);
  const attempts = [
    bare ? `${bare} Jeju Korea`.slice(0, 200) : buildUnsplashQuery(stopName),
    buildUnsplashQuery(stopName),
    ...extra,
    `${primaryWords(stopName, 6)} Jeju Korea`,
    `${primaryWords(stopName, 4)} Korea nature`,
  ];
  const dedupAttempts = [...new Set(attempts.filter((q) => q.length > 3))];

  let lastTotal: number | undefined;
  for (const q of dedupAttempts) {
    try {
      const r = await searchUnsplashPhotoUrls({
        query: q,
        perPage,
        maxUrls,
        orientation: "landscape",
      });
      lastTotal = r.rawTotal;
      if (r.urls.length > 0) return { urls: r.urls, rawTotal: r.rawTotal, usedQuery: q };
    } catch {
      /* try next */
    }
  }
  return { urls: [], rawTotal: lastTotal, usedQuery: dedupAttempts[0] ?? stopName };
}

/**
 * authoring 기준 일정 스톱만 수집 (page_sections.duplicate 블록은 제외해서 POI 중복·이중 과금 방지).
 */
function collectAuthoringStopRows(doc: Record<string, unknown>): StopLike[] {
  const out: StopLike[] = [];
  const root = doc.itineraryStops;
  if (Array.isArray(root)) {
    for (const x of root) {
      if (x && typeof x === "object" && typeof (x as StopLike).name === "string") {
        out.push(x as StopLike);
      }
    }
  }
  if (Array.isArray(doc.itinerary_variants)) {
    for (const v of doc.itinerary_variants as Record<string, unknown>[]) {
      if (!Array.isArray(v?.stops)) continue;
      for (const x of v.stops) {
        if (x && typeof x === "object" && typeof (x as StopLike).name === "string") {
          out.push(x as StopLike);
        }
      }
    }
  }
  return out;
}

function collectUniqueSubstantiveStops(enDoc: Record<string, unknown>): Map<string, StopLike> {
  const map = new Map<string, StopLike>();
  const all = collectAuthoringStopRows(enDoc);
  for (const st of all) {
    if (!st.name) continue;
    if (typeof st.number !== "number") continue;
    if (isSkippableStop(st)) continue;
    const pk = stablePoiKey(st);
    if (!map.has(pk)) map.set(pk, st);
    else {
      const prev = map.get(pk)!;
      const prevNum = prev.number ?? 999;
      const nextNum = st.number ?? 999;
      if (nextNum < prevNum) map.set(pk, st);
    }
  }
  return map;
}

/** 한 상품 안에서 사용자에게 보이는 순서(일정 번호)로 관광지 나열용 */
function sortPoiPairsBySchedule(pairs: [string, StopLike][]): [string, StopLike][] {
  return [...pairs].sort((a, b) => {
    const na = a[1].number ?? 0;
    const nb = b[1].number ?? 0;
    if (na !== nb) return na - nb;
    return (a[1].name || "").localeCompare(b[1].name || "", "en");
  });
}

function uniqueUrls(urls: readonly string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string" || !u.startsWith("https://")) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= cap) break;
  }
  return out;
}

function buildNumberFallbackFromRoot(
  enDoc: Record<string, unknown>,
  poiKeyToUrls: ReadonlyMap<string, string[]>
): Map<number, string[]> {
  const m = new Map<number, string[]>();
  const root = enDoc.itineraryStops;
  if (!Array.isArray(root)) return m;
  for (const x of root) {
    const st = x as StopLike;
    if (!st || typeof st.number !== "number") continue;
    if (isSkippableStop(st)) continue;
    const pk = stablePoiKey(st);
    const urls = poiKeyToUrls.get(pk);
    if (urls?.length) m.set(st.number, urls);
  }
  return m;
}

function mergeStopImages(
  stop: StopLike,
  additions: readonly string[],
  options: { replace: boolean; max: number }
): boolean {
  const prevImage = typeof stop.image === "string" && stop.image.startsWith("http") ? stop.image : null;
  const prevImages = Array.isArray(stop.images)
    ? (stop.images as unknown[]).filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    : [];

  let next: string[];
  if (options.replace) {
    next = uniqueUrls([...additions], options.max);
  } else {
    next = uniqueUrls([...(prevImage ? [prevImage] : []), ...prevImages, ...additions], options.max);
  }

  const before = JSON.stringify({ image: stop.image, images: stop.images });
  stop.images = next;
  if (!stop.image || options.replace) {
    stop.image = next[0] ?? stop.image;
  }
  const after = JSON.stringify({ image: stop.image, images: stop.images });
  return before !== after;
}

function applyToDocument(
  doc: Record<string, unknown>,
  poiKeyToUrls: ReadonlyMap<string, string[]>,
  numberFallback: ReadonlyMap<number, string[]>,
  options: { replace: boolean; max: number }
): boolean {
  let changed = false;
  const visit = (node: unknown) => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    const rec = node as Record<string, unknown>;
    const patchArray = (arr: unknown[]) => {
      for (const item of arr) {
        const st = item as StopLike;
        if (!st || typeof st.name !== "string" || typeof st.number !== "number") continue;
        if (isSkippableStop(st)) continue;
        const pk = stablePoiKey(st);
        let urls = poiKeyToUrls.get(pk);
        if (!urls?.length) urls = numberFallback.get(st.number);
        if (!urls?.length) continue;
        if (mergeStopImages(st, urls, options)) changed = true;
      }
    };
    if (Array.isArray(rec.itineraryStops)) patchArray(rec.itineraryStops);
    if (Array.isArray(rec.itinerary_variants)) {
      for (const v of rec.itinerary_variants as Record<string, unknown>[]) {
        if (Array.isArray(v?.stops)) patchArray(v.stops);
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(doc);
  return changed;
}

/** 픽업·런치 등 스킵 스톱에서 잘못 붙은 Unsplash URL만 제거 (비짓제주 등은 유지). */
function pruneUnsplashFromSkippableStops(doc: Record<string, unknown>): boolean {
  let changed = false;
  const strip = (st: StopLike & { images?: unknown }) => {
    if (!isSkippableStop(st)) return;
    if (!Array.isArray(st.images)) return;
    const before = st.images.length;
    const imgs = st.images as string[];
    const filtered = imgs.filter(
      (u) => typeof u === "string" && !u.includes("images.unsplash.com")
    );
    if (filtered.length !== before) {
      st.images = filtered;
      changed = true;
    }
    const pick = filtered.find((u) => typeof u === "string" && u.startsWith("http"));
    if (typeof st.image === "string" && st.image.includes("images.unsplash.com")) {
      if (pick) {
        st.image = pick;
      } else {
        delete (st as { image?: string }).image;
      }
      changed = true;
    }
  };
  const visit = (node: unknown) => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    const rec = node as Record<string, unknown>;
    const walkArr = (arr: unknown[]) => {
      for (const item of arr) {
        if (item && typeof item === "object") strip(item as StopLike & { images?: unknown });
      }
    };
    if (Array.isArray(rec.itineraryStops)) walkArr(rec.itineraryStops);
    if (Array.isArray(rec.itinerary_variants)) {
      for (const v of rec.itinerary_variants as Record<string, unknown>[]) {
        if (Array.isArray(v?.stops)) walkArr(v.stops);
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(doc);
  return changed;
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnvLocalDotenvStyle();

  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");
  const listOnly = process.argv.includes("--list-only");
  const replace = process.argv.includes("--replace-images");
  const only = argvFlag("--only");
  const delayMs = Math.max(0, parseInt(argvFlag("--delay-ms") || "1500", 10) || 0);
  const maxImages = Math.min(30, Math.max(1, parseInt(argvFlag("--max") || "10", 10) || 10));
  const perPage = Math.min(30, Math.max(maxImages, parseInt(argvFlag("--per-page") || String(maxImages), 10) || maxImages));

  if (!existsSync(STATIC)) {
    console.error("Missing", STATIC);
    process.exit(1);
  }

  const dirs = readdirSync(STATIC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("jeju-"))
    .map((d) => d.name)
    .filter((name) => !only || name === only);

  if (only && !dirs.includes(only)) {
    console.error(`No jeju folder matching --only ${only}`);
    process.exit(1);
  }

  console.log(
    listOnly
      ? "[list-only] attractions printed per product — no API, no writes"
      : dryRun
        ? "[dry-run] no files will be written"
        : "writing JSON files",
    "| replace=",
    replace,
    "| maxImages=",
    maxImages,
    "| delayMs=",
    delayMs
  );

  for (const dir of dirs.sort()) {
    const enPath = join(STATIC, dir, `${dir}.en.json`);
    if (!existsSync(enPath)) {
      console.warn("skip (no en):", dir);
      continue;
    }

    const enDoc = JSON.parse(readFileSync(enPath, "utf8")) as Record<string, unknown>;
    const unique = collectUniqueSubstantiveStops(enDoc);
    const poiKeyToUrls = new Map<string, string[]>();
    const sortedPairs = sortPoiPairsBySchedule([...unique.entries()]);

    console.log(`\n== ${dir} — substantive stops (${sortedPairs.length} unique POIs, itinerary order — .en.json) ==`);
    for (const [pk, stop] of sortedPairs) {
      console.log(`  ${String(stop.number!).padStart(2, "0")}. ${stop.name} → search: "${cleanSpotLabelForSearch(stop.name!)} Jeju Korea"`);
    }

    if (listOnly) {
      continue;
    }

    console.log(`  (Unsplash fetch by POI…)`);

    for (const [pk, stop] of sortedPairs) {
      if (GLOBAL_POI_CACHE.has(pk)) {
        poiKeyToUrls.set(pk, GLOBAL_POI_CACHE.get(pk)!);
        continue;
      }
      if (delayMs > 0) await sleep(delayMs);
      const bare = cleanSpotLabelForSearch(stop.name!);
      const q0 = bare ? `${bare} Jeju Korea` : buildUnsplashQuery(stop.name!);
      const { urls, rawTotal, usedQuery } = await fetchUnsplashForPoi(stop.name!, pk, perPage, maxImages);
      GLOBAL_POI_CACHE.set(pk, urls);
      poiKeyToUrls.set(pk, urls);
      const qLabel = usedQuery.length > 72 ? `${usedQuery.slice(0, 72)}…` : usedQuery;
      console.log(
        `  ${pk}: +${urls.length} urls (started ${JSON.stringify(q0.slice(0, 52))}… → used ${JSON.stringify(qLabel)} total≈${rawTotal ?? "?"})`
      );
    }

    const numberFallback = buildNumberFallbackFromRoot(enDoc, poiKeyToUrls);

    const jsonFiles = readdirSync(join(STATIC, dir)).filter((f) => f.endsWith(".json"));
    for (const file of jsonFiles) {
      const path = join(STATIC, dir, file);
      const doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      const changedMerge = applyToDocument(doc, poiKeyToUrls, numberFallback, {
        replace,
        max: maxImages,
      });
      const changedPrune = pruneUnsplashFromSkippableStops(doc);
      const changed = changedMerge || changedPrune;
      if (!changed) {
        console.log(`  (no change) ${file}`);
        continue;
      }
      if (dryRun) {
        console.log(`  [dry-run] would update ${file}`);
      } else {
        writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
        console.log(`  updated ${file}`);
      }
    }
  }

  console.log("\ndone.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
