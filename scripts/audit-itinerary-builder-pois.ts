/**
 * Itinerary Builder — POI Data Quality audit (master plan Phase 1).
 *
 * Audits the POIs that can actually appear in the itinerary builder against the
 * POI Visibility Contract in
 * docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md.
 *
 * WHY THIS IS .ts (not .mjs): it imports the real builder taxonomy
 * `isBuilderAttraction` from lib/itinerary-match-engine/poi-taxonomy.ts so the
 * "visible" set is computed with the SAME predicate as the live page
 * (app/itinerary-builder/[region]/page.tsx:78-80), never a hardcoded
 * `is_attraction = true`. Run it through tsx.
 *
 * "Visible" (verified vs page.tsx:66-80):
 *   region ∈ builder cluster  AND  name_en IS NOT NULL  AND  lat IS NOT NULL
 *   AND ( is_attraction === true  OR
 *         (is_attraction == null AND isBuilderAttraction(poi_key)) )
 *
 * Image validity uses TWO separate signals (do not conflate — master plan
 * "Image Validity"):
 *   SIGNAL A (hard / --strict fail): default_image_url folder-token has no
 *     overlap with poi_key/name_en AND no source (tour-JSON stop OR KB) for this
 *     poi_key references that file → orphan wrong-POI image
 *     (e.g. woljeonggyo → /tours/ahopsan-bamboo/...). Same folder-token heuristic
 *     as seed-match-pois-from-tour-jsons.mjs `isProbablyWrongPoiImage`.
 *   SIGNAL B (soft / warning only): chatgpt-image-*.webp (or other AI markers)
 *     → feeds the photo-quality backlog, NEVER fails --strict.
 *
 * PROVENANCE NOTE (verified 2026-05-21): the KB
 * (data/poi_kb/poi_knowledge_base_v1.29.json) carries NO image field on any of
 * its 82 entries — only visitBasics/convenience/smartNotes. import-match-v18.mjs
 * reads `kbEntry.default_image_url` (always undefined → writes null). So the KB
 * contributes ZERO image references to the Signal-A cross-check; the only image
 * sources are tour-JSON stops + the curated override map + out-of-band writes.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/audit-itinerary-builder-pois.ts
 *   npm run itinerary:poi-audit -- [--json] [--strict] [--region=busan|jeju]
 *
 * --strict exits non-zero ONLY for: missing image on a visible POI; Signal A;
 *   missing description/highlights on a visible POI; empty/absent
 *   visit_basics/convenience/smart_notes on a visible POI. Signal B, a
 *   known-wrong tour-JSON source image, and missing why_on_route never fail
 *   strict. NOTE: --strict cannot go green (nor into CI) until Track B lands the
 *   6 missing real photos — that is expected, not a regression.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { isBuilderAttraction } from "../lib/itinerary-match-engine/poi-taxonomy";
import { BUILDER_POI_IMAGE_OVERRIDES } from "../lib/itinerary-builder/poi-image-overrides.mjs";
import { REGION_CLUSTER, REGION_SLUGS, type RegionSlug } from "../lib/itinerary-builder/regions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const KB_PATH = join(ROOT, "data/poi_kb/poi_knowledge_base_v1.29.json");

// ---------------------------------------------------------------- CLI ----
const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const STRICT = argv.includes("--strict");
const regionArg = argv.find((a) => a.startsWith("--region="))?.split("=")[1];
if (regionArg && !(REGION_SLUGS as readonly string[]).includes(regionArg)) {
  console.error(`Unknown --region=${regionArg}. Valid: ${REGION_SLUGS.join(", ")}`);
  process.exit(2);
}
const inScopeSlugs: readonly RegionSlug[] = regionArg ? [regionArg as RegionSlug] : REGION_SLUGS;
const inScopeRegionTags = new Set(inScopeSlugs.flatMap((s) => REGION_CLUSTER[s] as string[]));

// ------------------------------------------------------------- types ----
type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  severity: Severity;
  code: string;
  poi_key: string;
  region: string | null;
  detail: string;
  /** Counts toward a --strict non-zero exit. */
  strict: boolean;
}

