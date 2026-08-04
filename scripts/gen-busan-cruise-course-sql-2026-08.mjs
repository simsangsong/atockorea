#!/usr/bin/env node
/**
 * Generates the DB-sync SQL for the 2026-08-04 course alignment of the three
 * Busan cruise shore-excursion SKUs, from the transformed static bundles.
 *
 * 🔴 WHY THIS FILE HAS TO EXIST. `TOUR_PRODUCT_USE_SUPABASE=1`, so
 * /tour-product/[slug] renders `tour_product_pages.detail_payload` — NOT the
 * static bundle. Editing the bundles changes nothing a guest can see until this
 * SQL runs. The Gyeongju revision hit exactly this and a real render is what
 * caught it there too; this pass was caught the same way.
 *
 *   1) public.tours              — copy / schedule / duration / stops
 *   2) public.tour_product_pages — 6 content locales, detail_payload
 *
 * 🔴 VISIBILITY AND PRICE ARE NOT TOUCHED HERE. Both were settled by
 * 2026-08-04-10-busan-cruise-listing-alignment.sql (58.79 / 68.95 / 456.99, the
 * join tier re-opened). `is_active` / `is_published` / price columns are excluded
 * so this file only refreshes WHAT THE PRODUCTS SAY.
 *
 * The bus tour additionally has de/fr/it/ru rows in tour_product_pages, staged by
 * the i18n track and served as EN by TOUR_PRODUCT_FALLBACK_URL_LOCALES. They are
 * deliberately NOT updated: they are invisible, and rewriting them is that
 * track's call, not this one's.
 *
 * Output: supabase/pending-db-apply/2026-08-05-12-busan-cruise-course-followups.sql
 * After applying: node scripts/import-match-v18.mjs --single <each slug>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const JOIN_BUS = "busan-cruise-shore-excursion-bus-tour";
const SMALL = "busan-small-group-sightseeing-tour-cruise-passengers";
const PRIVATE = "busan-private-car-charter-cruise-shore";
const SLUGS = [JOIN_BUS, SMALL, PRIVATE];

const bundle = (slug, loc) =>
  JSON.parse(readFileSync(path.join(ROOT, "components/product-tour-static", slug, `${slug}.${loc}.json`), "utf8"));

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
// tour_product_pages.badges is text[]; only tours.badges is jsonb. Same-named
// columns, different types — this has broken two batches already.
// Gate: __tests__/audit/pendingSqlColumnTypes.test.ts
const textArray = (v) =>
  Array.isArray(v) && v.length ? `ARRAY[${v.map(q).join(", ")}]::text[]` : `${q("{}")}::text[]`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

// --- Guards: never generate SQL from an un-transformed bundle -----------------

/**
 * 🔴 The name a guest reads must be the place the metadata says. The small-group
 * bundle shipped for months with ko/ja/zh/zh-TW/es stop names one place out of
 * step with their own `_poi_meta.poi_key` — the Korean page sold Taejongdae and
 * Nampo-dong while the English page sold Yonggungsa and Songdo. tsc was clean,
 * jest was green, and the poi_keys all matched across locales; only opening the
 * page showed it. This guard is the cheap version of that render.
 */
const NAME_FOR_KEY = {
  haedong_yonggungsa: /용궁|龍宮|龙宫|Yonggungsa/i,
  un_memorial_cemetery: /유엔|国連|国联|聯合國|联合国|\bUN\b|ONU/i,
  jagalchi_market: /자갈치|チャガルチ|ジャガルチ|札嘎其|札嘉其|Jagalchi/i,
  biff_square: /BIFF|비프/i,
  gukje_market: /국제시장|国際市場|国际市场|國際市場|Gukje/i,
  gamcheon_culture_village: /감천|甘川|Gamcheon/i,
  songdo_beach: /송도|松島|松岛|Songdo/i,
  yongdusan_park: /용두산|龍頭山|龙头山|Yongdusan/i,
};

function assertNamesMatchKeys(slug, loc, stops) {
  for (const [i, stop] of stops.entries()) {
    const key = stop._poi_meta?.poi_key;
    const probe = key && NAME_FOR_KEY[key];
    if (!probe) continue;
    if (!probe.test(String(stop.name ?? ""))) {
      throw new Error(
        `${slug} [${loc}]: stop ${i + 1} is keyed ${key} but named "${stop.name}" — ` +
          `the page would describe a different place than its own metadata`,
      );
    }
  }
}

