/**
 * Curated stop-image fill (one slug at a time).
 *
 * For each substantive stop, REPLACES `images[]` with a fixed mix:
 *   - VisitJeju  N (default 3) — official Jeju tourism photos (Korean POIs only)
 *   - Flickr     N (default 4) — CC-licensed, sorted by interestingness
 *   - Unsplash   N (default 1) — emotional / popular
 *   - Pixabay    N (default 1) — emotional / popular
 *
 * Default total: 9 photos / stop. Skipped stops (lunch / pickup) are wiped.
 *
 * Per-stop search keywords are read from `lib/stock-images/curatedKeywords.ts`
 * via `poi_key` so we can hand-tune per spot (e.g. Jeju Stone Park needs
 * dolhareubang variants for Flickr matching).
 *
 * Photo credits (photographer, license, source page) are stored in a parallel
 * `imageCredits[]` field at the same index as the image URL. The renderer can
 * surface attribution from this without extra API calls.
 *
 * Usage:
 *   npx tsx scripts/tour-fill-images-curated.ts --slug east-signature-nature-core
 *   npx tsx scripts/tour-fill-images-curated.ts --slug east-signature-nature-core --dry-run
 *   npx tsx scripts/tour-fill-images-curated.ts --slug east-signature-nature-core \
 *       --visitjeju 3 --flickr 4 --unsplash 1 --pixabay 1
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { searchUnsplashPhotoUrls } from "../lib/stock-images/unsplashSearch";
import { searchPixabayPhotoUrls } from "../lib/stock-images/pixabaySearch";
import { searchFlickrPhotos, FlickrApiError } from "../lib/stock-images/flickrSearch";
import { searchVisitJejuPhotos } from "../lib/stock-images/visitJejuSearch";
import {
  verifyImagesMatchPoi,
  type VerifyImageInput,
  type VisionVerifyResult,
} from "../lib/vision/geminiImageVerify";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- tsx
// @ts-expect-error import.meta under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STATIC = join(ROOT, "components", "product-tour-static");

function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function argFlag(name: string): string | undefined {
  const ix = process.argv.indexOf(name);
  return ix >= 0 && process.argv[ix + 1] ? process.argv[ix + 1] : undefined;
}
function argInt(name: string, dflt: number): number {
  const v = argFlag(name);
  if (!v) return dflt;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

type Stop = {
  number?: number;
  name?: string;
  category?: string;
  image?: string;
  images?: unknown;
  imageCredits?: unknown;
  _poi_meta?: { poi_key?: string };
};

function isSkippable(s: Stop): boolean {
  const name = (s.name || "").toLowerCase();
  const cat = (s.category || "").toLowerCase();
  const pk = (s._poi_meta?.poi_key || "").toLowerCase();
  if (pk.startsWith("ops_lunch") || pk.startsWith("lunch_")) return true;
  if (pk.startsWith("route_variant_") || pk === "route_variant_custom") return true;
  if (cat.includes("pickup") || cat.includes("drop") || cat.includes("logistics")) return true;
  if (cat === "lunch" || /^lunch\s*\(/i.test(s.name || "") || /^lunch\s+[—–-]/i.test(s.name || "")) return true;
  if (/lunch|점심|ランチ|午餐|午歺/i.test(name) || /lunch|점심|ランチ|午餐|午歺|midday|식사|cuisine/i.test(cat)) return true;
  if (/pickup|drop-?off|dropoff|terminal pickup|cruise terminal|픽업|드롭|하차|집결|집합\s*장소/.test(name)) return true;
  if (/^hotel\s+pickup|^free\s+time|^rest\s+at\s|^transit\s+only/i.test(name)) return true;
  return false;
}

function poiKeyForStop(s: Stop): string {
  return (
    s._poi_meta?.poi_key?.trim() ||
    (s.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96)
  );
}

function regionFromSlug(slug: string): string {
  if (slug.includes("jeju") || slug === "east-signature-nature-core" || slug === "southwest-hallasan-osulloc-aewol") return "Jeju";
  if (slug.includes("busan")) return "Busan";
  if (slug.includes("seoul")) return "Seoul";
  if (slug.includes("gyeongju")) return "Gyeongju";
  return "Korea";
}

/** Jeju Island bounding box for Flickr geo filter (lon_min,lat_min,lon_max,lat_max). */
const JEJU_BBOX = "126.0,33.1,127.0,33.7";

