#!/usr/bin/env node
/**
 * Generates the idempotent DB-sync SQL for the 2026-08-04 course revision of
 * from-busan-gyeongju-ancient-capital-day-tour (owner instruction), from the
 * transformed static bundles.
 *
 *   1) public.tours              ON CONFLICT (slug)          — copy/schedule refresh
 *   2) public.tour_product_pages ON CONFLICT (slug, locale)  — 6 locales, detail_payload
 *
 * 🔴 VISIBILITY IS DELIBERATELY NOT TOUCHED. This slug is currently hidden from
 * every consumer surface — it sits in CONSUMER_BLOCKED_TOUR_SLUGS (narrowed to
 * 12 SKUs for the Klook listing, 2026-06-29) and its DB flags were set with it.
 * So `is_active` / `is_featured` / `is_published` are EXCLUDED from both upserts:
 * applying this SQL refreshes what the product SAYS without deciding whether it
 * is on sale. Re-opening is an owner decision — the (commented) block at the end
 * of the generated file is the whole of it, and it pairs with removing the slug
 * from lib/tour-consumer-visibility.ts.
 *
 * Price unchanged (USD 39 / compare-at 50), so tour_product_offers is untouched.
 * match_tours is refreshed separately with
 *   node scripts/import-match-v18.mjs --single from-busan-gyeongju-ancient-capital-day-tour
 * (needs service-role env), which rebuilds full_document from these bundles.
 *
 * Output: supabase/pending-db-apply/2026-08-04-04-gyeongju-recourse.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "from-busan-gyeongju-ancient-capital-day-tour";
const BUNDLE_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const bundle = (loc) =>
  JSON.parse(readFileSync(path.join(BUNDLE_DIR, `${SLUG}.${loc}.json`), "utf8"));
const en = bundle("en");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

const PRICE_USD = Number(en.price.salePriceUsd);
const ORIG_USD = Number(en.price.originalPriceUsd);
if (!Number.isFinite(PRICE_USD) || !Number.isFinite(ORIG_USD)) {
  throw new Error("price missing in EN bundle");
}

// Guard: never generate SQL from an un-transformed bundle.
const stops = en.itineraryStops;
if (stops.length !== 8) throw new Error(`expected 8 stops, got ${stops.length}`);
const key = (i) => (stops[i]._poi_meta || {}).poi_key;
if (key(4) !== "gyochon_hanok_village" || key(5) !== "daereungwon_tomb_complex" || key(6) !== "gyeongju_national_museum") {
  throw new Error("EN bundle is not on the new course — run scripts/gyeongju-recourse-2026-08.mjs first");
}
for (const loc of LOCALES) {
  const b = JSON.stringify(bundle(loc));
  for (const stale of ["10.5", "18:50"]) {
    if (b.replace(/"_publication":\{[\s\S]*?\}\}/, "").includes(stale)) {
      throw new Error(`[${loc}] bundle still carries the stale day length "${stale}"`);
    }
  }
}

const schedule = stops.map((s) => ({ time: s.time, title: s.name, description: s.category || "" }));
const cc = en.catalog_card;
const seo = en.seo;
const galleryImages = (en.galleryItems || []).slice(0, 5).map((g) => g.src).filter(Boolean);
if (galleryImages.length === 0) throw new Error("no gallery images in EN bundle");

let out = "";
out += `-- =============================================================================\n`;
out += `-- ${SLUG} — COURSE REVISION (owner instruction 2026-08-04)\n`;
out += `-- =============================================================================\n`;
out += `-- Generated: 2026-08-04 (pending DB apply — this session has no DB access)\n`;
out += `-- New course: Ahopsan Bamboo Forest → Bulguksa (UNESCO) → lunch\n`;
out += `--   → Gyochon Hanok Village + Choi Family House + Woljeonggyo  (one stop, walked)\n`;
out += `--   → Daereungwon + Hwangnidan-gil                             (one stop, walked)\n`;
out += `--   → Gyeongju National Museum, or Donggung & Wolji by night in Nov–Feb\n`;
out += `-- Pickup/drop-off restated as three SUBWAY exits (Busan Stn Exit 4 = subway,\n`;
out += `--   NOT the KTX rail terminal; Seomyeon Exit 4; Haeundae Exit 5).\n`;
out += `-- Day length ${en.catalog_card.duration} (was 10.5 hours) — last drop ≈19:50.\n`;
out += `-- Price unchanged (USD ${PRICE_USD} / compare-at ${ORIG_USD}); offers untouched.\n`;
out += `--\n`;
out += `-- 🔴 VISIBILITY NOT CHANGED BY THIS FILE. The slug is hidden from consumer\n`;
out += `--    surfaces (CONSUMER_BLOCKED_TOUR_SLUGS, Klook 12-SKU narrowing 2026-06-29).\n`;
out += `--    is_active / is_featured / is_published are excluded from the upserts below,\n`;
out += `--    so this refreshes WHAT THE PRODUCT SAYS without putting it on sale.\n`;
out += `--    Re-opening is an owner decision — see the commented block at the end.\n`;
out += `--\n`;
out += `-- Script: scripts/gen-gyeongju-recourse-sql-2026-08.mjs\n`;
out += `-- Source: components/product-tour-static/${SLUG}/${SLUG}.<locale>.json\n`;
out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale).\n`;
out += `-- AFTER APPLYING: refresh the recommender (full_document still holds the old course):\n`;
out += `--   node scripts/import-match-v18.mjs --single ${SLUG}\n`;
out += `-- Web: /tour-product/${SLUG}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

out += `-- 1) tours — copy + schedule refresh (visibility flags deliberately untouched)\n`;
out += `UPDATE public.tours SET\n`;
out += `  title = ${q(cc.title)},\n`;
out += `  subtitle = ${q(cc.subtitle)},\n`;
out += `  description = ${q(cc.shortCardDescription)},\n`;
out += `  highlight = ${q(cc.subtitle)},\n`;
out += `  image_url = ${q(galleryImages[0])},\n`;
out += `  gallery_images = ${jsonb(galleryImages)},\n`;
out += `  duration = ${q(cc.duration)},\n`;
out += `  badges = ${jsonb(cc.badges || [])},\n`;
out += `  schedule = ${jsonb(schedule)},\n`;
out += `  pickup_points_count = 3,\n`;
out += `  dropoff_points_count = 3,\n`;
out += `  seo_title = ${q(seo.pageTitle)},\n`;
out += `  meta_description = ${q(seo.metaDescription)},\n`;
out += `  updated_at = NOW()\n`;
out += `WHERE slug = ${q(SLUG)};\n\n`;

out += `-- 2) tour_product_pages — marketing detail + detail_payload (6 locales)\n`;
out += `--    UPDATE-only for the same reason: an INSERT would have to choose an\n`;
out += `--    is_published value, and that is the owner's call, not this file's.\n`;
for (const loc of LOCALES) {
  const b = loc === "en" ? en : bundle(loc);
  const lcc = b.catalog_card || {};
  const lseo = b.seo || {};
  out += `UPDATE public.tour_product_pages SET\n`;
  out += `  title = ${q(lcc.title || cc.title)},\n`;
  out += `  subtitle = ${q(lcc.subtitle || "")},\n`;
  out += `  region_label = ${q(lcc.region || "")},\n`;
  out += `  duration_label = ${q(lcc.duration || "")},\n`;
  out += `  stops_count = ${num(lcc.stopsCount || 8)},\n`;
  out += `  badges = ${jsonb(lcc.badges || [])},\n`;
  out += `  hero_image_url = ${q(b.hero?.imageUrl || lcc.heroImage || "")},\n`;
  out += `  thumbnail_url = ${q(lcc.thumbnail || lcc.heroImage || "")},\n`;
  out += `  card_short_description = ${q(lcc.shortCardDescription || "")},\n`;
  out += `  seo_title = ${q(lseo.pageTitle || "")},\n`;
  out += `  meta_description = ${q(lseo.metaDescription || "")},\n`;
  out += `  headline_line_1 = ${q(b.headlineLine1 || "")},\n`;
  out += `  headline_line_2 = ${q(b.headlineLine2 || "")},\n`;
  out += `  price_amount_label = ${q(String(PRICE_USD))},\n`;
  out += `  detail_payload = ${jsonb(b)},\n`;
  out += `  updated_at = NOW()\n`;
  out += `WHERE slug = ${q(SLUG)} AND locale = ${q(loc)};\n\n`;
}

out += `COMMIT;\n\n`;
out += `-- Verify: SELECT slug, duration, is_active, schedule->4->>'title' AS fifth_stop\n`;
out += `--           FROM public.tours WHERE slug = ${q(SLUG)};\n`;
out += `-- Verify: SELECT locale, is_published, duration_label FROM public.tour_product_pages\n`;
out += `--           WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;
out += `-- Verify (rows exist — the UPDATEs above are silent no-ops if they do not):\n`;
out += `--   SELECT count(*) FROM public.tour_product_pages WHERE slug = ${q(SLUG)};  -- expect 6\n\n`;
out += `-- =============================================================================\n`;
out += `-- 🔴 OWNER DECISION ONLY — re-open this product for sale.\n`;
out += `-- =============================================================================\n`;
out += `-- The course above is revised but the tour is still hidden. To put it back on\n`;
out += `-- sale, BOTH halves are required (repo + DB), same as the Jeju revision:\n`;
out += `--   repo: remove ${q(SLUG)} from CONSUMER_BLOCKED_TOUR_SLUGS\n`;
out += `--         in lib/tour-consumer-visibility.ts, and deploy\n`;
out += `--   DB:   uncomment and run the statements below\n`;
out += `-- Leaving only one half done makes the catalog and the database disagree.\n`;
out += `--\n`;
out += `-- BEGIN;\n`;
out += `-- UPDATE public.tours SET is_active = TRUE, updated_at = NOW()\n`;
out += `--   WHERE slug = ${q(SLUG)};\n`;
out += `-- UPDATE public.tour_product_pages SET is_published = TRUE, updated_at = NOW()\n`;
out += `--   WHERE slug = ${q(SLUG)};\n`;
out += `-- COMMIT;\n`;
out += `-- Then: node scripts/import-match-v18.mjs --single ${SLUG}\n`;

const target = path.join(ROOT, "supabase/pending-db-apply/2026-08-04-04-gyeongju-recourse.sql");
writeFileSync(target, out, "utf8");
console.log("wrote", target);
