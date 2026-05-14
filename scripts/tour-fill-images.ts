/**
 * Generic tour-image fill script.
 *
 * For one or many tour folders under `components/product-tour-static/`, fills each
 * substantive itineraryStops[] entry with `images[]` (cap N) and a primary `image`
 * pulled from a 3-source fallback chain:
 *
 *   1. TourAPI 4.0 (Korea Tourism — searchKeyword2 → detailImage2). Korean POI
 *      matching, official high-res photos.
 *   2. Unsplash (existing client). Atmosphere shots and famous-spot fillers.
 *   3. Pexels. Final fallback.
 *
 * Skips lunch / pickup / dropoff / route_variant stops (same rules as the original
 * jeju-only script).
 *
 * Lang spread: changes are applied to every JSON file in the same product folder
 * (en, ko, ja, zh, zh-TW, es, …) so all locales share the same gallery.
 *
 * Env: TOUR_API_KEY (KTO), UNSPLASH_ACCESS_KEY, PEXELS_API_KEY (any subset).
 *
 * Examples:
 *   npx tsx scripts/tour-fill-images.ts --list-only --slug east-signature-nature-core
 *   npx tsx scripts/tour-fill-images.ts --dry-run --slug east-signature-nature-core --max 4
 *   npx tsx scripts/tour-fill-images.ts --slug east-signature-nature-core --max 4 --replace-images
 *
 * Without --slug, defaults to all `jeju-*` folders (legacy behavior).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { searchUnsplashPhotoUrls } from "../lib/stock-images/unsplashSearch";
import { searchPexelsPhotoUrls } from "../lib/stock-images/pexelsSearch";
import { searchPixabayPhotoUrls } from "../lib/stock-images/pixabaySearch";
import {
  searchTourApiImages,
  TourApiError,
} from "../lib/stock-images/tourApiImages";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- tsx
// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STATIC = join(ROOT, "components", "product-tour-static");

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

function cleanSpotLabelForSearch(englishName: string): string {
  return englishName
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]{0,220}\)/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

/** Korean / English keyword variants per known poi_key (for TourAPI EngService2 + KorService2 attempts). */
function tourApiKeywordsForPoi(poiKey: string | undefined): { en: string[]; ko: string[] } {
  const m: Record<string, { en: string[]; ko: string[] }> = {
    seongsan_ilchulbong: {
      en: ["Seongsan Ilchulbong", "Seongsan Ilchulbong Tuff Cone"],
      ko: ["성산일출봉"],
    },
    seopjikoji: {
      en: ["Seopjikoji"],
      ko: ["섭지코지"],
    },
    seongeup_folk_village: {
      en: ["Seongeup Folk Village", "Seongeup-ri Folk Village"],
      ko: ["성읍민속마을"],
    },
    jeju_stone_park: {
      en: ["Jeju Stone Park", "Jeju Stone Culture Park"],
      ko: ["제주돌문화공원"],
    },
    ilchulland_micheon_cave: {
      en: ["Ilchul Land", "Micheon Cave"],
      ko: ["일출랜드", "미천굴"],
    },
    daepo_jusangjeolli_cliff: {
      en: ["Jusangjeolli Cliff", "Daepo Jusangjeolli"],
      ko: ["주상절리", "대포주상절리"],
    },
    cheonjiyeon_falls: {
      en: ["Cheonjiyeon Falls", "Cheonjiyeon Waterfall"],
      ko: ["천지연폭포"],
    },
    cheonjeyeon_falls: {
      en: ["Cheonjeyeon Falls", "Cheonjeyeon Waterfall"],
      ko: ["천제연폭포"],
    },
    jeongbang_falls: {
      en: ["Jeongbang Falls", "Jeongbang Waterfall"],
      ko: ["정방폭포"],
    },
    hallasan_1100_wetland: {
      en: ["Hallasan 1100 Highland Wetland", "Hallasan Mountain"],
      ko: ["1100고지 습지", "한라산"],
    },
    hallasan_eorimok_trail: {
      en: ["Eorimok Trail", "Hallasan Eorimok"],
      ko: ["어리목"],
    },
    hallasan_eoseungsaengak: {
      en: ["Eoseungsaengak Trail", "Hallasan Eoseungsaengak"],
      ko: ["어승생악"],
    },
    hyeopjae_beach: {
      en: ["Hyeopjae Beach"],
      ko: ["협재해수욕장", "협재해변"],
    },
    hamdeok_seoubong_beach: {
      en: ["Hamdeok Beach", "Hamdeok Seoubong Beach"],
      ko: ["함덕해수욕장"],
    },
    hallim_park: {
      en: ["Hallim Park"],
      ko: ["한림공원"],
    },
    camellia_hill: {
      en: ["Camellia Hill"],
      ko: ["카멜리아힐"],
    },
    osulloc_tea_museum: {
      en: ["Osulloc Tea Museum"],
      ko: ["오설록 티 뮤지엄", "오설록"],
    },
    songaksan: {
      en: ["Songaksan", "Mt Songaksan"],
      ko: ["송악산"],
    },
    olle_maeil_market: {
      en: ["Seogwipo Maeil Olle Market", "Maeil Market"],
      ko: ["서귀포매일올레시장"],
    },
    jeju_haenyeo_museum: {
      en: ["Jeju Haenyeo Museum"],
      ko: ["제주해녀박물관", "해녀박물관"],
    },
    hueree_natural_park: {
      en: ["Hueree Natural Park"],
      ko: ["휴애리자연생활공원"],
    },
  };
  return m[poiKey ?? ""] ?? { en: [], ko: [] };
}

