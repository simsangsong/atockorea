#!/usr/bin/env node
/**
 * Generates the idempotent DB seed SQL for the NEW product
 * busan-small-group-yonggungsa-skycapsule-gamcheon-tour (owner instruction
 * 2026-08-04), from the built static bundles.
 *
 *   1) public.tours              ON CONFLICT (slug)
 *   2) public.tour_product_pages ON CONFLICT (slug, locale) — 6 locales
 *   3) public.tour_product_offers — TWO offers: default = Sky Capsule ticket
 *      EXCLUDED (USD 49), plus ticket INCLUDED (USD 64, 2-per-capsule basis).
 *      Insert-if-absent by (page, label-role) so re-runs don't duplicate.
 *
 * Price seeded pending owner review. After applying, sync the recommender:
 *   node scripts/import-match-v18.mjs --single busan-small-group-yonggungsa-skycapsule-gamcheon-tour
 *
 * Output: supabase/pending-db-apply/2026-08-04-03-busan-smallgroup-new-product.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "busan-small-group-yonggungsa-skycapsule-gamcheon-tour";
const BUNDLE_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const bundle = (loc) =>
  JSON.parse(readFileSync(path.join(BUNDLE_DIR, `${SLUG}.${loc}.json`), "utf8"));
const en = bundle("en");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

const PRICE_USD = Number(en.price.salePriceUsd); // 49 — Sky Capsule ticket excluded
const PRICE_TICKET_USD = 64; // Sky Capsule ticket included (2-per-capsule basis)

const schedule = en.itineraryStops.map((s) => ({
  time: s.time,
  title: s.name,
  description: s.category || "",
}));

const cc = en.catalog_card;
const seo = en.seo;
const HERO_ABS = `https://www.atockorea.com${cc.heroImage}`;
const galleryImages = [
  HERO_ABS,
  "https://www.atockorea.com/images/tours/cheongsapo-blue-line/cheongsapo-sky-capsule-interior.webp",
  "https://www.atockorea.com/images/tours/gamcheon-culture-village/gamcheon-panorama.webp",
];

let out = "";
out += `-- =============================================================================\n`;
out += `-- ${SLUG} — NEW small-group product (tour_product v2)\n`;
out += `-- =============================================================================\n`;
out += `-- Generated: 2026-08-04 (pending DB apply — this session has no DB access)\n`;
out += `-- Course: Haedong Yonggungsa → Cheongsapo Daritdol Observatory → Blueline Sky\n`;
out += `--         Capsule (ticket optional at booking) → lunch → Gamcheon Culture\n`;
out += `--         Village → Dakbatgol Mural Village & wish-stairs monorail.\n`;
out += `-- Price: USD ${PRICE_USD} base (Sky Capsule ticket EXCLUDED) + USD ${PRICE_TICKET_USD} ticket-included\n`;
out += `--        offer (2-per-capsule basis). ⚠ Seeded pending owner review.\n`;
out += `-- Script: scripts/gen-busan-smallgroup-sql-2026-08.mjs\n`;
out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);\n`;
out += `--             offers insert-if-absent per label role.\n`;
out += `-- AFTER APPLYING: node scripts/import-match-v18.mjs --single ${SLUG}\n`;
out += `-- Web: /tour-product/${SLUG}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

// ---- 1) tours -------------------------------------------------------------
out += `-- 1) tours — booking + /tour/[id] checkout\n`;
out += `INSERT INTO public.tours (\n`;
out += `  title, slug, city, tag, subtitle, description, highlight,\n`;
out += `  price, original_price, price_currency, price_type, image_url, gallery_images,\n`;
out += `  duration, difficulty, group_size, lunch_included, ticket_included,\n`;
out += `  pickup_info, notes, badges, highlights, includes, excludes,\n`;
out += `  schedule, itinerary_details, faqs,\n`;
out += `  rating, review_count, pickup_points_count, dropoff_points_count,\n`;
out += `  is_active, is_featured, translations, seo_title, meta_description\n`;
out += `) VALUES (\n`;
out += `  ${q(cc.title)},\n`;
out += `  ${q(SLUG)},\n`;
out += `  'Busan',\n`;
out += `  ${q("Small group · Busan coast & villages")},\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${q(cc.shortCardDescription)},\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${PRICE_USD.toFixed(2)},\n`;
out += `  NULL,\n`;
out += `  'USD',\n`;
out += `  'person',\n`;
out += `  ${q(galleryImages[0])},\n`;
out += `  ${jsonb(galleryImages)},\n`;
out += `  '10 hours',\n`;
out += `  'Moderate',\n`;
out += `  'Small group',\n`;
out += `  FALSE,\n`;
out += `  FALSE,\n`;
out += `  ${q("Pickup at three central Busan stations (Seomyeon 08:30 / Busan Station 08:50 / Haeundae 09:30) — choose at booking.")},\n`;
out += `  ${q(
  "Sky Capsule ticket is optional — choose the ticket-included option at booking and capsules are pre-reserved (2-per-capsule basis); otherwise walk the free Green Railway boardwalk or ride the coach to Mipo. Capsule and monorail pause only in high wind; the route runs rain or shine.",
)},\n`;
out += `  ${jsonb(cc.badges || [])},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  ${jsonb(schedule)},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  0,\n`;
out += `  0,\n`;
out += `  3,\n`;
out += `  4,\n`;
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
].map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n");
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
  out += `  ${q(lcc.title || cc.title)},\n`;
  out += `  ${q(lcc.subtitle || "")},\n`;
  out += `  ${q(lcc.region || "Busan")},\n`;
  out += `  ${q(lcc.duration || "≈ 10 hours")},\n`;
  out += `  ${num(lcc.stopsCount || 8)},\n`;
  out += `  0,\n`;
  out += `  0,\n`;
  out += `  ${jsonb(lcc.badges || cc.badges || [])},\n`;
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
  ].map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n");
  out += `,\n  updated_at = NOW();\n\n`;
}

// ---- 3) tour_product_offers (two offers) ----------------------------------
out += `-- 3) tour_product_offers — base (ticket excluded, default) + ticket-included\n`;
out += `INSERT INTO public.tour_product_offers (\n`;
out += `  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default\n`;
out += `)\n`;
out += `SELECT p.id, 'Sky Capsule ticket excluded (base)', ${PRICE_USD * 100}, 'USD', NULL, TRUE, TRUE\n`;
out += `FROM public.tour_product_pages p\n`;
out += `WHERE p.slug = ${q(SLUG)} AND p.locale = 'en'\n`;
out += `  AND NOT EXISTS (\n`;
out += `    SELECT 1 FROM public.tour_product_offers o WHERE o.tour_product_page_id = p.id AND o.is_default\n`;
out += `  );\n\n`;
out += `INSERT INTO public.tour_product_offers (\n`;
out += `  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default\n`;
out += `)\n`;
out += `SELECT p.id, 'Sky Capsule ticket included (2-per-capsule basis)', ${PRICE_TICKET_USD * 100}, 'USD', NULL, TRUE, FALSE\n`;
out += `FROM public.tour_product_pages p\n`;
out += `WHERE p.slug = ${q(SLUG)} AND p.locale = 'en'\n`;
out += `  AND NOT EXISTS (\n`;
out += `    SELECT 1 FROM public.tour_product_offers o\n`;
out += `    WHERE o.tour_product_page_id = p.id AND o.label = 'Sky Capsule ticket included (2-per-capsule basis)'\n`;
out += `  );\n\n`;

out += `COMMIT;\n\n`;
out += `-- Verify: SELECT slug, price, is_active FROM public.tours WHERE slug = ${q(SLUG)};\n`;
out += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;
out += `-- Verify: SELECT label, amount_minor, is_default FROM public.tour_product_offers o\n`;
out += `--   JOIN public.tour_product_pages p ON p.id = o.tour_product_page_id WHERE p.slug = ${q(SLUG)};\n`;

const target = path.join(ROOT, "supabase/pending-db-apply/2026-08-04-03-busan-smallgroup-new-product.sql");
writeFileSync(target, out, "utf8");
console.log("wrote", target);