interface PoiRow {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  region: string | null;
  category: string | null;
  default_image_url: string | null;
  default_stay_minutes: number | null;
  lat: number | null;
  lng: number | null;
  stop_role: string | null;
  is_attraction: boolean | null;
  is_operational: boolean | null;
  description: string | null;
  highlights: unknown;
  images: unknown;
  why_on_route: string | null;
  visit_basics: unknown;
  convenience: unknown;
  smart_notes: unknown;
  kb_version: string | null;
  builder_profile_source: string | null;
}

// ----------------------------------------------------------- helpers ----
const hasText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const hasItems = (v: unknown): boolean =>
  Array.isArray(v) && v.some((x) => (typeof x === "string" ? x.trim().length > 0 : x != null));
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** Master-plan "Empty Object Rule": meaningful = object with ≥1 key. */
const meaningfulObject = (v: unknown): boolean => isPlainObject(v) && Object.keys(v).length > 0;
const isEmptyObjectLiteral = (v: unknown): boolean => isPlainObject(v) && Object.keys(v).length === 0;
const isValidImageUrl = (url: unknown): url is string =>
  typeof url === "string" && url.trim().length > 0;

/**
 * Signal-A folder-token heuristic — identical to the seed/enrich scripts so the
 * audit and the pipeline agree on what "wrong-POI image" means. Only judges the
 * shared `/images/tours/<folder>/` convention; returns false for anything else
 * (e.g. /images/itinerary/ assets are never flagged).
 */