/** Unsplash hint queries (legacy — second-tier fallback). */
function unsplashHintsForPoi(poiKey: string | undefined): string[] {
  if (!poiKey) return [];
  const h: Record<string, string[]> = {
    seongeup_folk_village: [
      "Seongeup Folk Village Jeju Korea traditional hanok",
      "Korean folk village stone wall Jeju",
    ],
    ilchulland_micheon_cave: ["lava cave Jeju Korea", "Jeju volcanic cave"],
    jeju_stone_park: ["Jeju dolharubang stone statue", "Jeju stone culture park"],
    seopjikoji: ["Seopjikoji cape Jeju coast", "Jeju east coast lighthouse"],
    seongsan_ilchulbong: [
      "Seongsan Ilchulbong crater Jeju UNESCO",
      "Jeju Sunrise Peak crater",
    ],
    daepo_jusangjeolli_cliff: ["Jusangjeolli cliffs Jeju basalt columns"],
    cheonjiyeon_falls: ["Cheonjiyeon waterfall Jeju"],
    cheonjeyeon_falls: ["Cheonjeyeon waterfalls Jeju three tier falls"],
    jeongbang_falls: ["Jeongbang waterfall Jeju ocean cliff"],
    hallasan_1100_wetland: ["Hallasan mountain Jeju trail", "Hallasan 1100 wetland"],
    olle_maeil_market: ["traditional market Jeju Seogwipo"],
    hyeopjae_beach: ["Hyeopjae beach Jeju white sand turquoise"],
    hallim_park: ["Hallim park Jeju bonsai lava cave gardens"],
    camellia_hill: ["Jeju Camellia Arboretum garden winter flowers"],
    osulloc_tea_museum: ["Osulloc tea field Jeju green tea plantation"],
    songaksan: ["Songaksan Jeju volcanic coast oreum hike"],
    hallasan_eorimok_trail: ["Hallasan trail Jeju forest"],
    hallasan_eoseungsaengak: ["Hallasan trail Jeju mountain forest"],
    jeju_tangerine_picking_experience: ["tangerine farm Jeju orchard harvest"],
    hueree_natural_park: ["Jeju Hydrangea garden farm flowers purple"],
  };
  return h[poiKey] ?? [];
}

function buildUnsplashQueries(poiKey: string | undefined, englishName: string, region: string): string[] {
  const bare = cleanSpotLabelForSearch(englishName);
  const hints = unsplashHintsForPoi(poiKey);
  const out = [
    bare ? `${bare} ${region}`.slice(0, 200) : `${region} landscape`,
    bare ? `${bare} Korea`.slice(0, 200) : `${region} Korea landscape`,
    ...hints,
    `${primaryWords(englishName, 6)} ${region} Korea`,
    `${primaryWords(englishName, 4)} Korea nature`,
  ];
  return [...new Set(out.filter((q) => q && q.length > 3))];
}

type FetchResult = { urls: string[]; source: "tourapi" | "unsplash" | "pexels" | "pixabay" | "mix" | "none"; usedQuery?: string };

/** ADD mode — pull N from Unsplash + N from Pexels + N from Pixabay, do NOT call TourAPI.
 *  Used to layer atmospheric stock photos on top of the existing official TourAPI set. */
