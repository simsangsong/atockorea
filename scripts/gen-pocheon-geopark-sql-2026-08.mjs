#!/usr/bin/env node
/**
 * Generates the idempotent DB-sync SQL for the 2026-08-04 Pocheon course
 * revision (Herb Island → Jaein Falls + local lunch; new pickup/drop-off).
 *
 *   05  tours (copy/schedule/pickup) + tour_product_pages × 6 content locales
 *   06  tour_product_pages × de/fr/it/ru, INSERT-only staging
 *
 * Price is read from the bundle and NOT changed — the pre-existing gap between
 * the bundle price (USD 54) and the catalog override (listPriceUsd 49) is left
 * exactly as found; reconciling it is an owner decision, not a side effect of
 * a course change.
 *
 * After applying:
 *   node scripts/import-match-v18.mjs --single pocheon-sanjeong-lake-herb-island-art-valley
 * (the recommender's full_document and the new jaein_falls POI both need it)
 *
 * Output: supabase/pending-db-apply/2026-08-04-0{5,6}-*.sql
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "pocheon-sanjeong-lake-herb-island-art-valley";
const BUNDLE_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const CONTENT_LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const EXT_LOCALES = ["de", "fr", "it", "ru"];

const bundle = (loc) =>
  JSON.parse(readFileSync(path.join(BUNDLE_DIR, `${SLUG}.${loc}.json`), "utf8"));
const en = bundle("en");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
// tour_product_pages.badges is text[] — only tours.badges is jsonb. Feeding a
// JSON array into it fails the whole transaction with "column badges is of type
// text[] but expression is of type jsonb". This bit the 2026-06-24 batch and then
// bit the 2026-08-04 batch again because only the applied SQL was patched, never
// the generator. Gate: __tests__/audit/pendingSqlColumnTypes.test.ts.
const textArray = (v) =>
  Array.isArray(v) && v.length ? `ARRAY[${v.map(q).join(", ")}]::text[]` : `${q("{}")}::text[]`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

const PRICE_USD = Number(en.price.salePriceUsd);
if (!Number.isFinite(PRICE_USD)) throw new Error("bundle price missing");

const cc = en.catalog_card;
const seo = en.seo;
const schedule = en.itineraryStops.map((s) => ({
  time: s.time,
  title: s.name,
  description: s.category || "",
}));
const pickupInfo = en.pickup_dropoff.meeting_points
  .map((m) => `${m.name} (${m.time})`)
  .join(" / ");
const dropoffInfo = en.pickup_dropoff.dropoff_points
  .map((m) => `${m.name} (${m.time})`)
  .join(" / ");

const pagesBlock = (loc, { insertOnly }) => {
  const b = loc === "en" ? en : bundle(loc);
  const lcc = b.catalog_card || {};
  const lseo = b.seo || {};
  let out = "";
  out += `INSERT INTO public.tour_product_pages (\n`;
  out += `  slug, locale, product_id, is_published, sort_order, tour_id,\n`;
  out += `  title, subtitle, region_label, duration_label, stops_count,\n`;
  out += `  badges, hero_image_url, thumbnail_url,\n`;
  out += `  card_short_description, seo_title, meta_description,\n`;
  out += `  headline_line_1, headline_line_2,\n`;
  out += `  price_amount_label, price_currency, price_per, detail_payload\n`;
  out += `) VALUES (\n`;
  out += `  ${q(SLUG)},\n`;
  out += `  ${q(loc)},\n`;
  out += `  ${q(SLUG)},\n`;
  out += `  TRUE,\n`;
  out += `  1,\n`;
  out += `  (SELECT id FROM public.tours WHERE slug = ${q(SLUG)} LIMIT 1),\n`;
  out += `  ${q(lcc.title || cc.title)},\n`;
  out += `  ${q(lcc.subtitle || "")},\n`;
  out += `  ${q(lcc.region || "Pocheon & Yeoncheon (Seoul Day Trip)")},\n`;
  out += `  ${q(lcc.duration || "10 hours")},\n`;
  out += `  ${num(lcc.stopsCount || 4)},\n`;
  out += `  ${textArray(lcc.badges || cc.badges || [])},\n`;
  out += `  ${q(b.hero?.imageUrl || lcc.heroImage || "")},\n`;
  out += `  ${q(lcc.thumbnail || lcc.heroImage || "")},\n`;
  out += `  ${q(lcc.shortCardDescription || "")},\n`;
  out += `  ${q(lseo.pageTitle || "")},\n`;
  out += `  ${q(lseo.metaDescription || "")},\n`;
  out += `  ${q(b.headlineLine1 || "")},\n`;
  out += `  ${q(b.headlineLine2 || "")},\n`;
  out += `  ${q(String(PRICE_USD))},\n`;
  out += `  'USD',\n`;
  out += `  'person',\n`;
  out += `  ${jsonb(b)}\n`;
  out += `)\n`;
  if (insertOnly) {
    out += `ON CONFLICT (slug, locale) DO NOTHING;\n\n`;
    return out;
  }
  out += `ON CONFLICT (slug, locale) DO UPDATE SET\n`;
  out += [
    "product_id", "is_published", "sort_order", "tour_id", "title", "subtitle",
    "region_label", "duration_label", "stops_count",
    "badges", "hero_image_url", "thumbnail_url", "card_short_description",
    "seo_title", "meta_description", "headline_line_1", "headline_line_2",
    "price_amount_label", "price_currency", "price_per", "detail_payload",
  ].map((c) => `  ${c} = EXCLUDED.${c}`).join(",\n");
  out += `,\n  updated_at = NOW();\n\n`;
  return out;
};

// ---------------------------------------------------------------------------
// File 05 — tours + the six content locales
// ---------------------------------------------------------------------------
let out = "";
out += `-- =============================================================================\n`;
out += `-- ${SLUG} — COURSE REVISION (Hantangang geopark)\n`;
out += `-- =============================================================================\n`;
out += `-- Generated: 2026-08-04 (pending DB apply — this session has no DB access)\n`;
out += `-- Course: Sanjeong Lake → Idong-galbi lunch → Jaein Falls (Yeoncheon) →\n`;
out += `--         Pocheon Art Valley. Herb Island is dropped. Jaein Falls and Art\n`;
out += `--         Valley are both Hantangang UNESCO Global Geopark geosites.\n`;
out += `-- Pickup (owner-supplied): ${pickupInfo}\n`;
out += `-- Drop-off:                ${dropoffInfo}\n`;
out += `-- Price: UNCHANGED at USD ${PRICE_USD} (bundle). NOTE: the catalog override in\n`;
out += `--   staticTourProductRegistry.ts still reads listPriceUsd 49 / compareAt 62 —\n`;
out += `--   a pre-existing mismatch, deliberately left alone. Owner decision.\n`;
out += `-- 🔴 SLUG UNCHANGED on purpose: active Klook SKU, the slug is the live URL and\n`;
out += `--   the OTA linkage, so it still carries the legacy "herb-island" token.\n`;
out += `-- Script: scripts/gen-pocheon-geopark-sql-2026-08.mjs\n`;
out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale).\n`;
out += `-- AFTER APPLYING: node scripts/import-match-v18.mjs --single ${SLUG}\n`;
out += `--   (refreshes full_document AND imports the new jaein_falls POI into match_pois)\n`;
out += `-- Web: /tour-product/${SLUG}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

out += `-- 1) tours — booking + /tour/[id] checkout (copy, schedule, pickup refresh)\n`;
out += `UPDATE public.tours SET\n`;
out += `  title = ${q(cc.title)},\n`;
out += `  subtitle = ${q(cc.subtitle)},\n`;
out += `  description = ${q(cc.shortCardDescription)},\n`;
out += `  highlight = ${q(cc.subtitle)},\n`;
out += `  badges = ${jsonb(cc.badges || [])},\n`;
out += `  schedule = ${jsonb(schedule)},\n`;
out += `  pickup_info = ${q(`Meeting points: ${pickupInfo}. Please arrive 10 minutes before your departure time. Drop-off: ${dropoffInfo}.`)},\n`;
out += `  notes = ${q(
  "Jaein Falls is an open-air gorge with no lighting and its deck sections can close during heavy summer rain; if that happens the other stops are extended rather than the day cancelled. Pocheon Art Valley admission and monorail are ticketed separately and are not included. Lunch is not included.",
)},\n`;
out += `  pickup_points_count = ${en.pickup_dropoff.meeting_points.length},\n`;
out += `  dropoff_points_count = ${en.pickup_dropoff.dropoff_points.length},\n`;
out += `  seo_title = ${q(seo.pageTitle)},\n`;
out += `  meta_description = ${q(seo.metaDescription)},\n`;
out += `  updated_at = NOW()\n`;
out += `WHERE slug = ${q(SLUG)};\n\n`;

out += `-- 2) tour_product_pages — 6 content locales (full detail_payload refresh)\n`;
for (const loc of CONTENT_LOCALES) out += pagesBlock(loc, { insertOnly: false });

out += `COMMIT;\n\n`;
out += `-- Verify: SELECT slug, is_active, schedule->0->>'title' AS first_stop, pickup_points_count FROM public.tours WHERE slug = ${q(SLUG)};\n`;
out += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;

const t5 = path.join(ROOT, "supabase/pending-db-apply/2026-08-04-05-pocheon-geopark-recourse.sql");
writeFileSync(t5, out, "utf8");
console.log("wrote", t5);

// ---------------------------------------------------------------------------
// File 06 — staged de/fr/it/ru
// ---------------------------------------------------------------------------
const present = EXT_LOCALES.filter((loc) =>
  existsSync(path.join(BUNDLE_DIR, `${SLUG}.${loc}.json`)),
);
if (present.length) {
  let o6 = "";
  o6 += `-- =============================================================================\n`;
  o6 += `-- ${SLUG} — staged de/fr/it/ru pages\n`;
  o6 += `-- =============================================================================\n`;
  o6 += `-- Generated: 2026-08-04. INSERT-only staging per the i18n expansion track:\n`;
  o6 += `-- guests on de/fr/it/ru keep seeing EN until the app-side fallback gate\n`;
  o6 += `-- (TOUR_PRODUCT_FALLBACK_URL_LOCALES in tourProductPageBody.tsx) is opened —\n`;
  o6 += `-- a separate human decision. Apply AFTER 2026-08-04-05.\n`;
  o6 += `-- Script: scripts/gen-pocheon-geopark-sql-2026-08.mjs\n`;
  o6 += `-- =============================================================================\n\n`;
  o6 += `BEGIN;\n\n`;
  for (const loc of present) o6 += pagesBlock(loc, { insertOnly: true });
  o6 += `COMMIT;\n\n`;
  o6 += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;
  const t6 = path.join(
    ROOT,
    "supabase/pending-db-apply/2026-08-04-06-pocheon-geopark-staged-locales.sql",
  );
  writeFileSync(t6, o6, "utf8");
  console.log("wrote", t6, `(${present.join(", ")})`);
}