function isProbablyWrongPoiImage(poiKey: string, name: string | null, url: unknown): boolean {
  if (!isValidImageUrl(url)) return false;
  const m = url.match(/^\/images\/tours\/([^/]+)\//);
  if (!m) return false;
  const folderTokens = m[1].toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (folderTokens.length === 0) return false;
  const poiTokens = `${poiKey} ${name || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  return !folderTokens.some((ft) => poiTokens.some((pt) => pt === ft || pt.includes(ft) || ft.includes(pt)));
}

/** Signal B — AI/unverified image markers. chatgpt-image-* is the repo convention. */
function isAiUnverifiedImage(url: unknown): boolean {
  if (!isValidImageUrl(url)) return false;
  return /chatgpt-image-/i.test(url) || /dall-?e/i.test(url) || /midjourney/i.test(url);
}

function isRealPoi(meta: unknown): meta is { poi_key: string } {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  if (typeof m.poi_key !== "string") return false;
  if (m.match === "transit_only") return false;
  if (m.poi_key.startsWith("OPS_")) return false;
  if (m.poi_key.startsWith("route_variant_")) return false;
  return true;
}

// ------------------------------------------------- source collection ----
interface TourSources {
  /** Every image path any tour stop references for a poi_key (raw, incl. wrong). */
  imageRefsByKey: Map<string, Set<string>>;
  /** Tour-stop image refs that are folder-token-mismatched for their poi_key. */
  wrongImagesByKey: Map<string, Set<string>>;
  /** poi_keys that appear as a real stop in any tour JSON. */
  keys: Set<string>;
  nameByKey: Map<string, string>;
}

function collectTourSources(): TourSources {
  const imageRefsByKey = new Map<string, Set<string>>();
  const wrongImagesByKey = new Map<string, Set<string>>();
  const keys = new Set<string>();
  const nameByKey = new Map<string, string>();

  const dirs = readdirSync(TOURS_DIR).filter((e) => {
    try {
      return statSync(join(TOURS_DIR, e)).isDirectory();
    } catch {
      return false;
    }
  });
  // Images are locale-invariant — en is authoritative (matches enrich script).
  for (const slug of dirs) {
    const file = join(TOURS_DIR, slug, `${slug}.en.json`);
    if (!existsSync(file)) continue;
    let json: { itineraryStops?: unknown[] };
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const stops = Array.isArray(json.itineraryStops) ? json.itineraryStops : [];
    for (const raw of stops) {
      const stop = raw as Record<string, any>;
      if (!isRealPoi(stop._poi_meta)) continue;
      const key = stop._poi_meta.poi_key as string;
      keys.add(key);
      if (hasText(stop.name) && !nameByKey.has(key)) nameByKey.set(key, stop.name.trim());

      const refs = imageRefsByKey.get(key) ?? new Set<string>();
      const candidates: unknown[] = [];
      if (Array.isArray(stop.images)) candidates.push(...stop.images);
      if (stop.image) candidates.push(stop.image);
      if (Array.isArray(stop.galleryItems)) {
        for (const g of stop.galleryItems) if (g && (g as any).src) candidates.push((g as any).src);
      }
      for (const c of candidates) {
        if (!isValidImageUrl(c)) continue;
        refs.add(c);
        if (isProbablyWrongPoiImage(key, nameByKey.get(key) ?? null, c)) {
          const w = wrongImagesByKey.get(key) ?? new Set<string>();
          w.add(c);
          wrongImagesByKey.set(key, w);
        }
      }
      imageRefsByKey.set(key, refs);
    }
  }
  return { imageRefsByKey, wrongImagesByKey, keys, nameByKey };
}

function loadKbKeys(): Set<string> {
  const keys = new Set<string>();
  try {
    const kb = JSON.parse(readFileSync(KB_PATH, "utf8")) as Record<string, unknown>;
    for (const k of Object.keys(kb)) if (!k.startsWith("_")) keys.add(k);
  } catch {
    // KB is an optional input; absence just means no KB cross-check.
  }
  return keys;
}

async function fetchMatchPois(): Promise<PoiRow[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local."
    );
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const cols =
    "poi_key, name_en, name_ko, region, category, default_image_url, default_stay_minutes, lat, lng, stop_role, is_attraction, is_operational, description, highlights, images, why_on_route, visit_basics, convenience, smart_notes, kb_version, builder_profile_source";
  const { data, error } = await sb.from("match_pois").select(cols);
  if (error) throw new Error(`match_pois fetch failed: ${error.message}`);
  return (data ?? []) as PoiRow[];
}

/** EXACT page.tsx:66-80 predicate. */
function isVisible(p: PoiRow): boolean {
  if (!p.region || !inScopeRegionTags.has(p.region)) return false;
  if (!hasText(p.name_en)) return false;
  if (p.lat == null) return false; // page filters lat only (lng checked separately)
  return p.is_attraction === true || (p.is_attraction == null && isBuilderAttraction(p.poi_key));
}

function isBuilderAttractionRow(p: PoiRow): boolean {
  return p.is_attraction === true || (p.is_attraction == null && isBuilderAttraction(p.poi_key));
}

// -------------------------------------------------------------- audit ----
function audit(rows: PoiRow[], sources: TourSources, kbKeys: Set<string>) {
  const issues: Issue[] = [];
  const dbKeys = new Set(rows.map((r) => r.poi_key));
  const visible = rows.filter(isVisible);

  const add = (
    severity: Severity,
    code: string,
    p: { poi_key: string; region: string | null },
    detail: string,
    strict = false
  ) => issues.push({ severity, code, poi_key: p.poi_key, region: p.region, detail, strict });

  for (const p of visible) {
    const override = BUILDER_POI_IMAGE_OVERRIDES[p.poi_key as keyof typeof BUILDER_POI_IMAGE_OVERRIDES];
    const img = p.default_image_url;

    // name_en / lat are guaranteed by the visible filter; lng is not page-filtered.
    if (p.lng == null) add("critical", "missing_lng", p, "lng is null", true);

    // ---- representative image ----
    if (!isValidImageUrl(img)) {
      if (override?.defaultImageUrl) {
        add("medium", "image_pending_backfill", p,
          `DB default_image_url null but override available (${override.defaultImageUrl}) — re-run seed/backfill`);
      } else {
        add("high", "missing_image", p, "no default_image_url and no override (needs a Track B photo)", true);
      }
    } else {
      const referencedBySource = sources.imageRefsByKey.get(p.poi_key)?.has(img) ?? false; // KB has no image refs
      if (isProbablyWrongPoiImage(p.poi_key, p.name_en, img) && !referencedBySource) {
        add("critical", "signal_a_orphan_wrong_image", p,
          `${img} — folder token does not match POI and no tour/KB source references it (orphan)`, true);
      }
      if (isAiUnverifiedImage(img)) {
        add("medium", "signal_b_ai_image", p, `${img} — AI/unverified marker (photo-quality backlog, not a strict fail)`);
      }
      if (!hasItems(p.images)) add("medium", "missing_gallery", p, "has default_image_url but no images[] gallery");
    }

    // ---- known-wrong image in the SOURCE tour JSON (independent of DB) ----
    const wrong = sources.wrongImagesByKey.get(p.poi_key);
    if (wrong && wrong.size) {
      add("high", "source_json_image_wrong", p,
        `tour JSON stop references ${[...wrong].join(", ")} for this POI (folder mismatch; seed Signal-A rejects it)`);
    }

    // ---- text fields ----
    if (!hasText(p.description)) add("high", "missing_description", p, "description missing", true);
    if (!hasItems(p.highlights)) add("high", "missing_highlights", p, "highlights missing/empty", true);
    if (!hasText(p.why_on_route)) add("medium", "missing_why_on_route", p, "why_on_route missing");

    // ---- structured objects ({} / [] / "" / null all count as missing) ----
    for (const [field, val] of [
      ["visit_basics", p.visit_basics],
      ["convenience", p.convenience],
      ["smart_notes", p.smart_notes],
    ] as const) {
      if (!meaningfulObject(val)) {
        const shape = isEmptyObjectLiteral(val) ? "{} (empty object)" : val == null ? "null/absent" : "non-object";
        add("high", `empty_${field}`, p, `${field} ${shape}`, true);
      }
    }

    // ---- metadata (medium) ----
    if (!hasText(p.category)) add("medium", "missing_category", p, "category missing");
    if (p.default_stay_minutes == null) add("medium", "missing_stay_minutes", p, "default_stay_minutes missing");
  }

  // ---- catalog-wide key presence (informational, never strict) ----
  for (const k of new Set([...sources.keys, ...kbKeys])) {
    if (!dbKeys.has(k)) {
      add("medium", "source_key_not_in_db", { poi_key: k, region: null },
        `present in ${sources.keys.has(k) ? "tour JSON" : ""}${sources.keys.has(k) && kbKeys.has(k) ? "+" : ""}${kbKeys.has(k) ? "KB" : ""} but not in match_pois`);
    }
  }
  for (const p of rows) {
    if (!isBuilderAttractionRow(p)) continue;
    if (!sources.keys.has(p.poi_key) && !kbKeys.has(p.poi_key)) {
      add("low", "db_key_no_source", p, "DB attraction key has no tour-JSON or KB source (orphan key)");
    }
  }

  return { issues, visible };
}

// ------------------------------------------------------------- report ----
async function main(): Promise<number> {
  const sources = collectTourSources();
  const kbKeys = loadKbKeys();
  const rows = await fetchMatchPois();
  {
      const { issues, visible } = audit(rows, sources, kbKeys);

      const inScope = rows.filter((r) => r.region && inScopeRegionTags.has(r.region));
      const count = (code: string) => issues.filter((i) => i.code === code).length;
      const visibleIssue = (code: string) =>
        issues.filter((i) => i.code === code && visible.some((v) => v.poi_key === i.poi_key)).length;

      const strictFails = issues.filter((i) => i.strict);
      const summary = {
        scope: inScopeSlugs.join("+"),
        match_pois_total: rows.length,
        in_scope_rows: inScope.length,
        visible_builder_pois: visible.length,
        missing_image: visibleIssue("missing_image"),
        image_pending_backfill: visibleIssue("image_pending_backfill"),
        signal_a_orphan_wrong_image: visibleIssue("signal_a_orphan_wrong_image"),
        signal_b_ai_image: visibleIssue("signal_b_ai_image"),
        source_json_image_wrong: visibleIssue("source_json_image_wrong"),
        missing_description: visibleIssue("missing_description"),
        missing_highlights: visibleIssue("missing_highlights"),
        missing_why_on_route: visibleIssue("missing_why_on_route"),
        empty_visit_basics: visibleIssue("empty_visit_basics"),
        empty_convenience: visibleIssue("empty_convenience"),
        empty_smart_notes: visibleIssue("empty_smart_notes"),
        missing_gallery: visibleIssue("missing_gallery"),
        source_key_not_in_db: count("source_key_not_in_db"),
        db_key_no_source: count("db_key_no_source"),
        by_severity: {
          critical: issues.filter((i) => i.severity === "critical").length,
          high: issues.filter((i) => i.severity === "high").length,
          medium: issues.filter((i) => i.severity === "medium").length,
          low: issues.filter((i) => i.severity === "low").length,
        },
        strict_fail_count: strictFails.length,
        strict_pass: strictFails.length === 0,
      };

      if (AS_JSON) {
        console.log(JSON.stringify({ summary, issues }, null, 2));
      } else {
        const order: Severity[] = ["critical", "high", "medium", "low"];
        console.log(`\n=== Itinerary Builder POI Data Quality audit — scope: ${summary.scope} ===`);
        console.log(`match_pois total ........... ${summary.match_pois_total}`);
        console.log(`in-scope rows .............. ${summary.in_scope_rows}`);
        console.log(`visible builder POIs ....... ${summary.visible_builder_pois}`);
        console.log(`\n-- visible POI defect surface --`);
        console.log(`missing image (Track B) .... ${summary.missing_image}`);
        console.log(`image pending backfill ..... ${summary.image_pending_backfill}`);
        console.log(`Signal A orphan wrong img .. ${summary.signal_a_orphan_wrong_image}  ${summary.signal_a_orphan_wrong_image ? "⚠ STRICT" : "✓"}`);
        console.log(`Signal B AI/unverified img . ${summary.signal_b_ai_image}  (warning)`);
        console.log(`source-JSON image wrong .... ${summary.source_json_image_wrong}  (warning)`);
        console.log(`missing description ........ ${summary.missing_description}`);
        console.log(`missing highlights ......... ${summary.missing_highlights}`);
        console.log(`missing why_on_route ....... ${summary.missing_why_on_route}  (warning)`);
        console.log(`empty visit_basics ......... ${summary.empty_visit_basics}`);
        console.log(`empty convenience .......... ${summary.empty_convenience}`);
        console.log(`empty smart_notes .......... ${summary.empty_smart_notes}`);
        console.log(`missing gallery images ..... ${summary.missing_gallery}  (warning)`);
        console.log(`\n-- catalog key presence --`);
        console.log(`source key not in DB ....... ${summary.source_key_not_in_db}`);
        console.log(`DB key with no source ...... ${summary.db_key_no_source}`);
        console.log(`\n-- by severity --  critical ${summary.by_severity.critical} · high ${summary.by_severity.high} · medium ${summary.by_severity.medium} · low ${summary.by_severity.low}`);

        for (const sev of order) {
          const bucket = issues.filter((i) => i.severity === sev);
          if (!bucket.length) continue;
          console.log(`\n[${sev.toUpperCase()}] ${bucket.length}`);
          for (const i of bucket) {
            console.log(`  ${i.strict ? "✗" : "·"} ${i.poi_key.padEnd(36)} ${i.code.padEnd(28)} ${i.detail}`);
          }
        }

        console.log(`\n=== strict-blocking issues: ${summary.strict_fail_count} (${summary.strict_pass ? "PASS" : "FAIL"}) ===`);
        if (!summary.strict_pass) {
          const byCode = strictFails.reduce<Record<string, number>>((acc, i) => {
            acc[i.code] = (acc[i.code] || 0) + 1;
            return acc;
          }, {});
          console.log("  " + Object.entries(byCode).map(([c, n]) => `${c}=${n}`).join(", "));
          console.log("  (--strict cannot go green until Track B photos land + content gaps close — expected for now)");
        }
      }

      return STRICT && strictFails.length > 0 ? 1 : 0;
  }
}

/**
 * Set process.exitCode (never call process.exit()) and proactively close the
 * fetch keep-alive sockets so the process drains and exits promptly with a
 * DETERMINISTIC code. process.exit() races with libuv socket teardown on
 * Windows ("UV_HANDLE_CLOSING" assertion → spurious 127), which would make
 * --strict useless as a CI gate.
 */
async function closeNetwork(): Promise<void> {
  try {
    const undici = (await import("undici")) as {
      getGlobalDispatcher?: () => { close?: () => Promise<void> };
    };
    await undici.getGlobalDispatcher?.().close?.();
  } catch {
    // undici not resolvable — rely on the natural event-loop drain.
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeNetwork);
