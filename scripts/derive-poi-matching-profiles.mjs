#!/usr/bin/env node
/**
 * Itinerary Builder Phase 6 — derive `match_pois.matching_profile` from
 * parent tours.
 *
 * Strategy (per docs/itinerary-builder-plan.md §F Phase 6):
 *   1. For each POI, find all `match_tours` rows that include it in
 *      `anchor_poi_keys` OR in `match_itinerary_stops` (excluding
 *      operational stops).
 *   2. Pull the parent tours' matching_profile jsonb.
 *   3. Weighted-average numeric dimensions, weight = 1/N where N is the
 *      tour's total non-operational stop count (so a POI that's an
 *      anchor of a 3-stop tour contributes more than the same POI
 *      buried in a 7-stop tour).
 *   4. Drop tour-level dimensions (vehicle/private/cruise/pickup/etc.).
 *   5. Write back to `match_pois.matching_profile`.
 *   6. CSV audit: scripts/poi-matching-profile-audit.csv
 *
 * Usage:
 *   node --env-file=.env.local scripts/derive-poi-matching-profiles.mjs [--dry-run]
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIT_CSV = join(ROOT, "scripts/poi-matching-profile-audit.csv");

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Tour-level dimensions to DROP from the POI profile. Anything not in this
 * blacklist + numeric in [0,1] (or small int) gets averaged across parent
 * tours and persisted on the POI.
 */
const DROP_KEYS = new Set([
  // Format / packaging
  "private_fit",
  "private_tour_fit",
  "small_group_fit",
  "bus_fit",
  "minicoach_fit",
  "small_group_van_fit",
  "vehicle_type",
  "vehicle_type_legacy",
  "duration_band",
  "duration_hours",
  "half_day_fit",
  "full_day_fit",
  "one_day_fit",
  "return_time_band",
  "early_start_fit",
  "late_finish_fit",
  "same_day_flight_fit",
  "flexibility_fit",
  "customizable_route_fit",
  "fixed_itinerary_fit",
  // Pickup / logistics
  "pickup_base",
  "pickup_base_normalized",
  "jeju_city_pickup_fit",
  "seogwipo_pickup_fit",
  // Group / pax constraints
  "group_size_min",
  "group_size_max",
  "max_pax_per_vehicle",
  "min_recommended_age",
  // Pricing / market
  "price_band",
  "premium_fit",
  "budget_fit",
  "budget_traveler_fit",
  "value_for_money_fit",
  "value_priced_fit",
  // Tour metadata
  "product_type",
  "product_id",
  "route_type",
  "profile_format",
  "profile_version",
  "is_active",
  "catalog_position",
  "competing_tours_count",
  "total_admission_krw_per_adult",
  // Cruise wrapper
  "cruise_passenger_fit",
  "cruise_shore_excursion_fit",
  // Tour-level audience
  "first_time_fit",
  "first_time_korea_fit",
  "first_time_jeju_fit",
  "first_time_friendly_fit",
  "tourist_circuit_fit",
  "checkbox_sightseeing_fit",
  // Tour-level anchor / counts
  "is_anchor_for_east_jeju_signature",
  "east_signature_fit",
  "east_nature_core_fit",
  "anchor_poi_keys",
  // Language (guide language is tour-level)
  "english_guide_fit",
  "language_english_fit",
  "language_chinese_fit",
  "language_japanese_fit",
  // Hard constraints are tour-specific avoidance lists
  "hard_constraints",
  // Region / market segmentation (tour-level marketing)
  "destination_region",
  "region_type",
]);

const DROP_PREFIXES = ["walking_notes"];
const DROP_SUFFIXES = ["_market_fit", "_anchor_count"];

function shouldDropKey(key) {
  if (DROP_KEYS.has(key)) return true;
  for (const p of DROP_PREFIXES) if (key.startsWith(p)) return true;
  for (const s of DROP_SUFFIXES) if (key.endsWith(s)) return true;
  return false;
}