/** Per-POI keyword overrides for sources that need hand-tuning. */
const POI_KEYWORDS: Record<
  string,
  {
    flickr: string[];
    /** Flickr tag tokens (no spaces) — passed alongside bbox for geo+tag filter. */
    flickrTags?: string[];
    visitjeju: string[];
    unsplash: string[];
    pixabay: string[];
    /** English POI display name — used in Vision verify prompt. */
    enName: string;
    /** Korean POI name — disambiguates for the model. */
    koName?: string;
    /** Short visual description Gemini uses to judge "does it match". */
    visualHint: string;
  }
> = {
  jeju_stone_park: {
    flickr: ["dolhareubang Jeju", "Jeju Stone Culture Park", "dolharubang stone Jeju"],
    flickrTags: ["dolhareubang", "dolharubang", "jejustonepark"],
    visitjeju: ["제주돌문화공원"],
    unsplash: ["dolhareubang Jeju stone statue", "Jeju stone park dolharubang"],
    pixabay: ["dolhareubang Jeju Korea", "Jeju stone harubang"],
    enName: "Jeju Stone Park",
    koName: "제주돌문화공원",
    visualHint:
      "stone grandfather statues (dolhareubang) or volcanic rock sculptures in an outdoor park / open meadow setting",
  },
  seopjikoji: {
    flickr: [
      "Seopjikoji Jeju",
      "Seopjikoji cape",
      "Seopjikoji lighthouse",
      "Seopjikoji canola",
      "섭지코지",
    ],
    flickrTags: ["seopjikoji", "seopjikojicape", "seopjikojilighthouse"],
    visitjeju: ["섭지코지", "신양섭지", "섭지코지 등대"],
    unsplash: [
      "Seopjikoji Jeju canola",
      "Jeju east cape lighthouse",
      "Seopjikoji cape sunrise",
      "Jeju peninsula coast cliffs",
    ],
    pixabay: [
      "Seopjikoji Jeju cape",
      "Jeju canola flower coast",
      "Jeju east coast lighthouse",
    ],
    enName: "Seopjikoji",
    koName: "섭지코지",
    visualHint:
      "coastal cape on Jeju's east coast — wide green/yellow grassy headland reaching into the sea with a small white lighthouse, basalt sea cliffs, or canola fields above the ocean. Often features Seongsan Ilchulbong visible in the distance",
  },
  seongsan_ilchulbong: {
    flickr: ["Seongsan Ilchulbong", "Sunrise Peak Jeju UNESCO"],
    flickrTags: ["seongsanilchulbong", "sunrisepeak", "ilchulbong"],
    visitjeju: ["성산일출봉", "성산"],
    unsplash: ["Seongsan Ilchulbong sunrise crater", "Jeju sunrise peak"],
    pixabay: ["Seongsan Ilchulbong Jeju crater", "Jeju sunrise peak UNESCO"],
    enName: "Seongsan Ilchulbong (Sunrise Peak)",
    koName: "성산일출봉",
    visualHint:
      "iconic green volcanic tuff cone rising sharply from the sea with a grassland slope; often shot at sunrise or from the ridge with the bowl-shaped crater visible",
  },
  ilchulland_micheon_cave: {
    flickr: ["Manjanggul lava cave Jeju", "Jeju lava tube cave"],
    flickrTags: ["manjanggul", "lavatube", "jejucave"],
    visitjeju: ["일출랜드", "미천굴"],
    unsplash: ["Jeju lava cave atmospheric", "lava tube tunnel"],
    pixabay: ["Jeju lava cave", "lava tube cave"],
    enName: "Ilchul Land / Micheon Cave",
    koName: "일출랜드 미천굴",
    visualHint:
      "lava tube cave interior with dark stone walls and lit pathway, OR a themed outdoor cactus / sculpture garden park",
  },
  seongeup_folk_village: {
    flickr: ["Seongeup Folk Village Jeju", "Jeju traditional folk village"],
    flickrTags: ["seongeup", "folkvillage", "jejufolkvillage"],
    visitjeju: ["성읍민속마을", "성읍"],
    unsplash: ["Seongeup folk village Jeju hanok", "Korean traditional village thatched"],
    pixabay: ["Korean folk village thatched roof", "hanok village stone wall"],
    enName: "Seongeup Folk Village",
    koName: "성읍민속마을",
    visualHint:
      "traditional Korean thatched-roof houses with low black volcanic stone walls forming village lanes",
  },
};