for (const slug of [JOIN_BUS, SMALL]) {
  for (const loc of LOCALES) {
    const b = bundle(slug, loc);
    const stops = b.itineraryStops || [];
    if (stops.length !== 12) {
      throw new Error(`${slug} [${loc}]: expected 12 stop entries (9 sights + lunch + pickup + return), got ${stops.length}`);
    }
    if (b.catalog_card?.stopsCount !== 9) {
      throw new Error(`${slug} [${loc}]: catalog_card.stopsCount is ${b.catalog_card?.stopsCount}, expected 9`);
    }
    assertNamesMatchKeys(slug, loc, stops);
    if (stops[0].time !== "≈ 09:00" || stops[11].time !== "≈ 17:00") {
      throw new Error(`${slug} [${loc}]: not on the 8-hour spine (${stops[0].time} → ${stops[11].time})`);
    }
    // Stale-claim net: the old day ran 08:30→19:15 and sold Gamcheon on golden
    // hour. If any of that survived into guest copy the transformer regressed.
    const guest = JSON.stringify({ ...b, page_sections: undefined, _publication: undefined });
    // 19:30 is deliberately NOT probed bare: it is Gukje Market's closing time
    // ("09:30-19:30"), which is correct data. Probe the schedule claims only.
    for (const stale of ["08:25", "08:30", "19:15", "9-hour", "signature stops"]) {
      if (stale === "signature stops") {
        if (/\b(8|eight) signature stops/i.test(guest)) {
          throw new Error(`${slug} [${loc}]: still advertises 8 signature stops (the course now has 9)`);
        }
        continue;
      }
      if (guest.includes(stale)) throw new Error(`${slug} [${loc}]: stale claim "${stale}" still in guest copy`);
    }
  }
}