async function fetchMixAddImagesForPoi(
  stopName: string,
  poiKey: string | undefined,
  region: string,
  perSource: number,
  delayMs: number
): Promise<{ urls: string[]; perSource: { unsplash: number; pexels: number; pixabay: number } }> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const collected: string[] = [];
  const counts = { unsplash: 0, pexels: 0, pixabay: 0 };

  if (process.env.UNSPLASH_ACCESS_KEY) {
    for (const q of buildUnsplashQueries(poiKey, stopName, region)) {
      if (counts.unsplash >= perSource) break;
      try {
        const r = await searchUnsplashPhotoUrls({
          query: q,
          perPage: Math.max(perSource, 5),
          maxUrls: perSource,
          orientation: "landscape",
        });
        for (const u of r.urls) {
          if (counts.unsplash >= perSource) break;
          if (!collected.includes(u)) {
            collected.push(u);
            counts.unsplash++;
          }
        }
      } catch {
        /* try next */
      }
    }
  }
  if (delayMs > 0) await sleep(delayMs);

  if (process.env.PEXELS_API_KEY) {
    const bare = cleanSpotLabelForSearch(stopName) || primaryWords(stopName, 4);
    const pexelsAttempts = [
      `${bare} ${region} Korea`.slice(0, 150),
      `${bare} Korea landscape`.slice(0, 150),
    ];
    for (const q of [...new Set(pexelsAttempts)]) {
      if (counts.pexels >= perSource) break;
      try {
        const r = await searchPexelsPhotoUrls({
          query: q,
          perPage: Math.max(perSource, 10),
          maxUrls: perSource,
          orientation: "landscape",
        });
        for (const u of r.urls) {
          if (counts.pexels >= perSource) break;
          if (!collected.includes(u)) {
            collected.push(u);
            counts.pexels++;
          }
        }
      } catch {
        /* try next */
      }
    }
  }
  if (delayMs > 0) await sleep(delayMs);

  if (process.env.PIXABAY_API_KEY) {
    const bare = cleanSpotLabelForSearch(stopName) || primaryWords(stopName, 4);
    const pixabayAttempts = [
      `${bare} ${region} Korea`.slice(0, 100),
      `${bare} Korea`.slice(0, 100),
      `${primaryWords(stopName, 3)} ${region}`.slice(0, 100),
    ].filter((q) => q.length >= 4);
    for (const q of [...new Set(pixabayAttempts)]) {
      if (counts.pixabay >= perSource) break;
      try {
        const r = await searchPixabayPhotoUrls({
          query: q,
          perPage: Math.max(perSource + 5, 12),
          maxUrls: perSource,
          orientation: "horizontal",
          imageType: "photo",
          minWidth: 800,
        });
        for (const u of r.urls) {
          if (counts.pixabay >= perSource) break;
          if (!collected.includes(u)) {
            collected.push(u);
            counts.pixabay++;
          }
        }
      } catch {
        /* try next */
      }
    }
  }

  return { urls: collected, perSource: counts };
}

