#!/usr/bin/env node
/**
 * Itinerary Builder Phase 2 — populate match_pois.lat / lng via Google Geocoding.
 *
 * Strategy per planner §F Phase 2:
 *   1. Read POIs where lat IS NULL AND name_en IS NOT NULL.
 *   2. For each: try `<name_ko> 한국` first (better recall for Korean POIs),
 *      fall back to `<name_en> South Korea`. Use `region=kr` bias.
 *   3. Throttle 250 ms between requests.
 *   4. Validate result is inside Korea bounding box; otherwise mark for override.
 *   5. Write CSV audit `scripts/poi-coord-audit.csv` for review.
 *   6. If --apply-overrides is passed, also read `scripts/poi-coord-overrides.csv`
 *      (poi_key, lat, lng, note) and apply those instead of geocoding.
 *
 * Cost estimate: ~$5 per 1000 requests. 82 POIs × ~1.5 attempts ≈ $0.60.
 *
 * Usage:
 *   node --env-file=.env.local scripts/geocode-match-pois.mjs [--dry-run] [--apply-overrides]
 *
 * Acceptance check at end:
 *   - 100% of attraction POIs have non-null lat AND lng
 *   - All coords within Korea bbox (33.0-38.7 lat, 124.6-131.0 lng)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIT_CSV = join(ROOT, "scripts/poi-coord-audit.csv");
const OVERRIDES_CSV = join(ROOT, "scripts/poi-coord-overrides.csv");

const KOREA_BBOX = { latMin: 33.0, latMax: 38.7, lngMin: 124.6, lngMax: 131.0 };
const THROTTLE_MS = 250;

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY_OVERRIDES = process.argv.includes("--apply-overrides");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withinKorea(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= KOREA_BBOX.latMin &&
    lat <= KOREA_BBOX.latMax &&
    lng >= KOREA_BBOX.lngMin &&
    lng <= KOREA_BBOX.lngMax
  );
}

async function geocode(query, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&region=kr&language=en&key=${apiKey}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.status === "OVER_QUERY_LIMIT") {
    throw new Error("Geocoder hit OVER_QUERY_LIMIT — abort and retry later");
  }
  if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
    return { ok: false, status: data.status, error_message: data.error_message };
  }
  const top = data.results[0];
  return {
    ok: true,
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    formatted_address: top.formatted_address,
    location_type: top.geometry.location_type, // ROOFTOP > GEOMETRIC_CENTER > RANGE_INTERPOLATED > APPROXIMATE
    place_id: top.place_id,
    types: top.types?.join("|") || "",
  };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  const escaped = s.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function writeAuditCsv(rows) {
  const headers = [
    "poi_key",
    "name_en",
    "name_ko",
    "region",
    "used_query",
    "fallback_used",
    "lat",
    "lng",
    "formatted_address",
    "location_type",
    "in_bbox",
    "status",
    "place_id",
    "types",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  writeFileSync(AUDIT_CSV, lines.join("\n"), "utf8");
}

function parseOverridesCsv() {
  if (!existsSync(OVERRIDES_CSV)) return [];
  const text = readFileSync(OVERRIDES_CSV, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headerCols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const row = {};
    headerCols.forEach((h, idx) => (row[h] = parts[idx]?.trim()));
    if (!row.poi_key || !row.lat || !row.lng) continue;
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (!withinKorea(lat, lng)) {
      console.warn(`Override for ${row.poi_key} is outside Korea bbox; skipping`);
      continue;
    }
    out.push({ poi_key: row.poi_key, lat, lng, note: row.note || "manual_override" });
  }
  return out;
}

async function applyOverrides(supabase) {
  const overrides = parseOverridesCsv();
  if (overrides.length === 0) {
    console.log("No overrides found.");
    return 0;
  }
  console.log(`Applying ${overrides.length} overrides...`);
  let applied = 0;
  for (const o of overrides) {
    if (DRY_RUN) {
      console.log(`  [dry-run] would set ${o.poi_key} → (${o.lat}, ${o.lng}) (${o.note})`);
      continue;
    }
    const { error } = await supabase
      .from("match_pois")
      .update({ lat: o.lat, lng: o.lng })
      .eq("poi_key", o.poi_key);
    if (error) {
      console.error(`  UPDATE error for ${o.poi_key}:`, error);
      continue;
    }
    console.log(`  Override applied: ${o.poi_key} → (${o.lat}, ${o.lng}) (${o.note})`);
    applied++;
  }
  return applied;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Server-side scripts MUST use the unrestricted server key, not the
  // browser-referrer-restricted public key (which Google rejects from servers).
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) {
    throw new Error(
      "Missing GOOGLE_MAPS_API_KEY. The NEXT_PUBLIC_ key is referrer-restricted and Google rejects it from servers. Create a separate server-side key in Google Cloud Console with Geocoding API enabled."
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Apply overrides first if requested
  if (APPLY_OVERRIDES) {
    const applied = await applyOverrides(supabase);
    console.log(`Overrides applied: ${applied}`);
  }

  // Then geocode any remaining nulls
  const { data: pois, error } = await supabase
    .from("match_pois")
    .select("poi_key, name_en, name_ko, region, lat, lng")
    .is("lat", null)
    .not("name_en", "is", null)
    .order("poi_key");
  if (error) throw error;

  console.log(`\nGeocoding ${pois.length} POIs missing lat/lng...`);

  const auditRows = [];
  let ok = 0;
  let miss = 0;
  let outOfBox = 0;

  for (const p of pois) {
    const queries = [];
    if (p.name_ko) queries.push({ q: `${p.name_ko} 한국`, fallback: false });
    if (p.name_en) queries.push({ q: `${p.name_en} South Korea`, fallback: true });

    let result = null;
    let usedQuery = "";
    let fallbackUsed = false;

    for (const { q, fallback } of queries) {
      try {
        const r = await geocode(q, apiKey);
        if (r.ok) {
          result = r;
          usedQuery = q;
          fallbackUsed = fallback;
          break;
        }
      } catch (e) {
        console.error(`Fatal: ${e.message}`);
        throw e;
      }
      await sleep(THROTTLE_MS);
    }

    if (!result) {
      miss++;
      auditRows.push({
        poi_key: p.poi_key,
        name_en: p.name_en,
        name_ko: p.name_ko,
        region: p.region,
        used_query: queries.map((x) => x.q).join(" | "),
        fallback_used: "N",
        lat: "",
        lng: "",
        formatted_address: "",
        location_type: "MISS",
        in_bbox: "",
        status: "NEEDS_OVERRIDE",
        place_id: "",
        types: "",
      });
      console.log(`  MISS: ${p.poi_key} (${p.name_en})`);
      await sleep(THROTTLE_MS);
      continue;
    }

    const inBox = withinKorea(result.lat, result.lng);
    if (!inBox) outOfBox++;

    auditRows.push({
      poi_key: p.poi_key,
      name_en: p.name_en,
      name_ko: p.name_ko,
      region: p.region,
      used_query: usedQuery,
      fallback_used: fallbackUsed ? "Y" : "N",
      lat: result.lat,
      lng: result.lng,
      formatted_address: result.formatted_address,
      location_type: result.location_type,
      in_bbox: inBox ? "Y" : "N",
      status: inBox
        ? result.location_type === "APPROXIMATE"
          ? "OK_LOW_CONF"
          : "OK"
        : "OUT_OF_KOREA",
      place_id: result.place_id,
      types: result.types,
    });

    if (inBox && !DRY_RUN) {
      const { error: upErr } = await supabase
        .from("match_pois")
        .update({ lat: result.lat, lng: result.lng })
        .eq("poi_key", p.poi_key);
      if (upErr) {
        console.error(`  UPDATE error: ${p.poi_key}`, upErr);
      } else {
        ok++;
        console.log(
          `  OK${fallbackUsed ? " (fallback)" : ""}: ${p.poi_key} → (${result.lat.toFixed(
            4
          )}, ${result.lng.toFixed(4)}) ${result.location_type}`
        );
      }
    } else if (!inBox) {
      console.warn(
        `  OUT_OF_BBOX: ${p.poi_key} → (${result.lat}, ${result.lng}) — ${result.formatted_address}`
      );
    } else if (DRY_RUN) {
      console.log(`  [dry-run] OK: ${p.poi_key} → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`);
      ok++;
    }

    await sleep(THROTTLE_MS);
  }

  writeAuditCsv(auditRows);
  console.log(`\nSummary: OK ${ok} | MISS ${miss} | OUT_OF_BBOX ${outOfBox} | Total ${pois.length}`);
  console.log(`Audit CSV: ${AUDIT_CSV}`);

  // Acceptance probe
  const { data: stillNull, error: probeErr } = await supabase
    .from("match_pois")
    .select("poi_key, name_en")
    .is("lat", null)
    .not("name_en", "is", null);
  if (probeErr) throw probeErr;
  console.log(
    `Acceptance probe: ${stillNull.length} POIs still missing lat/lng (target: 0)`
  );
  if (stillNull.length > 0 && !DRY_RUN) {
    console.log("Remaining:", stillNull.map((p) => p.poi_key).join(", "));
    console.log("→ Create scripts/poi-coord-overrides.csv with poi_key,lat,lng,note rows");
    console.log("→ Re-run with --apply-overrides");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
