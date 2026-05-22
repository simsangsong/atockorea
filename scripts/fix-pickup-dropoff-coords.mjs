#!/usr/bin/env node
/**
 * Phase 3 — correct pickup/drop-off coordinates + sync `_role` markers.
 *
 * Writes to BOTH sources (kept in sync per project setup):
 *   1. static JSON bundles  components/product-tour-static/<slug>/<slug>.<locale>.json
 *   2. Supabase tour_product_pages.detail_payload  (all 6 locale rows)
 *
 * Coordinates are corrected by ARRAY POSITION (locale-independent): the EN row's
 * point name decides the canonical coord, applied to that index across all locales.
 * `_role` pickup/drop-off pseudo-stop markers are (re)asserted on stop[0] / stop[last].
 *
 *   node scripts/fix-pickup-dropoff-coords.mjs [--dry-run] [--only=<slug>]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS = join(ROOT, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const DRY = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;

function env(name) {
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(join(ROOT, f), "utf8").match(new RegExp("^\\s*" + name + "\\s*=\\s*(.+)\\s*$", "m"));
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* ignore */
    }
  }
  return process.env[name] || "";
}

// Canonical corrected coordinates (Google Geocoding, reviewed 2026-05-23). [lat, lng].
const C = {
  ocean_suites: [33.51823, 126.52317],
  jeju_airport: [33.50708, 126.49343],
  lotte_jeju: [33.4906, 126.48643],
  shilla_jeju: [33.48631, 126.48739],
  dongmun: [33.51204, 126.52828],
  seomyeon: [35.15782, 129.06003],
  busan_station: [35.11449, 129.03933],
  haeundae: [35.16396, 129.15853],
  jagalchi: [35.09663, 129.0308],
  busan_port: [35.11744, 129.04869],
  nopo: [35.28359, 129.09482],
  hongik: [37.55753, 126.92447],
  myeongdong: [37.56099, 126.98619],
  incheon_cruise: [37.42414, 126.60557],
  incheon_airport: [37.45867, 126.44197],
};

/** EN point name -> canonical coord (null = leave unchanged). */
function coordFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("ocean suites")) return C.ocean_suites;
  if (n.includes("jeju international airport")) return C.jeju_airport;
  if (n.includes("lotte city hotel jeju")) return C.lotte_jeju;
  if (n.includes("shilla duty free")) return C.shilla_jeju;
  if (n.includes("dongmun")) return C.dongmun;
  if (n.includes("seomyeon station")) return C.seomyeon;
  if (n.includes("busan station")) return C.busan_station;
  if (n.includes("haeundae station")) return C.haeundae;
  if (n.includes("nampo") || n.includes("jagalchi")) return C.jagalchi;
  if (n.includes("busan port international")) return C.busan_port;
  if (n.includes("nopo station")) return C.nopo;
  if (n.includes("hongik")) return C.hongik;
  if (n.includes("myeongdong station")) return C.myeongdong;
  if (n.includes("incheon cruise terminal")) return C.incheon_cruise;
  if (n.includes("incheon international airport")) return C.incheon_airport;
  return null;
}

const LEADING = new Set([
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "busan-top-attractions-day-tour",
  "from-busan-gyeongju-ancient-capital-day-tour",
  "from-incheon-seoul-day-tour-cruise-guests",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-west-south-full-day-authentic-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
]);
// TRAILING = LEADING minus busan-top-attractions (its last stop is a real attraction).
const TRAILING = new Set([...LEADING].filter((s) => s !== "busan-top-attractions-day-tour"));

const round = (n) => Math.round(n * 100000) / 100000;