async function fetchImagesForPoi(
  stopName: string,
  poiKey: string | undefined,
  region: string,
  maxUrls: number,
  delayMs: number
): Promise<FetchResult> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // 1) TourAPI 4.0 — try English service first with En keywords + spot's own English name,
  //    then Korean service with Korean keywords.
  const kw = tourApiKeywordsForPoi(poiKey);
  const bareEn = cleanSpotLabelForSearch(stopName);
  const enKeywords = [...new Set([bareEn, ...kw.en].filter((s) => s.length >= 2))];
  if (process.env.TOUR_API_KEY && enKeywords.length > 0) {
    try {
      const r = await searchTourApiImages({
        keywords: enKeywords,
        service: "EngService2",
        maxUrls,
        delayMs: 250,
      });
      if (r.urls.length > 0) {
        return { urls: r.urls, source: "tourapi", usedQuery: r.usedKeyword };
      }
    } catch (e: unknown) {
      const msg = e instanceof TourApiError ? e.message : String(e);
      console.warn(`    [tourapi:eng] error — ${msg.slice(0, 120)}`);
    }
  }
  if (process.env.TOUR_API_KEY && kw.ko.length > 0) {
    try {
      const r = await searchTourApiImages({
        keywords: kw.ko,
        service: "KorService2",
        maxUrls,
        delayMs: 250,
      });
      if (r.urls.length > 0) {
        return { urls: r.urls, source: "tourapi", usedQuery: r.usedKeyword };
      }
    } catch (e: unknown) {
      const msg = e instanceof TourApiError ? e.message : String(e);
      console.warn(`    [tourapi:kor] error — ${msg.slice(0, 120)}`);
    }
  }

  if (delayMs > 0) await sleep(delayMs);

  // 2) Unsplash — multi-attempt with hint queries
  if (process.env.UNSPLASH_ACCESS_KEY) {
    for (const q of buildUnsplashQueries(poiKey, stopName, region)) {
      try {
        const r = await searchUnsplashPhotoUrls({
          query: q,
          perPage: maxUrls,
          maxUrls,
          orientation: "landscape",
        });
        if (r.urls.length > 0) {
          return { urls: r.urls, source: "unsplash", usedQuery: q };
        }
      } catch {
        /* try next */
      }
    }
  }

  if (delayMs > 0) await sleep(delayMs);

  // 3) Pexels — single attempt with the most natural query
  if (process.env.PEXELS_API_KEY) {
    const pexelsQuery = `${cleanSpotLabelForSearch(stopName) || primaryWords(stopName, 4)} ${region} Korea`.slice(0, 150);
    try {
      const r = await searchPexelsPhotoUrls({
        query: pexelsQuery,
        perPage: Math.max(maxUrls, 10),
        maxUrls,
        orientation: "landscape",
      });
      if (r.urls.length > 0) {
        return { urls: r.urls, source: "pexels", usedQuery: pexelsQuery };
      }
    } catch {
      /* fall through */
    }
  }

  if (delayMs > 0) await sleep(delayMs);

  // 4) Pixabay — final fallback. min_width=800 to keep usable hero candidates.
  //    Pixabay's q maxes at 100 chars; keep query tight.
  if (process.env.PIXABAY_API_KEY) {
    const bare = cleanSpotLabelForSearch(stopName) || primaryWords(stopName, 4);
    const pixabayAttempts = [
      `${bare} ${region} Korea`.slice(0, 100),
      `${bare} Korea`.slice(0, 100),
      `${primaryWords(stopName, 3)} ${region}`.slice(0, 100),
    ].filter((q) => q.length >= 4);
    for (const q of [...new Set(pixabayAttempts)]) {
      try {
        const r = await searchPixabayPhotoUrls({
          query: q,
          perPage: Math.max(maxUrls + 5, 12),
          maxUrls,
          orientation: "horizontal",
          imageType: "photo",
          minWidth: 800,
        });
        if (r.urls.length > 0) {
          return { urls: r.urls, source: "pixabay", usedQuery: q };
        }
      } catch {
        /* try next */
      }
    }
  }

  return { urls: [], source: "none" };
}

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

