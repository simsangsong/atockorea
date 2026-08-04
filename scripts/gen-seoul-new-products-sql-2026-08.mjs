#!/usr/bin/env node
/**
 * Generate the pending DB SQL for the two Seoul-departure day tours added
 * (owner instruction 2026-08-04), from the built static bundles:
 *
 *   supabase/pending-db-apply/2026-08-04-08-seoul-gapyeong-new-product.sql
 *   supabase/pending-db-apply/2026-08-04-09-seoul-gapyeong-staged-locales.sql
 *   supabase/pending-db-apply/2026-08-04-10-seoul-winter-eobi-new-product.sql
 *   supabase/pending-db-apply/2026-08-04-11-seoul-winter-eobi-staged-locales.sql
 *
 * The numbering starts at 08 because 05/06 belong to the Pocheon re-course and
 * 07 to Gyeongju; filename order is the apply order.
 *
 * Rows come from seoul-new-products-rows-2026-08.mjs, which
 * apply-seoul-new-products-2026-08.mjs also reads — the field mapping lives in
 * one place so the SQL path and the supabase-js path cannot drift.
 *
 * Run: node scripts/gen-seoul-new-products-sql-2026-08.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  ROOT,
  LOCALES,
  PRODUCTS,
  buildRows,
  stagedLocalesPresent,
} from "./seoul-new-products-rows-2026-08.mjs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));
const bool = (v) => (v ? "TRUE" : "FALSE");

const TOUR_COLS = [
  "title", "slug", "city", "tag", "subtitle", "description", "highlight",
  "price", "original_price", "price_currency", "price_type", "image_url", "gallery_images",
  "duration", "difficulty", "group_size", "lunch_included", "ticket_included",
  "pickup_info", "notes", "badges", "highlights", "includes", "excludes",
  "schedule", "itinerary_details", "faqs",
  "rating", "review_count", "pickup_points_count", "dropoff_points_count",
  "is_active", "is_featured", "translations", "seo_title", "meta_description",
];

const TOUR_UPDATE_COLS = [
  "title", "city", "tag", "subtitle", "description", "highlight",
  "price", "original_price", "price_currency", "price_type", "image_url", "gallery_images",
  "duration", "difficulty", "group_size", "lunch_included", "ticket_included",
  "pickup_info", "notes", "badges", "schedule",
  "rating", "review_count", "pickup_points_count", "dropoff_points_count",
  "is_active", "seo_title", "meta_description",
];

const PAGE_UPDATE_COLS = [
  "product_id", "is_published", "sort_order", "tour_id", "title", "subtitle",
  "region_label", "duration_label", "stops_count",
  "badges", "hero_image_url", "thumbnail_url", "card_short_description",
  "seo_title", "meta_description", "headline_line_1", "headline_line_2",
  "price_amount_label", "price_currency", "price_per", "detail_payload",
];

/** SQL literal for one tours column. */
function tourLit(row, col) {
  switch (col) {
    case "price":
      return Number(row.price).toFixed(2);
    case "original_price":
      return row.original_price === null ? "NULL" : Number(row.original_price).toFixed(2);
    case "lunch_included":
    case "ticket_included":
    case "is_active":
    case "is_featured":
      return bool(row[col]);
    case "gallery_images":
    case "badges":
    case "highlights":
    case "includes":
    case "excludes":
    case "schedule":
    case "itinerary_details":
    case "faqs":
    case "translations":
      return jsonb(row[col]);
    case "rating":
    case "review_count":
    case "pickup_points_count":
    case "dropoff_points_count":
      return num(row[col]);
    default:
      return q(row[col]);
  }
}

function pageInsert(cfg, row, conflict) {
  let o = "";
  o += `INSERT INTO public.tour_product_pages (\n`;
  o += `  slug, locale, product_id, is_published, sort_order, tour_id,\n`;
  o += `  title, subtitle, region_label, duration_label, stops_count,\n`;
  o += `  rating_avg, review_count, badges, hero_image_url, thumbnail_url,\n`;
  o += `  card_short_description, seo_title, meta_description,\n`;
  o += `  headline_line_1, headline_line_2,\n`;
  o += `  price_amount_label, price_currency, price_per, detail_payload\n`;
  o += `) VALUES (\n`;
  o += `  ${q(row.slug)},\n`;
  o += `  ${q(row.locale)},\n`;
  o += `  ${q(row.product_id)},\n`;
  o += `  ${bool(row.is_published)},\n`;
  o += `  ${num(row.sort_order)},\n`;
  o += `  (SELECT id FROM public.tours WHERE slug = ${q(cfg.slug)} LIMIT 1),\n`;
  o += `  ${q(row.title)},\n`;
  o += `  ${q(row.subtitle)},\n`;
  o += `  ${q(row.region_label)},\n`;
  o += `  ${q(row.duration_label)},\n`;
  o += `  ${num(row.stops_count)},\n`;
  o += `  ${num(row.rating_avg)},\n`;
  o += `  ${num(row.review_count)},\n`;
  o += `  ${jsonb(row.badges)},\n`;
  o += `  ${q(row.hero_image_url)},\n`;
  o += `  ${q(row.thumbnail_url)},\n`;
  o += `  ${q(row.card_short_description)},\n`;
  o += `  ${q(row.seo_title)},\n`;
  o += `  ${q(row.meta_description)},\n`;
  o += `  ${q(row.headline_line_1)},\n`;
  o += `  ${q(row.headline_line_2)},\n`;
  o += `  ${q(row.price_amount_label)},\n`;
  o += `  ${q(row.price_currency)},\n`;
  o += `  ${q(row.price_per)},\n`;
  o += `  ${jsonb(row.detail_payload)}\n`;
  o += `)\n`;
  if (conflict === "nothing") {
    o += `ON CONFLICT (slug, locale) DO NOTHING;\n\n`;
  } else {
    o += `ON CONFLICT (slug, locale) DO UPDATE SET\n`;
    o += PAGE_UPDATE_COLS.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n");
    o += `,\n  updated_at = NOW();\n\n`;
  }
  return o;
}