function fallbackKeywords(stopName: string, region: string): {
  flickr: string[];
  visitjeju: string[];
  unsplash: string[];
  pixabay: string[];
} {
  const cleanEn = stopName
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    flickr: cleanEn ? [`${cleanEn} ${region}`, `${cleanEn} Korea`] : [`${region} landscape Korea`],
    visitjeju: [],
    unsplash: cleanEn ? [`${cleanEn} ${region}`, `${cleanEn} Korea landscape`] : [`${region} landscape`],
    pixabay: cleanEn ? [`${cleanEn} ${region} Korea`, `${cleanEn} Korea`] : [`${region} Korea`],
  };
}

type ImageCredit = {
  url: string;
  source: "visitjeju" | "flickr" | "unsplash" | "pixabay";
  author?: string;
  license?: string;
  sourceUrl?: string;
  title?: string;
};

const FLICKR_LICENSE_LABELS: Record<string, string> = {
  "4": "CC BY 2.0",
  "5": "CC BY-SA 2.0",
  "6": "CC BY-ND 2.0",
  "7": "No known copyright restrictions",
  "9": "CC0 1.0",
  "10": "Public Domain Mark 1.0",
};

/** Aesthetic / match thresholds applied to Vision results. */
const MATCH_CONFIDENCE_MIN = 0.6;
const AESTHETIC_MIN = 0.6;
/** Per-source oversample multiplier — ask for ~2x what we need so verifier has room to reject. */
const OVERSAMPLE = 2;
/** Floor — never oversample below this many candidates per source (so even count=1 sources have rejects). */
const OVERSAMPLE_FLOOR = 4;

type Candidate = {
  url: string;
  credit: ImageCredit;
};

function oversample(target: number): number {
  if (target <= 0) return 0;
  return Math.max(target * OVERSAMPLE, OVERSAMPLE_FLOOR);
}