/** Mutate a parsed full-page object in place. Returns count of coordinate fields changed. */
function patchPayload(obj, depCoords, retCoords, slug) {
  let changed = 0;
  const dep = obj?.pickup_dropoff?.departure;
  const ret = obj?.pickup_dropoff?.return;
  if (Array.isArray(dep)) {
    dep.forEach((p, i) => {
      const c = depCoords[i];
      if (c && (p.lat !== c[0] || p.lng !== c[1])) {
        p.lat = c[0];
        p.lng = c[1];
        changed++;
      }
    });
  }
  if (Array.isArray(ret)) {
    ret.forEach((p, i) => {
      const c = retCoords[i];
      if (c && (p.lat !== c[0] || p.lng !== c[1])) {
        p.lat = c[0];
        p.lng = c[1];
        changed++;
      }
    });
  }
  const stops = obj?.itineraryStops;
  if (Array.isArray(stops) && stops.length > 1) {
    if (LEADING.has(slug) && stops[0] && stops[0]._role !== "pickup") {
      stops[0]._role = "pickup";
      changed++;
    }
    if (TRAILING.has(slug)) {
      const last = stops[stops.length - 1];
      if (last && last._role !== "dropoff") {
        last._role = "dropoff";
        changed++;
      }
    }
  }
  return changed;
}

function writeJsonPreserving(path, obj, originalText) {
  const eol = originalText.includes("\r\n") ? "\r\n" : "\n";
  let out = JSON.stringify(obj, null, 2);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  out += originalText.endsWith("\n") || originalText.endsWith("\r\n") ? eol : "";
  writeFileSync(path, out, "utf8");
}

async function main() {
  const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  // Determine slugs to process: those whose en.json has pickup_dropoff.departure.
  const { readdirSync } = await import("node:fs");
  let slugs = readdirSync(TOURS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => {
      const enPath = join(TOURS, slug, `${slug}.en.json`);
      if (!existsSync(enPath)) return false;
      try {
        const en = JSON.parse(readFileSync(enPath, "utf8"));
        return Array.isArray(en?.pickup_dropoff?.departure);
      } catch {
        return false;
      }
    });
  if (ONLY) slugs = slugs.filter((s) => s === ONLY);

  let totalJson = 0;
  let totalDb = 0;
  for (const slug of slugs) {
    // Build per-index coord arrays from the EN file (authoritative point names).
    const enPath = join(TOURS, slug, `${slug}.en.json`);
    const en = JSON.parse(readFileSync(enPath, "utf8"));
    const depCoords = (en.pickup_dropoff.departure || []).map((p) => {
      const c = coordFor(p.name);
      return c ? [round(c[0]), round(c[1])] : null;
    });
    const retCoords = (en.pickup_dropoff.return || []).map((p) => coordFor(p.name)).map((c) => (c ? [round(c[0]), round(c[1])] : null));
    const unmatched = (en.pickup_dropoff.departure || [])
      .concat(en.pickup_dropoff.return || [])
      .filter((p) => p.lat != null && coordFor(p.name) == null)
      .map((p) => p.name);
    if (unmatched.length) console.log(`  ⚠ ${slug}: unmatched (kept as-is): ${[...new Set(unmatched)].join(", ")}`);

    // 1) JSON files
    for (const loc of LOCALES) {
      const p = join(TOURS, slug, `${slug}.${loc}.json`);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, "utf8");
      const obj = JSON.parse(text);
      const n = patchPayload(obj, depCoords, retCoords, slug);
      if (n > 0) {
        if (!DRY) writeJsonPreserving(p, obj, text);
        totalJson++;
        console.log(`  JSON ${slug}.${loc}  (${n} fields)${DRY ? " [dry]" : ""}`);
      }
    }

    // 2) DB rows
    const { data, error } = await sb
      .from("tour_product_pages")
      .select("locale, detail_payload")
      .eq("slug", slug);
    if (error) {
      console.log(`  ✗ DB read ${slug}: ${error.message}`);
      continue;
    }
    for (const row of data || []) {
      const dp = row.detail_payload;
      const n = patchPayload(dp, depCoords, retCoords, slug);
      if (n > 0) {
        if (!DRY) {
          const { error: upErr } = await sb
            .from("tour_product_pages")
            .update({ detail_payload: dp })
            .eq("slug", slug)
            .eq("locale", row.locale);
          if (upErr) {
            console.log(`  ✗ DB update ${slug}.${row.locale}: ${upErr.message}`);
            continue;
          }
        }
        totalDb++;
        console.log(`  DB   ${slug}.${row.locale}  (${n} fields)${DRY ? " [dry]" : ""}`);
      }
    }
  }
  console.log(`\nDone${DRY ? " (dry-run)" : ""}: ${slugs.length} slugs, ${totalJson} JSON files, ${totalDb} DB rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