function writeProduct(cfg) {
  const rows = buildRows(cfg);
  const priceUsd = rows.priceUsd;

  let out = "";
  out += `-- =============================================================================\n`;
  out += `-- ${cfg.slug} — NEW product (tour_product v2)\n`;
  out += `-- =============================================================================\n`;
  out += `-- Generated: 2026-08-04. Regenerate with:\n`;
  out += `--   node scripts/gen-seoul-new-products-sql-2026-08.mjs\n`;
  for (const line of cfg.header) out += `-- ${line}\n`;
  out += `-- Price: USD ${priceUsd} per person (owner decision 2026-08-04).\n`;
  out += `-- Script: scripts/gen-seoul-new-products-sql-2026-08.mjs\n`;
  out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);\n`;
  out += `--             offer insert-if-absent.\n`;
  out += `-- No psql? node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs\n`;
  out += `-- AFTER APPLYING: node scripts/import-match-v18.mjs --single ${cfg.slug}\n`;
  out += `-- Web: /tour-product/${cfg.slug}\n`;
  out += `-- =============================================================================\n\n`;
  out += `BEGIN;\n\n`;

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
  out += TOUR_COLS.map((col) => `  ${tourLit(rows.tour, col)}`).join(",\n");
  out += `\n)\n`;
  out += `ON CONFLICT (slug) DO UPDATE SET\n`;
  out += TOUR_UPDATE_COLS.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n");
  out += `,\n  updated_at = NOW();\n\n`;

  out += `-- 2) tour_product_pages — marketing detail + detail_payload (6 served locales)\n`;
  for (const row of rows.pages) out += pageInsert(cfg, row, "update");

  out += `-- 3) tour_product_offers — single default offer\n`;
  out += `INSERT INTO public.tour_product_offers (\n`;
  out += `  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default\n`;
  out += `)\n`;
  out += `SELECT p.id, ${q(rows.offer.label)}, ${rows.offer.amount_minor}, 'USD', NULL, TRUE, TRUE\n`;
  out += `FROM public.tour_product_pages p\n`;
  out += `WHERE p.slug = ${q(cfg.slug)} AND p.locale = 'en'\n`;
  out += `  AND NOT EXISTS (\n`;
  out += `    SELECT 1 FROM public.tour_product_offers o WHERE o.tour_product_page_id = p.id AND o.is_default\n`;
  out += `  );\n\n`;

  out += `COMMIT;\n\n`;
  out += `-- Verify: SELECT slug, price, is_active FROM public.tours WHERE slug = ${q(cfg.slug)};\n`;
  out += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(cfg.slug)} ORDER BY locale;\n`;
  out += `-- Verify: SELECT label, amount_minor, is_default FROM public.tour_product_offers o\n`;
  out += `--   JOIN public.tour_product_pages p ON p.id = o.tour_product_page_id WHERE p.slug = ${q(cfg.slug)};\n`;

  const target = path.join(ROOT, "supabase/pending-db-apply", cfg.mainFile);
  writeFileSync(target, out, "utf8");
  console.log("wrote", path.relative(ROOT, target));

  // ---- staged locales -----------------------------------------------------
  const present = stagedLocalesPresent(cfg.slug);
  if (!present.length) {
    console.log(`  · no staged-locale bundles for ${cfg.slug} — staged file not written`);
    return;
  }
  let out2 = "";
  out2 += `-- =============================================================================\n`;
  out2 += `-- ${cfg.slug} — staged de/fr/it/ru pages (10-locale translation)\n`;
  out2 += `-- =============================================================================\n`;
  out2 += `-- Generated: 2026-08-04. INSERT-only staging per the i18n expansion track:\n`;
  out2 += `-- guests on de/fr/it/ru keep seeing EN until the app-side fallback gate\n`;
  out2 += `-- (TOUR_PRODUCT_FALLBACK_URL_LOCALES in tourProductPageBody.tsx) is opened —\n`;
  out2 += `-- a separate human decision. Apply AFTER ${cfg.mainFile}.\n`;
  out2 += `-- Script: scripts/gen-seoul-new-products-sql-2026-08.mjs\n`;
  out2 += `-- =============================================================================\n\n`;
  out2 += `BEGIN;\n\n`;
  for (const row of rows.stagedPages) out2 += pageInsert(cfg, row, "nothing");
  out2 += `COMMIT;\n\n`;
  out2 += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(cfg.slug)} ORDER BY locale;\n`;
  const target2 = path.join(ROOT, "supabase/pending-db-apply", cfg.stagedFile);
  writeFileSync(target2, out2, "utf8");
  console.log("wrote", path.relative(ROOT, target2), `(${present.join(", ")})`);
}

if (LOCALES.length !== 6) throw new Error("expected 6 served locales");
for (const cfg of PRODUCTS) writeProduct(cfg);