async function fetchAllForStop(opts: {
  poiKey: string;
  stopName: string;
  region: string;
  counts: { visitjeju: number; flickr: number; unsplash: number; pixabay: number };
  visionEnabled: boolean;
}): Promise<{ urls: string[]; credits: ImageCredit[]; report: string }> {
  const fb = fallbackKeywords(opts.stopName, opts.region);
  const kw = POI_KEYWORDS[opts.poiKey];
  // Merge: hand-tuned first, then fallback for variety
  const flickrKws = [...new Set([...(kw?.flickr ?? []), ...fb.flickr])];
  const vjKws = [...new Set([...(kw?.visitjeju ?? []), ...fb.visitjeju])];
  const unsplashKws = [...new Set([...(kw?.unsplash ?? []), ...fb.unsplash])];
  const pixabayKws = [...new Set([...(kw?.pixabay ?? []), ...fb.pixabay])];
  const isJeju = opts.region === "Jeju";

  const cands: Record<ImageCredit["source"], Candidate[]> = {
    visitjeju: [],
    flickr: [],
    unsplash: [],
    pixabay: [],
  };
  const seenUrls = new Set<string>();
  const pushCand = (s: ImageCredit["source"], c: Candidate) => {
    if (seenUrls.has(c.url)) return;
    seenUrls.add(c.url);
    cands[s].push(c);
  };

  // ── Gather oversampled candidates per source ────────────────────────────────

  // 1) VisitJeju (official Jeju curation — usually high-quality, on-topic by API)
  if (process.env.VISIT_JEJU_TOUR_API && opts.counts.visitjeju > 0 && vjKws.length > 0 && isJeju) {
    try {
      const r = await searchVisitJejuPhotos({
        keywords: vjKws,
        maxUrls: oversample(opts.counts.visitjeju),
      });
      for (const p of r) {
        pushCand("visitjeju", {
          url: p.url,
          credit: { url: p.url, source: "visitjeju", title: p.contentTitle },
        });
      }
    } catch {
      /* continue */
    }
  }

  // 2) Flickr — geo-fenced (bbox) + tag-mode for Jeju; free-text fallback if too few hits
  if (process.env.FLICKR_API_KEY && opts.counts.flickr > 0) {
    const need = oversample(opts.counts.flickr);
    const tags = (kw?.flickrTags ?? []).join(",");

    // Pass A: bbox + tags (Jeju) → tightest filter
    if (isJeju && tags) {
      try {
        const r = await searchFlickrPhotos({
          tags,
          tagMode: "any",
          bbox: JEJU_BBOX,
          maxUrls: need,
          perPage: Math.max(need + 5, 30),
          minViews: 100,
        });
        for (const p of r) {
          pushCand("flickr", {
            url: p.url,
            credit: {
              url: p.url,
              source: "flickr",
              author: p.ownerName,
              license: FLICKR_LICENSE_LABELS[p.license] ?? p.license,
              sourceUrl: p.photoPage,
              title: p.title,
            },
          });
        }
      } catch (e: unknown) {
        if (e instanceof FlickrApiError) console.warn(`    [flickr bbox+tags] ${e.message.slice(0, 100)}`);
      }
    }

    // Pass B: bbox + free text (Jeju) — broader if tag pool was thin
    if (isJeju && cands.flickr.length < need) {
      for (const q of flickrKws) {
        if (cands.flickr.length >= need) break;
        try {
          const r = await searchFlickrPhotos({
            query: q,
            bbox: JEJU_BBOX,
            maxUrls: need,
            perPage: Math.max(need + 5, 30),
            minViews: 100,
          });
          for (const p of r) {
            if (cands.flickr.length >= need) break;
            pushCand("flickr", {
              url: p.url,
              credit: {
                url: p.url,
                source: "flickr",
                author: p.ownerName,
                license: FLICKR_LICENSE_LABELS[p.license] ?? p.license,
                sourceUrl: p.photoPage,
                title: p.title,
              },
            });
          }
        } catch (e: unknown) {
          if (e instanceof FlickrApiError) console.warn(`    [flickr bbox+text] ${e.message.slice(0, 100)}`);
        }
      }
    }

    // Pass C: free text only — last resort when bbox passes were thin (also runs for non-Jeju)
    if (cands.flickr.length < need) {
      for (const q of flickrKws) {
        if (cands.flickr.length >= need) break;
        try {
          const r = await searchFlickrPhotos({
            query: q,
            maxUrls: need,
            perPage: Math.max(need + 5, 20),
            minViews: isJeju ? 100 : 200,
          });
          for (const p of r) {
            if (cands.flickr.length >= need) break;
            pushCand("flickr", {
              url: p.url,
              credit: {
                url: p.url,
                source: "flickr",
                author: p.ownerName,
                license: FLICKR_LICENSE_LABELS[p.license] ?? p.license,
                sourceUrl: p.photoPage,
                title: p.title,
              },
            });
          }
        } catch (e: unknown) {
          if (e instanceof FlickrApiError) console.warn(`    [flickr text] ${e.message.slice(0, 100)}`);
        }
      }
    }
  }

  // 3) Unsplash
  if (process.env.UNSPLASH_ACCESS_KEY && opts.counts.unsplash > 0 && unsplashKws.length > 0) {
    const need = oversample(opts.counts.unsplash);
    for (const q of unsplashKws) {
      if (cands.unsplash.length >= need) break;
      try {
        const r = await searchUnsplashPhotoUrls({
          query: q,
          maxUrls: need,
          perPage: Math.max(need + 3, 8),
          orientation: "landscape",
        });
        for (const u of r.urls) {
          if (cands.unsplash.length >= need) break;
          pushCand("unsplash", { url: u, credit: { url: u, source: "unsplash" } });
        }
      } catch {
        /* continue */
      }
    }
  }

  // 4) Pixabay
  if (process.env.PIXABAY_API_KEY && opts.counts.pixabay > 0 && pixabayKws.length > 0) {
    const need = oversample(opts.counts.pixabay);
    for (const q of pixabayKws) {
      if (cands.pixabay.length >= need) break;
      try {
        const r = await searchPixabayPhotoUrls({
          query: q,
          maxUrls: need,
          perPage: Math.max(need + 5, 15),
          orientation: "horizontal",
          imageType: "photo",
          minWidth: 1000,
        });
        for (const u of r.urls) {
          if (cands.pixabay.length >= need) break;
          pushCand("pixabay", { url: u, credit: { url: u, source: "pixabay" } });
        }
      } catch {
        /* continue */
      }
    }
  }

  // ── Vision verification ──────────────────────────────────────────────────────
  // Pre-filter: drop candidates Gemini says don't match POI or look ugly.
  // VisitJeju is API-curated for the exact POI tag — skip vision (saves quota & those photos
  // are the official anchor reference for what the POI looks like).

  const allFlat: Array<{ source: ImageCredit["source"]; cand: Candidate; verifyIdx: number | null }> = [];
  const verifyInputs: VerifyImageInput[] = [];
  const poiEn = kw?.enName ?? opts.stopName;
  const poiKo = kw?.koName;
  const visualHint = kw?.visualHint;

  for (const s of ["visitjeju", "flickr", "unsplash", "pixabay"] as const) {
    for (const c of cands[s]) {
      if (s === "visitjeju" || !opts.visionEnabled) {
        allFlat.push({ source: s, cand: c, verifyIdx: null });
      } else {
        const idx = verifyInputs.length;
        verifyInputs.push({ imageUrl: c.url, poiName: poiEn, poiKoName: poiKo, visualHint });
        allFlat.push({ source: s, cand: c, verifyIdx: idx });
      }
    }
  }

  let verified: VisionVerifyResult[] = [];
  if (verifyInputs.length > 0) {
    verified = await verifyImagesMatchPoi(verifyInputs, { concurrency: 3, timeoutMs: 15_000 });
  }

  const passed: Record<ImageCredit["source"], Candidate[]> = {
    visitjeju: [],
    flickr: [],
    unsplash: [],
    pixabay: [],
  };
  let visionOk = 0;
  let visionRejected = 0;
  let visionFailed = 0;

  for (const item of allFlat) {
    if (item.verifyIdx == null) {
      // VisitJeju (API-curated) or vision disabled — accept
      passed[item.source].push(item.cand);
      continue;
    }
    const v = verified[item.verifyIdx];
    if (!v.ok) {
      visionFailed++;
      continue;
    }
    if (
      v.matches &&
      v.confidence >= MATCH_CONFIDENCE_MIN &&
      v.aestheticScore >= AESTHETIC_MIN
    ) {
      passed[item.source].push(item.cand);
      visionOk++;
    } else {
      visionRejected++;
    }
  }

  // ── Take top N per source up to target counts ───────────────────────────────
  const finalUrls: string[] = [];
  const finalCredits: ImageCredit[] = [];
  const seenFinal = new Set<string>();
  const take = (s: ImageCredit["source"], target: number) => {
    let got = 0;
    for (const c of passed[s]) {
      if (got >= target) break;
      if (seenFinal.has(c.url)) continue;
      seenFinal.add(c.url);
      finalUrls.push(c.url);
      finalCredits.push(c.credit);
      got++;
    }
    return got;
  };
  const vjGot = take("visitjeju", opts.counts.visitjeju);
  const flGot = take("flickr", opts.counts.flickr);
  const usGot = take("unsplash", opts.counts.unsplash);
  const pbGot = take("pixabay", opts.counts.pixabay);

  const candCount = `cand vj:${cands.visitjeju.length} fl:${cands.flickr.length} us:${cands.unsplash.length} pb:${cands.pixabay.length}`;
  const visionLine = opts.visionEnabled
    ? ` | vision ok:${visionOk} rej:${visionRejected} fail:${visionFailed}`
    : "";
  const filledLine = `filled vj:${vjGot}/${opts.counts.visitjeju} fl:${flGot}/${opts.counts.flickr} us:${usGot}/${opts.counts.unsplash} pb:${pbGot}/${opts.counts.pixabay}`;
  return {
    urls: finalUrls,
    credits: finalCredits,
    report: `${candCount}${visionLine} | ${filledLine}`,
  };
}

