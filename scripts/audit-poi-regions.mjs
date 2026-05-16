#!/usr/bin/env node
/**
 * Phase 2 quality pass — reverse-geocode every POI's lat/lng to get its true
 * administrative location, then propose region corrections.
 *
 * Output:
 *   - scripts/poi-region-audit.csv (poi_key, name_en, lat, lng, current_region,
 *     formatted_address, inferred_region, action)
 *   - Console summary of proposed changes
 *
 * Usage:
 *   node --env-file=.env.local scripts/audit-poi-regions.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "scripts/poi-region-audit.csv");

const THROTTLE_MS = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reverseGeocode(lat, lng, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${apiKey}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status !== "OK" || !Array.isArray(d.results) || d.results.length === 0) return null;
  // Pick the most informative result (last one usually has province only; first has full street)
  const top = d.results[0];
  const adminLevels = {};
  for (const result of d.results) {
    for (const comp of result.address_components || []) {
      for (const type of comp.types || []) {
        if (!adminLevels[type]) adminLevels[type] = comp.long_name;
      }
    }
  }
  return {
    formatted_address: top.formatted_address,
    locality: adminLevels.locality || "",
    admin1: adminLevels.administrative_area_level_1 || "",
    admin2: adminLevels.administrative_area_level_2 || "",
    country: adminLevels.country || "",
  };
}

function inferRegion(parts) {
  const tokens = [
    parts.formatted_address,
    parts.locality,
    parts.admin1,
    parts.admin2,
  ].join(" | ").toLowerCase();
  if (tokens.includes("jeju") || tokens.includes("cheju") || tokens.includes("seogwipo")) return "jeju";
  if (tokens.includes("busan")) return "busan";
  if (tokens.includes("yangsan")) return "yangsan";
  if (tokens.includes("gyeongju")) return "gyeongju";
  if (tokens.includes("ulju") || tokens.includes("ulsan")) return "ulsan";
  if (tokens.includes("seoul")) return "seoul";
  if (tokens.includes("incheon")) return "incheon";
  if (tokens.includes("sokcho") || tokens.includes("yangyang") || tokens.includes("gangwon"))
    return "gangwon";
  if (
    tokens.includes("gyeonggi") ||
    tokens.includes("paju") ||
    tokens.includes("yongin") ||
    tokens.includes("suwon") ||
    tokens.includes("pocheon") ||
    tokens.includes("gapyeong") ||
    tokens.includes("gwangmyeong")
  )
    return "gyeonggi";
  return null;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  const e = s.replace(/"/g, '""');
  return /[",\n]/.test(e) ? `"${e}"` : e;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!url || !key || !apiKey) throw new Error("Missing env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: pois, error } = await sb
    .from("match_pois")
    .select("poi_key, name_en, region, lat, lng")
    .not("name_en", "is", null)
    .not("lat", "is", null)
    .not("poi_key", "like", "route_variant_%")
    .order("poi_key");
  if (error) throw error;

  console.log(`Reverse-geocoding ${pois.length} POIs...`);

  const rows = [];
  let changes = 0;
  let unparsed = 0;
  for (const p of pois) {
    const parts = await reverseGeocode(p.lat, p.lng, apiKey);
    if (!parts) {
      console.log(`  ? ${p.poi_key} | reverse-geocode failed`);
      rows.push({
        poi_key: p.poi_key,
        name_en: p.name_en,
        lat: p.lat,
        lng: p.lng,
        current_region: p.region,
        formatted_address: "(reverse-geocode failed)",
        locality: "",
        admin1: "",
        admin2: "",
        inferred_region: "",
        action: "MANUAL_REVIEW",
      });
      unparsed++;
      await sleep(THROTTLE_MS);
      continue;
    }
    const inferred = inferRegion(parts);
    const action = !inferred
      ? "MANUAL_REVIEW"
      : inferred === p.region
      ? "KEEP"
      : "CHANGE";
    if (action === "CHANGE") changes++;
    if (action === "MANUAL_REVIEW") unparsed++;
    rows.push({
      poi_key: p.poi_key,
      name_en: p.name_en,
      lat: p.lat,
      lng: p.lng,
      current_region: p.region,
      formatted_address: parts.formatted_address,
      locality: parts.locality,
      admin1: parts.admin1,
      admin2: parts.admin2,
      inferred_region: inferred || "",
      action,
    });
    if (action === "CHANGE") {
      console.log(
        `  CHANGE: ${p.poi_key.padEnd(38)} | ${String(p.region).padEnd(10)} → ${inferred} | ${parts.admin1} / ${parts.locality}`
      );
    } else if (action === "MANUAL_REVIEW") {
      console.log(
        `  REVIEW: ${p.poi_key.padEnd(38)} | region:${p.region} | addr: ${parts.formatted_address}`
      );
    }
    await sleep(THROTTLE_MS);
  }

  // Write CSV
  const headers = [
    "poi_key",
    "name_en",
    "lat",
    "lng",
    "current_region",
    "formatted_address",
    "locality",
    "admin1",
    "admin2",
    "inferred_region",
    "action",
  ];
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")))
    .join("\n");
  writeFileSync(OUT, csv, "utf8");

  console.log(`\nTotal: ${pois.length} | CHANGE: ${changes} | KEEP: ${pois.length - changes - unparsed} | REVIEW: ${unparsed}`);
  // Final region distribution preview
  const finalCounts = {};
  for (const r of rows) {
    const final = r.inferred_region || r.current_region;
    finalCounts[final] = (finalCounts[final] || 0) + 1;
  }
  console.log("Region distribution after applying CHANGEs:", finalCounts);
  console.log(`Audit CSV: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
