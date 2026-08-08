/**
 * Fill `itinerary_variants[].stops[].image` for the two Jeju cruise
 * shore-excursion products — repo bundles (all locales) + live DB payloads.
 *
 * Why: the port-switched timeline (`PortSelectorTimeline`) ships photo-less —
 * variant stops never carried `image`, the adapter dropped the field, and the
 * renderer never drew it. Owner directive 2026-08-08: itinerary tabs must show
 * stop photos. The renderer/adapter fix lands in the same PR; this script is
 * the data half.
 *
 * Image choices reuse the photo-curation track's picks already live on sibling
 * products (same POIs), plus one new import (Seogwipo Maeil Olle Market —
 * D:/한국여행사진_통합, summer set; the spring set in that folder is mis-filed
 * Dongmun Market and must not be used).
 *
 * Matching is structural — (port_id, stop index) — because stop names differ
 * per locale. Guard: a variant whose stop count differs from the EN reference
 * is skipped with a warning (never guess indices on drifted data).
 *
 * Usage:
 *   node scripts/patch-jeju-cruise-variant-images-2026-08.mjs            # repo bundles (dry)
 *   node scripts/patch-jeju-cruise-variant-images-2026-08.mjs --write    # repo bundles (write)
 *   node --env-file=../.env.local scripts/... --apply-db                 # live DB rows
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SLUGS = [
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
];

/** (port_id → stop index → image). OPS stops (pickup/lunch/return) stay imageless by design. */
const IMAGE_MAP = {
  jeju_port: {
    1: "/images/tours/seongsan-ilchulbong/01-kakaotalk-20260510-230028438-06.webp", // Seongsan Ilchulbong
    2: "/images/tours/seopjikoji/01-kakaotalk-20260510-230009595-11.webp", // Seopjikoji
    4: "/images/tours/seongeup-folk-village/01-chatgpt-image-2026-5-8-07-38-22.webp", // Seongeup Folk Village
  },
  gangjeong_port: {
    1: "/images/tours/hallasan-1100/01-kakaotalk-20260510-230009595-23.webp", // Hallasan 1100 Wetland
    2: "/images/tours/jusangjeolli/01-kakaotalk-20260510-230028438-13.webp", // Daepo Jusangjeolli
    4: "/images/tours/cheonjiyeon-falls/02-kakaotalk-20250603-192859914-02.webp", // Cheonjiyeon Falls
    5: "/images/tours/seogwipo-maeil-olle-market/01-kakaotalk-20250617-123810800.webp", // Olle Maeil Market
  },
};

const EXPECTED_STOP_COUNT = { jeju_port: 6, gangjeong_port: 7 };

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--write");
const APPLY_DB = args.has("--apply-db");

/** Verify every mapped file exists so we never ship a 404 thumb. */
for (const portMap of Object.values(IMAGE_MAP)) {
  for (const img of Object.values(portMap)) {
    const local = join("public", img);
    if (!existsSync(local)) {
      console.error(`🔴 missing image file: ${local}`);
      process.exit(1);
    }
  }
}

/** Returns {changed, overwritten:[...]} and mutates variants in place. */
function patchVariants(variants, label) {
  let changed = 0;
  const notes = [];
  if (!Array.isArray(variants)) return { changed, notes };
  for (const v of variants) {
    const portId = v?.port_id;
    const map = IMAGE_MAP[portId];
    if (!map) {
      notes.push(`⚠ ${label}: unknown port_id ${portId} — skipped`);
      continue;
    }
    const stops = Array.isArray(v.stops) ? v.stops : [];
    if (stops.length !== EXPECTED_STOP_COUNT[portId]) {
      notes.push(`⚠ ${label}/${portId}: ${stops.length} stops (expected ${EXPECTED_STOP_COUNT[portId]}) — skipped`);
      continue;
    }
    for (const [idxStr, img] of Object.entries(map)) {
      const stop = stops[Number(idxStr)];
      if (!stop || typeof stop !== "object") continue;
      const prev = typeof stop.image === "string" ? stop.image : "";
      if (prev === img) continue;
      if (prev) notes.push(`… ${label}/${portId}[${idxStr}] overwrote ${prev} → ${img}`);
      stop.image = img;
      changed += 1;
    }
    /* OPS stops (pickup / lunch / return) are imageless by design. Five locales
     * were bulk-stamped with the Seongsan photo on ALL 13 stops — clear any
     * image on non-mapped indices so terminals/lunch don't show a wrong POI. */
    stops.forEach((stop, i) => {
      if (map[i] || !stop || typeof stop !== "object") return;
      if (typeof stop.image === "string" && stop.image) {
        notes.push(`… ${label}/${portId}[${i}] cleared wrong OPS-stop image ${stop.image}`);
        delete stop.image;
        changed += 1;
      }
    });
  }
  return { changed, notes };
}

function patchRepoBundles() {
  let totalFiles = 0;
  for (const slug of SLUGS) {
    const dir = join("components", "product-tour-static", slug);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const path = join(dir, file);
      const json = JSON.parse(readFileSync(path, "utf8"));
      const { changed, notes } = patchVariants(json.itinerary_variants, file);
      notes.forEach((n) => console.log(n));
      if (changed > 0) {
        totalFiles += 1;
        if (WRITE) writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
        console.log(`${WRITE ? "✍" : "would write"} ${path} (+${changed} images)`);
      } else {
        console.log(`= ${path} already current`);
      }
    }
  }
  console.log(`repo: ${totalFiles} files ${WRITE ? "written" : "to write"}`);
}

async function patchDb() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("🔴 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (run with --env-file=.env.local)");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase
    .from("tour_product_pages")
    .select("id, slug, locale, detail_payload")
    .in("slug", SLUGS);
  if (error) throw error;
  let updated = 0;
  for (const row of rows ?? []) {
    const payload = row.detail_payload;
    if (!payload || typeof payload !== "object") {
      console.log(`⚠ ${row.slug}/${row.locale}: no payload — skipped`);
      continue;
    }
    const { changed, notes } = patchVariants(payload.itinerary_variants, `${row.slug}/${row.locale}`);
    notes.forEach((n) => console.log(n));
    if (changed === 0) {
      console.log(`= ${row.slug}/${row.locale} already current`);
      continue;
    }
    const { error: upErr } = await supabase
      .from("tour_product_pages")
      .update({ detail_payload: payload })
      .eq("id", row.id);
    if (upErr) {
      console.error(`🔴 update failed ${row.slug}/${row.locale}:`, upErr.message);
      continue;
    }
    updated += 1;
    console.log(`✍ DB ${row.slug}/${row.locale} (+${changed} images)`);
  }
  console.log(`db: ${updated}/${rows?.length ?? 0} rows updated`);
}

if (APPLY_DB) {
  await patchDb();
} else {
  patchRepoBundles();
}