/** Strip ANY stock-image URL from skippable (lunch/pickup) stops. */
function pruneStockImagesFromSkippableStops(doc: Record<string, unknown>): boolean {
  let changed = false;
  const stockHosts = ["images.unsplash.com", "images.pexels.com", "tong.visitkorea.or.kr", "pixabay.com", "cdn.pixabay.com"];
  const isStockUrl = (u: string) => stockHosts.some((h) => u.includes(h));
  const strip = (st: StopLike & { images?: unknown }) => {
    if (!isSkippableStop(st)) return;
    if (Array.isArray(st.images)) {
      const before = (st.images as unknown[]).length;
      const filtered = (st.images as unknown[]).filter((u) => typeof u === "string" && !isStockUrl(u));
      if (filtered.length !== before) {
        st.images = filtered;
        changed = true;
      }
    }
    if (typeof st.image === "string" && isStockUrl(st.image)) {
      const remaining = Array.isArray(st.images) ? (st.images as string[]).find((u) => typeof u === "string" && u.startsWith("http")) : undefined;
      if (remaining) {
        st.image = remaining;
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

/** Region heuristic for query suffix; falls back to "Korea" if no match. */
function regionFromSlug(slug: string): string {
  if (slug.startsWith("jeju-") || slug.includes("jeju")) return "Jeju";
  if (slug.startsWith("busan-") || slug.includes("busan")) return "Busan";
  if (slug.startsWith("seoul-") || slug.includes("seoul")) return "Seoul";
  if (slug.startsWith("gyeongju-") || slug.includes("gyeongju")) return "Gyeongju";
  if (slug === "east-signature-nature-core" || slug === "southwest-hallasan-osulloc-aewol") return "Jeju";
  return "Korea";
}

async function main() {
  loadEnvLocalDotenvStyle();

  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");
  const listOnly = process.argv.includes("--list-only");
  const replace = process.argv.includes("--replace-images");
  const slug = argvFlag("--slug") || argvFlag("--only");
  const delayMs = Math.max(0, parseInt(argvFlag("--delay-ms") || "1500", 10) || 0);
  const maxImages = Math.min(30, Math.max(1, parseInt(argvFlag("--max") || "4", 10) || 4));
  /** ADD mode: pull N from each of Unsplash/Pexels/Pixabay on top of existing images. Skips TourAPI. */
  const mixAdd = parseInt(argvFlag("--mix-add") || "0", 10) || 0;

  if (!existsSync(STATIC)) {
    console.error("Missing", STATIC);
    process.exit(1);
  }

  const allDirs = readdirSync(STATIC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const dirs = slug ? allDirs.filter((n) => n === slug) : allDirs.filter((n) => n.startsWith("jeju-"));

  if (slug && dirs.length === 0) {
    console.error(`No tour folder matching --slug ${slug}`);
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
    delayMs,
    "| sources:",
    [
      process.env.TOUR_API_KEY ? "TourAPI" : null,
      process.env.UNSPLASH_ACCESS_KEY ? "Unsplash" : null,
      process.env.PEXELS_API_KEY ? "Pexels" : null,
      process.env.PIXABAY_API_KEY ? "Pixabay" : null,
    ]
      .filter(Boolean)
      .join(" → ") || "(none configured!)"
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
    const region = regionFromSlug(dir);

    console.log(`\n== ${dir} — ${sortedPairs.length} unique POIs (region=${region}) ==`);
    for (const [, stop] of sortedPairs) {
      console.log(`  ${String(stop.number!).padStart(2, "0")}. ${stop.name}`);
    }

    if (listOnly) continue;

    if (mixAdd > 0) {
      console.log(`  (mix-add ${mixAdd}/source via Unsplash + Pexels + Pixabay — TourAPI skipped, existing images preserved)`);
      for (const [pk, stop] of sortedPairs) {
        if (GLOBAL_POI_CACHE.has(pk)) {
          poiKeyToUrls.set(pk, GLOBAL_POI_CACHE.get(pk)!);
          continue;
        }
        if (delayMs > 0) await sleep(delayMs);
        const r = await fetchMixAddImagesForPoi(stop.name!, pk, region, mixAdd, delayMs);
        GLOBAL_POI_CACHE.set(pk, r.urls);
        poiKeyToUrls.set(pk, r.urls);
        console.log(
          `  ${pk}: +${r.urls.length} urls (unsplash:${r.perSource.unsplash} pexels:${r.perSource.pexels} pixabay:${r.perSource.pixabay})`
        );
      }
    } else {
      console.log(`  (fetching images via TourAPI → Unsplash → Pexels → Pixabay…)`);
      for (const [pk, stop] of sortedPairs) {
        if (GLOBAL_POI_CACHE.has(pk)) {
          poiKeyToUrls.set(pk, GLOBAL_POI_CACHE.get(pk)!);
          continue;
        }
        if (delayMs > 0) await sleep(delayMs);
        const r = await fetchImagesForPoi(stop.name!, pk, region, maxImages, delayMs);
        GLOBAL_POI_CACHE.set(pk, r.urls);
        poiKeyToUrls.set(pk, r.urls);
        const qLabel = (r.usedQuery ?? "").length > 60 ? `${(r.usedQuery ?? "").slice(0, 60)}…` : r.usedQuery ?? "";
        console.log(
          `  ${pk}: +${r.urls.length} urls [${r.source}] ${qLabel ? JSON.stringify(qLabel) : ""}`
        );
      }
    }

    const numberFallback = buildNumberFallbackFromRoot(enDoc, poiKeyToUrls);

    const effectiveReplace = mixAdd > 0 ? false : replace;
    const effectiveMax = mixAdd > 0 ? Math.max(maxImages, 4) + mixAdd * 3 : maxImages;
    const jsonFiles = readdirSync(join(STATIC, dir)).filter((f) => f.endsWith(".json"));
    for (const file of jsonFiles) {
      const path = join(STATIC, dir, file);
      const doc = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      const changedMerge = applyToDocument(doc, poiKeyToUrls, numberFallback, {
        replace: effectiveReplace,
        max: effectiveMax,
      });
      const changedPrune = pruneStockImagesFromSkippableStops(doc);
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
