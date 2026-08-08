/**
 * Fill missing `itineraryStops[].image` on standard-timeline products —
 * repo bundles (all locales) + live DB payloads. Owner directive 2026-08-08
 * ("다른 상품들 일정탭에서도 사진 빠진게 있는지 확인해보고 수정해").
 *
 * Sweep verdict (full scan of 35 bundles): pickup/lunch/return/drop-off stops
 * are imageless BY DESIGN; real sightseeing gaps were only the stops below.
 * Jaein Falls / Eobi Ice Wall / Sokcho market+beach stay imageless — zero real
 * photos exist in either library (flagged for the shooting list instead).
 *
 * The Busan city charter's four route cards were also all stamped with the
 * same Yonggungsa photo (routes 2-4 diversified here; route 1 keeps it as the
 * flagship attraction).
 *
 * Matching guard: stop index must exist AND the EN stop name must contain the
 * expected marker (per-locale files are patched by index only after the EN
 * file for that slug passes the name check — never guess on drifted data).
 *
 * Usage:
 *   node scripts/patch-itinerary-stop-images-2026-08.mjs           # dry
 *   node scripts/patch-itinerary-stop-images-2026-08.mjs --write   # repo bundles
 *   node --env-file=.env.local scripts/... --apply-db              # live DB rows
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** slug → [{ index, enNameIncludes, image }] */
const PATCHES = {
  "busan-small-group-yonggungsa-skycapsule-gamcheon-tour": [
    {
      index: 7,
      enNameIncludes: "Dakbatgol",
      image: "/images/tours/dakbatgol-mural-village/01-20260722-165446.webp",
    },
  ],
  "jeju-winter-southwest-tangerine-snow-camellia-tour": [
    {
      index: 1,
      enNameIncludes: "Eorimok",
      image: "/images/tours/hallasan-eorimok/01-kakaotalk-20250603-221325343-12.webp",
    },
  ],
  "busan-private-car-charter-city-tour": [
    {
      index: 1,
      enNameIncludes: "Route 2",
      image: "/images/tours/cheongsapo-blue-line/01-skycapsule-red13-pines-01.webp",
    },
    {
      index: 2,
      enNameIncludes: "Route 3",
      image: "/images/tours/gamcheon-culture-village/01-kakaotalk-20260510-222952680-01.webp",
    },
    {
      index: 3,
      enNameIncludes: "Route 4",
      image: "/images/tours/busan-tower/01-kakaotalk-20260510-230009595.webp",
    },
  ],
};

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--write");
const APPLY_DB = args.has("--apply-db");

for (const patches of Object.values(PATCHES)) {
  for (const p of patches) {
    if (!existsSync(join("public", p.image))) {
      console.error(`🔴 missing image file: public${p.image}`);
      process.exit(1);
    }
  }
}

/** EN name-check per slug: returns true when every patch matches the EN bundle. */
function enGuard(slug) {
  const f = join("components", "product-tour-static", slug, `${slug}.en.json`);
  const stops = JSON.parse(readFileSync(f, "utf8")).itineraryStops ?? [];
  for (const p of PATCHES[slug]) {
    const name = stops[p.index]?.name ?? "";
    if (!name.includes(p.enNameIncludes)) {
      console.error(`🔴 ${slug}: EN stop[${p.index}] "${name}" does not contain "${p.enNameIncludes}" — aborting slug`);
      return false;
    }
  }
  return true;
}

function patchStops(stops, slug, label) {
  let changed = 0;
  if (!Array.isArray(stops)) return 0;
  for (const p of PATCHES[slug]) {
    const stop = stops[p.index];
    if (!stop || typeof stop !== "object") {
      console.log(`⚠ ${label}: stop[${p.index}] missing — skipped`);
      continue;
    }
    const prev = typeof stop.image === "string" ? stop.image : "";
    if (prev === p.image) continue;
    if (prev) console.log(`… ${label}[${p.index}] overwrote ${prev} → ${p.image}`);
    stop.image = p.image;
    changed += 1;
  }
  return changed;
}

const okSlugs = Object.keys(PATCHES).filter(enGuard);

if (APPLY_DB) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("🔴 env missing (run with --env-file=.env.local)");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase
    .from("tour_product_pages")
    .select("id, slug, locale, detail_payload")
    .in("slug", okSlugs);
  if (error) throw error;
  let updated = 0;
  for (const row of rows ?? []) {
    const payload = row.detail_payload;
    if (!payload || typeof payload !== "object") continue;
    const changed = patchStops(payload.itineraryStops, row.slug, `${row.slug}/${row.locale}`);
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
    console.log(`✍ DB ${row.slug}/${row.locale} (+${changed})`);
  }
  console.log(`db: ${updated}/${rows?.length ?? 0} rows updated`);
} else {
  let files = 0;
  for (const slug of okSlugs) {
    const dir = join("components", "product-tour-static", slug);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const path = join(dir, file);
      const json = JSON.parse(readFileSync(path, "utf8"));
      const changed = patchStops(json.itineraryStops, slug, file);
      if (changed > 0) {
        files += 1;
        if (WRITE) writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
        console.log(`${WRITE ? "✍" : "would write"} ${path} (+${changed})`);
      } else {
        console.log(`= ${path} already current`);
      }
    }
  }
  console.log(`repo: ${files} files ${WRITE ? "written" : "to write"}`);
}