function isSubstantive(s: Stop): boolean {
  return !!s.name && typeof s.number === "number" && !isSkippable(s);
}

function applyToDoc(
  doc: Record<string, unknown>,
  byPoi: ReadonlyMap<string, { urls: string[]; credits: ImageCredit[] }>,
  byNumber: ReadonlyMap<number, { urls: string[]; credits: ImageCredit[] }>
): boolean {
  let changed = false;
  const visit = (node: unknown) => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    const rec = node as Record<string, unknown>;
    const patch = (arr: unknown[]) => {
      for (const item of arr) {
        const st = item as Stop;
        if (!st || typeof st.name !== "string" || typeof st.number !== "number") continue;
        if (isSkippable(st)) {
          // Wipe images on skippable stops (lunch etc) so old leftovers vanish.
          const before = JSON.stringify({ image: st.image, images: st.images, imageCredits: st.imageCredits });
          if (st.image) delete (st as { image?: string }).image;
          if (st.images) (st as { images?: unknown[] }).images = [];
          if (st.imageCredits) (st as { imageCredits?: unknown[] }).imageCredits = [];
          const after = JSON.stringify({ image: st.image, images: st.images, imageCredits: st.imageCredits });
          if (before !== after) changed = true;
          continue;
        }
        const pk = poiKeyForStop(st);
        let bundle = byPoi.get(pk);
        if (!bundle?.urls.length) bundle = byNumber.get(st.number);
        if (!bundle?.urls.length) continue;
        const before = JSON.stringify({ image: st.image, images: st.images, imageCredits: st.imageCredits });
        st.images = bundle.urls;
        st.image = bundle.urls[0];
        (st as { imageCredits?: ImageCredit[] }).imageCredits = bundle.credits;
        const after = JSON.stringify({ image: st.image, images: st.images, imageCredits: st.imageCredits });
        if (before !== after) changed = true;
      }
    };
    if (Array.isArray(rec.itineraryStops)) patch(rec.itineraryStops);
    if (Array.isArray(rec.itinerary_variants)) {
      for (const v of rec.itinerary_variants as Record<string, unknown>[]) {
        if (Array.isArray(v?.stops)) patch(v.stops);
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(doc);
  return changed;
}

async function main() {
  loadEnv();
  const slug = argFlag("--slug") || argFlag("--only");
  if (!slug) {
    console.error("Usage: --slug <tour-slug>");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const noVision = process.argv.includes("--no-vision");
  const visionEnabled = !noVision && !!process.env.GEMINI_API_KEY;
  const counts = {
    visitjeju: argInt("--visitjeju", 3),
    flickr: argInt("--flickr", 4),
    unsplash: argInt("--unsplash", 1),
    pixabay: argInt("--pixabay", 1),
  };

  const dir = join(STATIC, slug);
  if (!existsSync(dir)) {
    console.error("No folder:", dir);
    process.exit(1);
  }
  const enPath = join(dir, `${slug}.en.json`);
  if (!existsSync(enPath)) {
    console.error("No EN doc:", enPath);
    process.exit(1);
  }
  const enDoc = JSON.parse(readFileSync(enPath, "utf8")) as Record<string, unknown>;
  const region = regionFromSlug(slug);
  const stops: Stop[] = Array.isArray(enDoc.itineraryStops)
    ? (enDoc.itineraryStops as Stop[]).filter(isSubstantive)
    : [];
  const uniq = new Map<string, Stop>();
  for (const s of stops) {
    const pk = poiKeyForStop(s);
    if (!uniq.has(pk)) uniq.set(pk, s);
  }

  console.log(
    `[curated] slug=${slug} region=${region} stops=${uniq.size} | ` +
      `vj:${counts.visitjeju} flickr:${counts.flickr} unsplash:${counts.unsplash} pixabay:${counts.pixabay} | ` +
      `vision=${visionEnabled ? "on" : "off"} | dryRun=${dryRun}`
  );
  console.log(
    `sources: ${[
      process.env.VISIT_JEJU_TOUR_API ? "VisitJeju" : null,
      process.env.FLICKR_API_KEY ? "Flickr" : null,
      process.env.UNSPLASH_ACCESS_KEY ? "Unsplash" : null,
      process.env.PIXABAY_API_KEY ? "Pixabay" : null,
      visionEnabled ? "Gemini-Vision" : null,
    ]
      .filter(Boolean)
      .join(" + ") || "(none configured!)"}`
  );

  const byPoi = new Map<string, { urls: string[]; credits: ImageCredit[] }>();
  for (const [pk, st] of uniq.entries()) {
    console.log(`\n  ${pk} (#${st.number} ${st.name?.slice(0, 40)}) …`);
    const { urls, credits, report } = await fetchAllForStop({
      poiKey: pk,
      stopName: st.name!,
      region,
      counts,
      visionEnabled,
    });
    byPoi.set(pk, { urls, credits });
    console.log(`    → +${urls.length} kept | ${report}`);
  }

  // Per-number fallback (variant stops with same number reuse same poi bundle)
  const byNumber = new Map<number, { urls: string[]; credits: ImageCredit[] }>();
  if (Array.isArray(enDoc.itineraryStops)) {
    for (const s of enDoc.itineraryStops as Stop[]) {
      if (!s || typeof s.number !== "number" || isSkippable(s)) continue;
      const bundle = byPoi.get(poiKeyForStop(s));
      if (bundle?.urls.length) byNumber.set(s.number, bundle);
    }
  }

  // Apply across every JSON file in the slug folder
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".bak.json"));
  for (const f of files) {
    const p = join(dir, f);
    const doc = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const changed = applyToDoc(doc, byPoi, byNumber);
    if (!changed) {
      console.log(`  (no change) ${f}`);
      continue;
    }
    if (dryRun) {
      console.log(`  [dry-run] would update ${f}`);
    } else {
      writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      console.log(`  updated ${f}`);
    }
  }

  console.log("\ndone.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