let out = "";
out += `-- =============================================================================\n`;
out += `-- Busan cruise shore-excursion trio — COURSE ALIGNMENT (owner instruction 2026-08-04)\n`;
out += `-- =============================================================================\n`;
out += `-- Generated by scripts/gen-busan-cruise-course-sql-2026-08.mjs from the bundles\n`;
out += `-- rewritten by scripts/align-busan-cruise-course-2026-08.mjs.\n`;
out += `--\n`;
out += `-- 🔴 WITHOUT THIS FILE THE REPO CHANGE IS INVISIBLE. TOUR_PRODUCT_USE_SUPABASE=1,\n`;
out += `--    so /tour-product/[slug] renders tour_product_pages.detail_payload, not the\n`;
out += `--    static bundle. A real render is what caught this.\n`;
out += `--\n`;
out += `-- Both join tiers now run the listing's 9 stops as discrete stops:\n`;
out += `--   Haedong Yonggungsa → UN Memorial → lunch (own expense) → Jagalchi →\n`;
out += `--   BIFF Square → Gukje Market → Gamcheon → Songdo Cloud Trails →\n`;
out += `--   Songdo Sky Park (cable car chosen on site) → Yongdusan Park\n`;
out += `-- Day re-timed onto a real 8-hour spine: 09:00 pickup → 17:00 drop-off. The card\n`;
out += `-- already claimed 8 hours while the itinerary ran 08:30–19:15.\n`;
out += `-- Inclusions/exclusions and the surcharge / cancellation / age / cruise-only\n`;
out += `-- policy accordion are aligned on all three tiers.\n`;
out += `--\n`;
out += `-- 🔴 PRICE AND VISIBILITY ARE NOT IN THIS FILE. 2026-08-04-10 set 58.79 / 68.95 /\n`;
out += `--    456.99 and re-opened the join tier. Nothing here touches is_active,\n`;
out += `--    is_published, price, original_price or tour_product_offers.\n`;
out += `--\n`;
out += `-- The bus tour's de/fr/it/ru page rows are NOT updated: they are staged by the\n`;
out += `-- i18n track and served as EN via TOUR_PRODUCT_FALLBACK_URL_LOCALES.\n`;
out += `--\n`;
out += `-- Idempotent: every statement is an UPDATE keyed on (slug) or (slug, locale).\n`;
out += `-- AFTER APPLYING, refresh the recommender for all three:\n`;
for (const slug of SLUGS) out += `--   node scripts/import-match-v18.mjs --single ${slug}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

for (const slug of SLUGS) {
  const en = bundle(slug, "en");
  const cc = en.catalog_card || {};
  const seo = en.seo || {};
  const stops = en.itineraryStops || [];
  const schedule = stops.map((s) => ({ time: s.time, title: s.name, description: s.category || "" }));
  const galleryImages = (en.galleryItems || []).slice(0, 5).map((g) => g.src).filter(Boolean);

  out += `-- ---------------------------------------------------------------------------\n`;
  out += `-- ${slug}\n`;
  out += `-- ---------------------------------------------------------------------------\n`;
  out += `UPDATE public.tours SET\n`;
  out += `  title = ${q(cc.title || "")},\n`;
  out += `  subtitle = ${q(cc.subtitle || "")},\n`;
  out += `  description = ${q(cc.shortCardDescription || "")},\n`;
  out += `  highlight = ${q(cc.subtitle || "")},\n`;
  if (galleryImages.length) {
    out += `  image_url = ${q(galleryImages[0])},\n`;
    out += `  gallery_images = ${jsonb(galleryImages)},\n`;
  }
  out += `  duration = ${q(cc.duration || "")},\n`;
  out += `  badges = ${jsonb(cc.badges || [])},\n`;
  out += `  schedule = ${jsonb(schedule)},\n`;
  out += `  seo_title = ${q(seo.pageTitle || "")},\n`;
  out += `  meta_description = ${q(seo.metaDescription || "")},\n`;
  out += `  updated_at = NOW()\n`;
  out += `WHERE slug = ${q(slug)};\n\n`;

  for (const loc of LOCALES) {
    const b = loc === "en" ? en : bundle(slug, loc);
    const lcc = b.catalog_card || {};
    const lseo = b.seo || {};
    out += `UPDATE public.tour_product_pages SET\n`;
    out += `  title = ${q(lcc.title || cc.title || "")},\n`;
    out += `  subtitle = ${q(lcc.subtitle || "")},\n`;
    out += `  region_label = ${q(lcc.region || "")},\n`;
    out += `  duration_label = ${q(lcc.duration || "")},\n`;
    out += `  stops_count = ${num(lcc.stopsCount ?? 9)},\n`;
    out += `  badges = ${textArray(lcc.badges || [])},\n`;
    out += `  hero_image_url = ${q(b.hero?.imageUrl || lcc.heroImage || "")},\n`;
    out += `  thumbnail_url = ${q(lcc.thumbnail || lcc.heroImage || "")},\n`;
    out += `  card_short_description = ${q(lcc.shortCardDescription || "")},\n`;
    out += `  seo_title = ${q(lseo.pageTitle || "")},\n`;
    out += `  meta_description = ${q(lseo.metaDescription || "")},\n`;
    out += `  headline_line_1 = ${q(b.headlineLine1 || "")},\n`;
    out += `  headline_line_2 = ${q(b.headlineLine2 || "")},\n`;
    out += `  detail_payload = ${jsonb(b)},\n`;
    out += `  updated_at = NOW()\n`;
    out += `WHERE slug = ${q(slug)} AND locale = ${q(loc)};\n\n`;
  }
}

out += `COMMIT;\n\n`;
out += `-- Verify — the two join tiers must agree on the course and the clock:\n`;
out += `--   SELECT slug, duration, jsonb_array_length(schedule) AS entries,\n`;
out += `--          schedule->0->>'time' AS first, schedule->11->>'time' AS last\n`;
out += `--     FROM public.tours\n`;
out += `--    WHERE slug IN (${q(JOIN_BUS)}, ${q(SMALL)});\n`;
out += `--   -- expect 12 entries, "≈ 09:00" → "≈ 17:00" on both\n`;
out += `--\n`;
out += `--   SELECT slug, locale, stops_count, duration_label\n`;
out += `--     FROM public.tour_product_pages\n`;
out += `--    WHERE slug IN (${q(JOIN_BUS)}, ${q(SMALL)}, ${q(PRIVATE)})\n`;
out += `--    ORDER BY slug, locale;   -- expect stops_count = 9 on the two join tiers\n`;
out += `--\n`;
out += `--   -- no stale claim survived into the rendered payload:\n`;
out += `--   SELECT slug, locale FROM public.tour_product_pages\n`;
out += `--    WHERE slug IN (${q(JOIN_BUS)}, ${q(SMALL)})\n`;
out += `--      AND locale IN ('en','ko','ja','zh','zh-TW','es')\n`;
out += `--      AND detail_payload::text ~ '(08:30|19:15|9-hour)';   -- expect 0 rows\n`;

const target = path.join(ROOT, "supabase/pending-db-apply/2026-08-05-12-busan-cruise-course-followups.sql");
writeFileSync(target, out, "utf8");
console.log("wrote", target);
