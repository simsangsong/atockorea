#!/usr/bin/env node
/**
 * Generates the idempotent DB-sync SQL for the 2026-08-04 course reorder of
 * jeju-eastern-unesco-spots-day-tour (Manjanggul → Seongeup → Lunch → Seongsan
 * → Haenyeo performance → Hamdeok), from the transformed static bundles.
 *
 *   1) public.tours              ON CONFLICT (slug)          — schedule/copy/flags
 *   2) public.tour_product_pages ON CONFLICT (slug, locale)  — 6 locales, full detail_payload
 *
 * Price is read from the EN bundle (not hardcoded — the Klook prep migration
 * moved it after the older gen script was written). tour_product_offers is NOT
 * touched (price unchanged). match_tours is refreshed separately with
 * `node scripts/import-match-v18.mjs --single jeju-eastern-unesco-spots-day-tour`
 * (needs service-role env), which rebuilds full_document from these bundles.
 *
 * Output: supabase/pending-db-apply/2026-08-04-02-jeju-eastern-unesco-reorder.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "jeju-eastern-unesco-spots-day-tour";
const BUNDLE_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
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
const ORIG_USD = Number(en.price.originalPriceUsd);
if (!Number.isFinite(PRICE_USD) || !Number.isFinite(ORIG_USD)) {
  throw new Error("price missing in EN bundle");
}

const schedule = en.itineraryStops.map((s) => ({
  time: s.time,
  title: s.name,
  description: s.category || "",
}));

const cc = en.catalog_card;
const seo = en.seo;
const galleryImages = [
  "https://www.visitjeju.net/image/main/2024/manjanggul.jpg",
  "https://www.visitjeju.net/image/main/2024/seongsan-ilchulbong.jpg",
  "https://images.unsplash.com/photo-1601471569526-2c7d5e1b7e5f?w=1200",
  "https://images.unsplash.com/photo-1502175353174-a7a44e84da10?w=1200",
  "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=1200",
];

let out = "";
out += `-- =============================================================================\n`;
out += `-- ${SLUG} — COURSE REORDER (cave-first eastern loop)\n`;
out += `-- =============================================================================\n`;
out += `-- Generated: 2026-08-04 (pending DB apply — this session has no DB access)\n`;
out += `-- Purpose: sync DB to the reordered itinerary (Manjanggul at opening → Seongeup\n`;
out += `--          → lunch → Seongsan → haenyeo performance → Hamdeok Beach finale).\n`;
out += `--          Same stop set as before — pure reorder + copy refresh. Price unchanged\n`;
out += `--          (USD ${PRICE_USD} / compare-at ${ORIG_USD}; offers untouched).\n`;
out += `-- Script: scripts/gen-jeju-east-reorder-sql-2026-08.mjs\n`;
out += `-- Source: components/product-tour-static/${SLUG}/${SLUG}.<locale>.json\n`;
out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale).\n`;
out += `-- AFTER APPLYING: refresh the recommender row (full_document still holds the old\n`;
out += `--   course) with:  node scripts/import-match-v18.mjs --single ${SLUG}\n`;
out += `-- Web: /tour-product/${SLUG}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

// ---- 1) tours -------------------------------------------------------------
out += `-- 1) tours — booking + /tour/[id] checkout (copy + schedule refresh)\n`;
out += `INSERT INTO public.tours (\n`;
out += `  title, slug, city, tag, subtitle, description, highlight,\n`;
out += `  price, original_price, price_currency, price_type, image_url, gallery_images,\n`;
out += `  duration, difficulty, group_size, lunch_included, ticket_included,\n`;
out += `  pickup_info, notes, badges, highlights, includes, excludes,\n`;
out += `  schedule, itinerary_details, faqs,\n`;
out += `  rating, review_count, pickup_points_count, dropoff_points_count,\n`;
out += `  is_active, is_featured, translations, seo_title, meta_description\n`;
out += `) VALUES (\n`;
out += `  ${q("Jeju Eastern UNESCO Spots Day Tour")},\n`;
out += `  ${q(SLUG)},\n`;
out += `  'Jeju',\n`;
out += `  ${q("Small group · Eastern Jeju")},\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${q(cc.shortCardDescription)},\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${PRICE_USD.toFixed(2)},\n`;
out += `  ${ORIG_USD.toFixed(2)},\n`;
out += `  'USD',\n`;
out += `  'person',\n`;
out += `  ${q(galleryImages[0])},\n`;
out += `  ${jsonb(galleryImages)},\n`;
out += `  '9 hours',\n`;
out += `  'Moderate',\n`;
out += `  'Small group',\n`;
out += `  FALSE,\n`;
out += `  TRUE,\n`;
out += `  ${q("Pickup confirmed after booking.")},\n`;
out += `  ${q(
  "Weather and operational conditions may shift the stop order or duration. The haenyeo diving performance is open-air and weather-dependent; if cancelled, the Haenyeo Museum is visited instead. Manjanggul may close for maintenance — a nearby lava tube (Micheon Cave) is the fallback.",
)},\n`;
out += `  ${jsonb(cc.badges || [])},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  ${jsonb(schedule)},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  4.9,\n`;
out += `  1148,\n`;
out += `  4,\n`;
out += `  5,\n`;
out += `  TRUE,\n`;
out += `  FALSE,\n`;
out += `  '{}'::jsonb,\n`;
out += `  ${q(seo.pageTitle)},\n`;
out += `  ${q(seo.metaDescription)}\n`;
out += `)\n`;
out += `ON CONFLICT (slug) DO UPDATE SET\n`;
out += [
  "title", "city", "tag", "subtitle", "description", "highlight",
  "price", "original_price", "price_currency", "price_type", "image_url", "gallery_images",
  "duration", "difficulty", "group_size", "lunch_included", "ticket_included",
  "pickup_info", "notes", "badges", "schedule",
  "rating", "review_count", "pickup_points_count", "dropoff_points_count",
  "is_active", "seo_title", "meta_description",
].map((c) => `  ${c} = EXCLUDED.${c}`).join(",\n");
out += `,\n  updated_at = NOW();\n\n`;

// ---- 2) tour_product_pages (6 locales) -----------------------------------
out += `-- 2) tour_product_pages — marketing detail + detail_payload (6 locales)\n`;
for (const loc of LOCALES) {
  const b = loc === "en" ? en : bundle(loc);
  const lcc = b.catalog_card || {};
  const lseo = b.seo || {};
  out += `INSERT INTO public.tour_product_pages (\n`;
  out += `  slug, locale, product_id, is_published, sort_order, tour_id,\n`;
  out += `  title, subtitle, region_label, duration_label, stops_count,\n`;
  out += `  rating_avg, review_count, badges, hero_image_url, thumbnail_url,\n`;
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
  out += `  ${q(lcc.title || "Jeju Eastern UNESCO Spots Day Tour")},\n`;
  out += `  ${q(lcc.subtitle || "")},\n`;
  out += `  ${q(lcc.region || "Eastern Jeju")},\n`;
  out += `  ${q(lcc.duration || "9 hours")},\n`;
  out += `  ${num(lcc.stopsCount || 8)},\n`;
  out += `  4.9,\n`;
  out += `  1148,\n`;
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
  out += `ON CONFLICT (slug, locale) DO UPDATE SET\n`;
  out += [
    "product_id", "is_published", "sort_order", "tour_id", "title", "subtitle",
    "region_label", "duration_label", "stops_count",
    "badges", "hero_image_url", "thumbnail_url", "card_short_description",
    "seo_title", "meta_description", "headline_line_1", "headline_line_2",
    "price_amount_label", "price_currency", "price_per", "detail_payload",
  ].map((c) => `  ${c} = EXCLUDED.${c}`).join(",\n");
  out += `,\n  updated_at = NOW();\n\n`;
}

out += `COMMIT;\n\n`;
out += `-- Verify: SELECT slug, price, is_active, schedule->0->>'title' AS first_stop FROM public.tours WHERE slug = ${q(SLUG)};\n`;
out += `-- Verify: SELECT locale, is_published, subtitle FROM public.tour_product_pages WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;

const target = path.join(ROOT, "supabase/pending-db-apply/2026-08-04-02-jeju-eastern-unesco-reorder.sql");
writeFileSync(target, out, "utf8");
console.log("wrote", target);
