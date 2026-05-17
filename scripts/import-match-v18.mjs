#!/usr/bin/env node
/**
 * Import 30 v17 .en.json tours + KB v1.29/1.30 POIs into match_* tables.
 *
 * Mirrors `match_sim/scripts/upsert_catalog.py` derivation logic 1:1:
 *   - infer_destination_region / infer_pickup_region
 *   - derive_available_months (6-step fallback chain w/ SEASON_MONTH_HARDCODE)
 *   - detect_cruise_excursion / detect_charter_route_options
 *   - detect_a_grade (pv=6 substantive-stop check)
 *
 * Idempotent: ON CONFLICT (slug | poi_key | (tour_slug, stop_index)) DO UPDATE.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/import-match-v18.mjs [--dry-run] [--single <slug>]
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const KB_PATH = join(ROOT, "data/poi_kb/poi_knowledge_base_v1.29.json");

// =============================================================================
// SEASON MONTH HARDCODE (Python upsert_catalog.SEASON_MONTH_HARDCODE 1:1)
// =============================================================================

const SEASON_MONTH_HARDCODE = {
  cherry_blossom: [3, 4],
  wangbeotnamu: [3, 4],
  king_cherry: [3, 4],
  yoshino_cherry: [3, 4],
  spring_cherry: [3, 4],
  jeju_cherry: [3, 4],
  canola_flower: [3, 4],
  canola_bloom: [3, 4],
  plum_blossom: [2, 3],
  plum_cherry: [2, 3, 4],
  hydrangea: [5, 6, 7],
  hydrangea_festival: [5, 6, 7],
  summer_flowers: [5, 6, 7],
  tangerine_picking: [11, 12, 1, 2],
  winter_tangerine: [11, 12, 1, 2],
  hallabong: [11, 12, 1, 2],
  snow_camellia: [12, 1, 2],
  winter_camellia: [12, 1, 2],
  winter_snow: [12, 1, 2],
  winter_only: [12, 1, 2],
  autumn_foliage: [10, 11],
  fall_foliage: [10, 11],
};

const SEASON_MONTH_BY_SLUG_PATTERN = [
  [["cherry", "plum"], [2, 3, 4]],
  [["plum", "cherry"], [2, 3, 4]],
  [["winter", "tangerine"], [11, 12, 1, 2]],
  [["winter", "camellia"], [12, 1, 2]],
  [["winter", "snow"], [12, 1, 2]],
  [["hydrangea"], [5, 6, 7]],
  [["cherry-blossom"], [3, 4]],
  [["plum"], [2, 3]],
  [["autumn", "foliage"], [10, 11]],
  [["spring"], [3, 4, 5]],
  [["summer"], [6, 7, 8]],
  [["autumn"], [9, 10, 11]],
  [["winter"], [12, 1, 2]],
];

const MONTH_NAME_TO_INT = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, nov: 11, dec: 12,
};

const OPERATIONAL_FRAGMENTS = ["_port", "cruise_port", "_pickup", "_dropoff", "_lunch", "_dinner"];

// =============================================================================
// Derivation
// =============================================================================

function inferDestinationRegion(slug, mp) {
  const s = (slug || "").toLowerCase();
  if (s.startsWith("jeju-") || s.includes("jeju")) return "jeju";
  if (s.startsWith("busan-") || s.startsWith("from-busan-")) {
    if (mp?.region_type === "busan_city") return "busan_city";
    if (s.includes("gyeongju") || s.includes("yangsan") || s.includes("tongdosa")) return "busan_gyeongju";
    return "busan_city";
  }
  if (s.startsWith("from-incheon-") || s.includes("incheon")) return "incheon_seoul";
  if (s.startsWith("seoul-") || s.includes("seoul")) {
    if (s.includes("suwon")) return "suwon";
    if (s.includes("seoraksan") || s.includes("sokcho") || s.includes("naksansa")) return "seoul_gangwon";
    return "seoul";
  }
  if (s.includes("pocheon")) return "pocheon";
  if (s.startsWith("east-jeju")) return "jeju";
  return mp?.destination_region ?? null;
}

function inferPickupRegion(mp) {
  if (!mp) return null;
  for (const k of [
    "seoul_central_hotel_pickup_fit",
    "central_jeju_pickup_fit",
    "busan_central_pickup_fit",
    "incheon_port_pickup_fit",
  ]) {
    const v = mp[k];
    if (v === 1.0 || v === true) {
      return k.replace("_pickup_fit", "").replace("_fit", "");
    }
  }
  return null;
}

function isStrictSeasonLocked(slug, mp, mm) {
  const lockDims = [
    "spring_only_seasonality_fit", "summer_only_seasonality_fit",
    "autumn_only_seasonality_fit", "winter_only_seasonality_fit",
    "spring_only_seasonal_lock_fit", "summer_only_seasonal_lock_fit",
    "autumn_only_seasonal_lock_fit", "winter_only_seasonal_lock_fit",
    "season_locked_unique_in_catalog",
    "only_winter_only_seasonality_tour_in_catalog",
  ];
  for (const d of lockDims) {
    const v = mp?.[d];
    if (v === true || (typeof v === "number" && v >= 1.0)) return true;
  }
  const primary = (mm?.primary_themes ?? []).map((t) => String(t).toLowerCase());
  const lockThemes = new Set([
    "spring_seasonal", "summer_seasonal", "autumn_seasonal", "winter_seasonal",
    "winter", "spring_festival", "summer_festival",
    "cherry_blossom", "plum_blossom", "hydrangea_festival",
    "tangerine", "winter_camellia", "snow_camellia", "winter_only", "season_locked",
  ]);
  if (primary.some((t) => lockThemes.has(t))) return true;
  const s = (slug || "").toLowerCase();
  const seasonSlugKws = [
    "cherry-blossom", "cherry_blossom", "plum-cherry", "hydrangea",
    "winter-southwest", "tangerine-snow", "snow-camellia",
    "spring-cherry", "spring-festival",
  ];
  if (seasonSlugKws.some((kw) => s.includes(kw))) return true;
  return false;
}

function parseSeasonalWindowToMonths(seasonalWindow) {
  if (!seasonalWindow) return [];
  const months = new Set();
  for (const field of ["best_months", "good_months"]) {
    for (const entry of seasonalWindow[field] ?? []) {
      if (typeof entry !== "string") continue;
      const lower = entry.toLowerCase();
      for (const [name, num] of Object.entries(MONTH_NAME_TO_INT)) {
        if (lower.includes(name)) {
          months.add(num);
          break;
        }
      }
    }
  }
  return [...months].sort((a, b) => a - b);
}

function deriveAvailableMonths(slug, mp, mm) {
  // 1. canonical
  const sig = mp?.available_months_signature;
  if (Array.isArray(sig) && sig.length && sig.every((m) => Number.isInteger(m))) {
    return [...new Set(sig.filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  }
  // 2. legacy
  const legacy = mp?.available_months;
  if (Array.isArray(legacy) && legacy.length && legacy.every((m) => Number.isInteger(m))) {
    return [...new Set(legacy.filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  }
  const strict = isStrictSeasonLocked(slug, mp, mm);
  // 3. primary_themes ∩ SEASON_MONTH_HARDCODE
  if (strict) {
    const primary = mm?.primary_themes ?? [];
    const derived = new Set();
    for (const theme of primary) {
      const tl = (theme ?? "").toLowerCase();
      for (const [key, months] of Object.entries(SEASON_MONTH_HARDCODE)) {
        if (tl.includes(key)) {
          months.forEach((m) => derived.add(m));
          break;
        }
      }
    }
    if (derived.size) return [...derived].sort((a, b) => a - b);
  }
  // 4. seasonal_window
  if (strict) {
    const sw = parseSeasonalWindowToMonths(mm?.seasonal_window ?? {});
    if (sw.length) return sw;
  }
  // 5. slug pattern
  const sl = (slug || "").toLowerCase();
  if (strict) {
    for (const [patterns, months] of SEASON_MONTH_BY_SLUG_PATTERN) {
      if (patterns.every((p) => sl.includes(p))) return [...months];
    }
  }
  // 6. default
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function isOperationalStop(poiKey) {
  if (!poiKey) return true;
  if (poiKey.startsWith("OPS_")) return true;
  return OPERATIONAL_FRAGMENTS.some((f) => poiKey.includes(f));
}

function detectCruiseExcursion(slug, mp, mm) {
  const s = (slug || "").toLowerCase();
  if (s.includes("cruise") || s.includes("shore-excursion") || s.includes("shore_excursion")) return true;
  const cmsf = mp?.cruise_market_segment_fit;
  if (typeof cmsf === "number" && cmsf >= 1.0) return true;
  const crsbf = mp?.cruise_reboarding_safety_buffer_fit;
  if (typeof crsbf === "number" && crsbf >= 1.0) return true;
  const primary = mm?.primary_themes ?? [];
  if (primary.includes("cruise_shore_excursion")) return true;
  return false;
}

function detectCharterRouteOptions(slug, mp, _mm, tourFull) {
  const s = (slug || "").toLowerCase();
  const stops = tourFull?.itineraryStops ?? [];
  const allRouteVariants =
    stops.length > 0 &&
    stops.every((st) => {
      const k = st?._poi_meta?.poi_key ?? "";
      return typeof k === "string" && k.startsWith("route_variant_");
    });
  if (s.includes("private-chartered") || s.includes("private-car-charter")) {
    if (allRouteVariants) return true;
  }
  if (mp?.customizable_route_fit === 1.0 && mp?.vehicle_type === "private_vehicle") {
    if (allRouteVariants) return true;
  }
  return false;
}

function detectAGrade(tourFull) {
  const stops = tourFull?.itineraryStops ?? [];
  const substantive = stops.filter((s) => !isOperationalStop(s?._poi_meta?.poi_key ?? ""));
  if (!substantive.length) return false;
  for (const s of substantive) {
    const desc = (s.description ?? "").length;
    const hl = (s.highlights ?? []).length;
    const tu = (s.timeUsed ?? []).length;
    const wor = (s.whyOnRoute ?? "").length;
    const src = (s._poi_meta?.sources ?? []).length;
    if (!(desc >= 1500 && hl >= 9 && tu >= 5 && wor >= 500 && src >= 5)) return false;
  }
  return true;
}

function arr(x) {
  return Array.isArray(x) ? x : [];
}

// =============================================================================
// Build rows
// =============================================================================

function buildTourRow(slug, doc) {
  const mp = doc.matching_profile ?? {};
  const mm = doc.matching_metadata ?? {};
  const cc = doc.catalog_card ?? {};

  const destination_region = inferDestinationRegion(slug, mp);
  const pickup_region = inferPickupRegion(mp);
  const available_months = deriveAvailableMonths(slug, mp, mm);
  const a_grade = detectAGrade(doc);
  const is_cruise_excursion = detectCruiseExcursion(slug, mp, mm);
  const is_charter_route_options = detectCharterRouteOptions(slug, mp, mm, doc);

  const primary_themes = arr(mm.primary_themes).map(String);
  const secondary_themes = arr(mm.secondary_themes).map(String);
  const best_for = arr(mm.best_for).map(String);
  const not_recommended_for = arr(mm.not_recommended_for).map(String);
  const competing_products = arr(mm.competing_products).map(String);
  // Anchor poi keys: collect from itineraryStops _poi_meta.poi_key (substantive only)
  const stops = arr(doc.itineraryStops);
  const anchor_poi_keys = [...new Set(
    stops
      .map((s) => s?._poi_meta?.poi_key)
      .filter((k) => typeof k === "string" && !isOperationalStop(k))
  )];

  // Duration parsing from cc.duration "9–9.5 hours" etc → 9.5
  let duration_hours = null;
  const dur = cc.duration;
  if (typeof dur === "string") {
    const m = dur.replace(/–/g, "-").match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length) duration_hours = Math.max(...m.map(Number));
  }

  return {
    slug,
    product_id: doc.product_id ?? slug,
    locale: doc.locale ?? "en",
    schema_version: doc.schema_version ?? 7,
    full_document: doc,
    matching_profile: mp,
    matching_metadata: mm,
    available_months,
    primary_themes,
    secondary_themes,
    best_for,
    not_recommended_for,
    anchor_poi_keys,
    competing_products,
    destination_region,
    pickup_region,
    duration_hours,
    vehicle_type: mp.vehicle_type ?? null,
    headline_line1: doc.headlineLine1 ?? null,
    headline_line2: doc.headlineLine2 ?? null,
    seo_title: doc.seo?.pageTitle ?? null,
    enrichment_batch: doc._publication?.batch ?? mm.enrichment_batch ?? null,
    kb_version: stops[0]?._poi_meta?.kb_version ?? null,
    profile_version: mm.profile_version ?? mp.profile_version ?? 6,
    a_grade,
    is_cruise_excursion,
    is_charter_route_options,
  };
}

function buildPoiRow(poiKey, kbEntry) {
  const meta = kbEntry?.poi_meta ?? kbEntry ?? {};
  return {
    poi_key: poiKey,
    name_en: meta.name_en ?? kbEntry?.name_en ?? null,
    name_ko: meta.name_ko ?? kbEntry?.name_ko ?? null,
    poi_meta: meta,
    visit_basics: kbEntry?.visit_basics ?? null,
    convenience: kbEntry?.convenience ?? null,
    smart_notes: kbEntry?.smart_notes ?? null,
    default_image_url: kbEntry?.default_image_url ?? null,
    stop_role: kbEntry?.stop_role ?? null,
    is_attraction: !poiKey.startsWith("OPS_") && !poiKey.startsWith("route_variant_"),
    region: meta.region ?? null,
    kb_version: kbEntry?.kb_version ?? meta?.kb_version ?? null,
  };
}

function buildStopRows(slug, doc) {
  const stops = arr(doc.itineraryStops);
  return stops.map((st, idx) => ({
    tour_slug: slug,
    stop_index: typeof st.number === "number" ? st.number : idx + 1,
    poi_key: st?._poi_meta?.poi_key ?? null,
    title: st?.name ?? null,
    description_length: (st?.description ?? "").length,
    highlights_count: arr(st?.highlights).length,
    why_on_route_length: (st?.whyOnRoute ?? "").length,
    time_used_count: Array.isArray(st?.timeUsed) ? st.timeUsed.length : (typeof st?.timeUsed === "string" ? 1 : 0),
    sources_count: arr(st?._poi_meta?.sources).length,
  }));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const singleIdx = args.indexOf("--single");
  const singleSlug = singleIdx >= 0 ? args[singleIdx + 1] : null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Discover slugs
  let slugs = readdirSync(TOURS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog" && d.name !== "route-variants")
    .map((d) => d.name)
    .sort();
  if (singleSlug) slugs = slugs.filter((s) => s === singleSlug);

  console.log(`[import-match-v18] Importing ${slugs.length} tours${dryRun ? " (DRY RUN)" : ""}`);

  // Build tour rows
  const tourRows = [];
  const stopRows = [];
  for (const slug of slugs) {
    const path = join(TOURS_DIR, slug, `${slug}.en.json`);
    if (!existsSync(path)) {
      console.error(`  MISSING: ${path}`);
      continue;
    }
    const doc = JSON.parse(readFileSync(path, "utf8"));
    const row = buildTourRow(slug, doc);
    tourRows.push(row);
    stopRows.push(...buildStopRows(slug, doc));
    console.log(
      `  ${slug}: region=${row.destination_region} months=${row.available_months.length}` +
      ` mp_keys=${Object.keys(row.matching_profile).length} a_grade=${row.a_grade}` +
      ` cruise=${row.is_cruise_excursion} charter=${row.is_charter_route_options}`
    );
  }

  // Build POI rows
  const kb = JSON.parse(readFileSync(KB_PATH, "utf8"));
  const poiEntries = Array.isArray(kb)
    ? kb
    : kb.pois
      ? kb.pois
      : Object.entries(kb).map(([k, v]) => (typeof v === "object" && v !== null ? { ...v, poi_key: v.poi_key ?? k } : v));
  const poiRows = poiEntries
    .map((e) => {
      const k = typeof e === "object" ? (e.poi_key ?? null) : null;
      return k ? buildPoiRow(k, e) : null;
    })
    .filter(Boolean);

  console.log(`\n[import-match-v18] Built ${tourRows.length} tours, ${stopRows.length} stops, ${poiRows.length} POIs`);

  if (dryRun) {
    console.log("[import-match-v18] DRY RUN — no DB writes");
    return;
  }

  // Upsert in batches
  const upsert = async (table, rows, conflict) => {
    if (!rows.length) return;
    const { error, data } = await sb.from(table).upsert(rows, { onConflict: conflict, ignoreDuplicates: false });
    if (error) {
      console.error(`[${table}] error:`, error);
      throw error;
    }
    console.log(`[${table}] upserted ${rows.length} rows`);
  };

  await upsert("match_pois", poiRows, "poi_key");
  await upsert("match_tours", tourRows, "slug");
  // For stops: delete-then-insert by tour_slug to keep idempotent without per-row composite unique tracking
  for (const slug of slugs) {
    const slugStops = stopRows.filter((s) => s.tour_slug === slug);
    if (!slugStops.length) continue;
    const { error: delErr } = await sb.from("match_itinerary_stops").delete().eq("tour_slug", slug);
    if (delErr) {
      console.error(`[match_itinerary_stops delete] ${slug}:`, delErr);
      throw delErr;
    }
    const { error: insErr } = await sb.from("match_itinerary_stops").insert(slugStops);
    if (insErr) {
      console.error(`[match_itinerary_stops insert] ${slug}:`, insErr);
      throw insErr;
    }
  }
  console.log(`[match_itinerary_stops] refreshed ${stopRows.length} rows across ${slugs.length} tours`);

  console.log("\n[import-match-v18] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