function isNumericKeepable(value) {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "boolean") return true;
  return false;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  const e = s.replace(/"/g, '""');
  return /[",\n]/.test(e) ? `"${e}"` : e;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Load tour profiles
  console.log("Loading match_tours...");
  const { data: tours, error: tourErr } = await sb
    .from("match_tours")
    .select("slug, matching_profile")
    .eq("locale", "en")
    .not("matching_profile", "is", null);
  if (tourErr) throw tourErr;
  const tourBySlug = new Map(tours.map((t) => [t.slug, t.matching_profile]));
  console.log(`  ${tours.length} tour profiles`);

  // Load stops to count non-operational stops per tour AND build tour→pois map
  console.log("Loading match_itinerary_stops...");
  const { data: stops, error: stopsErr } = await sb
    .from("match_itinerary_stops")
    .select("tour_slug, poi_key, is_operational")
    .eq("is_operational", false);
  if (stopsErr) throw stopsErr;
  const tourStopCount = new Map();
  const poiToTours = new Map();
  for (const s of stops) {
    if (!s.poi_key) continue;
    if (s.poi_key.startsWith("OPS_") || s.poi_key.startsWith("route_variant_")) continue;
    tourStopCount.set(s.tour_slug, (tourStopCount.get(s.tour_slug) ?? 0) + 1);
    if (!poiToTours.has(s.poi_key)) poiToTours.set(s.poi_key, new Set());
    poiToTours.get(s.poi_key).add(s.tour_slug);
  }
  console.log(`  ${stops.length} non-operational stops · ${poiToTours.size} unique POIs covered`);

  // Also map anchor_poi_keys (extra weight to anchor relationship)
  for (const t of tours) {
    const anchors = Array.isArray(t.matching_profile?.anchor_poi_keys)
      ? t.matching_profile.anchor_poi_keys
      : [];
    for (const k of anchors) {
      if (!k || k.startsWith("OPS_") || k.startsWith("route_variant_")) continue;
      if (!poiToTours.has(k)) poiToTours.set(k, new Set());
      poiToTours.get(k).add(t.slug);
    }
  }

  // Load existing POIs from match_pois (only attractions)
  console.log("Loading match_pois...");
  const { data: pois, error: poiErr } = await sb
    .from("match_pois")
    .select("poi_key, name_en, region")
    .not("name_en", "is", null);
  if (poiErr) throw poiErr;
  console.log(`  ${pois.length} attraction POIs`);

  const auditRows = [];
  let updates = 0;
  let noCoverage = 0;

  for (const poi of pois) {
    const linkedTours = [...(poiToTours.get(poi.poi_key) ?? [])];
    if (linkedTours.length === 0) {
      auditRows.push({
        poi_key: poi.poi_key,
        name_en: poi.name_en,
        region: poi.region,
        tour_count: 0,
        dimension_count: 0,
        status: "NO_COVERAGE",
      });
      noCoverage++;
      continue;
    }

    // Weight per tour = 1/N where N is the tour's stop count.
    // If tour count is unknown (anchor-only relationship), assume avg 5.
    const weighted = new Map();
    let totalWeight = 0;

    for (const slug of linkedTours) {
      const profile = tourBySlug.get(slug);
      if (!profile) continue;
      const stopCount = tourStopCount.get(slug) || 5;
      const weight = 1 / stopCount;
      totalWeight += weight;

      for (const [k, v] of Object.entries(profile)) {
        if (shouldDropKey(k)) continue;
        if (!isNumericKeepable(v)) continue;
        const numeric = typeof v === "boolean" ? (v ? 1 : 0) : v;
        const existing = weighted.get(k) ?? { sum: 0, weight: 0 };
        existing.sum += numeric * weight;
        existing.weight += weight;
        weighted.set(k, existing);
      }
    }

    // Build final profile (round to 3 decimals)
    const finalProfile = {};
    for (const [k, agg] of weighted) {
      if (agg.weight === 0) continue;
      finalProfile[k] = Number((agg.sum / agg.weight).toFixed(3));
    }

    auditRows.push({
      poi_key: poi.poi_key,
      name_en: poi.name_en,
      region: poi.region,
      tour_count: linkedTours.length,
      dimension_count: Object.keys(finalProfile).length,
      status: Object.keys(finalProfile).length > 0 ? "OK" : "EMPTY",
    });

    if (DRY_RUN) continue;

    const { error: updErr } = await sb
      .from("match_pois")
      .update({ matching_profile: finalProfile })
      .eq("poi_key", poi.poi_key);
    if (updErr) {
      console.error(`  UPDATE error ${poi.poi_key}:`, updErr);
      continue;
    }
    updates++;
  }

  // Write CSV audit
  const headers = ["poi_key", "name_en", "region", "tour_count", "dimension_count", "status"];
  const csv = [headers.join(",")]
    .concat(auditRows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")))
    .join("\n");
  writeFileSync(AUDIT_CSV, csv, "utf8");

  // Summary stats
  const dimCounts = auditRows.filter((r) => r.dimension_count > 0).map((r) => r.dimension_count);
  const avgDim = dimCounts.length
    ? Math.round(dimCounts.reduce((a, b) => a + b, 0) / dimCounts.length)
    : 0;
  const minDim = dimCounts.length ? Math.min(...dimCounts) : 0;
  const maxDim = dimCounts.length ? Math.max(...dimCounts) : 0;

  console.log("\n=== Summary ===");
  console.log(`Updates ${DRY_RUN ? "(dry-run)" : "applied"}: ${DRY_RUN ? auditRows.filter((r) => r.status === "OK").length : updates}`);
  console.log(`No coverage: ${noCoverage}`);
  console.log(`Dimensions per POI — avg ${avgDim}, min ${minDim}, max ${maxDim}`);
  console.log(`Audit CSV: ${AUDIT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
