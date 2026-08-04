#!/usr/bin/env node
/**
 * Generates the idempotent DB seed SQL for the two NEW Seoul products
 * (owner instruction 2026-08-04), from the built static bundles:
 *
 *   seoul-gapyeong-nami-morning-calm-petite-france-day-tour   → files 05 / 06
 *   seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour      → files 07 / 08
 *
 * Per product:
 *   1) public.tours              ON CONFLICT (slug)
 *   2) public.tour_product_pages ON CONFLICT (slug, locale) — 6 served locales
 *   3) public.tour_product_offers — single default offer, insert-if-absent
 *   4) a separate INSERT-only file staging the de/fr/it/ru pages, which stay
 *      invisible to guests until the app-side fallback gate is opened by a human.
 *
 * After applying, sync the recommender:
 *   node scripts/import-match-v18.mjs --single <slug>
 *
 * Run: node scripts/gen-seoul-new-products-sql-2026-08.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const EXT_LOCALES = ["de", "fr", "it", "ru"];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

const PRODUCTS = [
  {
    slug: "seoul-gapyeong-nami-morning-calm-petite-france-day-tour",
    mainFile: "2026-08-04-05-seoul-gapyeong-new-product.sql",
    stagedFile: "2026-08-04-06-seoul-gapyeong-staged-locales.sql",
    city: "Seoul",
    tag: "Day trip from Seoul · Gapyeong",
    duration: "11.5 hours",
    difficulty: "Easy",
    groupSize: "Join-in group",
    offerLabel: "Gapyeong day tour (all three admissions included)",
    pickupInfo:
      "Two Seoul pickup points — Starbucks Hongik University Station Exit 8 at 07:30, or Myeongdong Station Exit 2 at 08:00. Choose at booking. Drop-offs: Myeongdong ≈18:30, Hongik University ≈19:00.",
    notes:
      "Nami Island (₩19,000, round-trip ferry included), the Garden of Morning Calm (₩11,000) and Petite France (₩12,000) admissions are all included. Lunch is at your own expense (₩10,000-15,000). The combined Petite France + Italian Village ticket is not included. Runs year-round; the Nami ferry can be suspended in severe weather, in which case the other stops are extended and the Nami admission refunded.",
    header: [
      "Course: Seoul pickup → Nami Island → lunch (own expense) → The Garden of",
      "        Morning Calm → Petite France → return to Seoul.",
      "The join-in-group counterpart to the existing private product",
      "seoul-private-nami-morning-calm-petite-france.",
    ],
  },
  {
    slug: "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour",
    mainFile: "2026-08-04-07-seoul-winter-eobi-new-product.sql",
    stagedFile: "2026-08-04-08-seoul-winter-eobi-staged-locales.sql",
    city: "Seoul",
    tag: "Winter only · Seoraksan & Gapyeong",
    duration: "13 hours",
    difficulty: "Moderate",
    groupSize: "Join-in group",
    offerLabel: "Winter day tour (Seoraksan, Nami Island & Eobi Valley)",
    pickupInfo:
      "Two Seoul pickup points — Starbucks Hongik University Station Exit 8 at 06:00, or Myeongdong Station Exit 2 at 06:30. Choose at booking. Drop-offs: Myeongdong ≈19:00, Hongik University ≈19:30.",
    notes:
      "WINTER-SEASON PRODUCT — do not open year-round sales. The Eobi Valley ice wall is built by villagers of Garil 2-ri each winter and is NOT guaranteed: it forms from around mid-December, is most reliable through January and early February, and the 2025-26 season closed on 19 February. Season dates are set by the village each year and must be confirmed before opening dates for sale. Seoraksan park entry is free; the cable car (₩16,000) is excluded and weather-dependent. Nami ferry + admission (₩19,000) included. Eobi charges small on-site village fees (~₩1,000 viewing, sleds extra) that are NOT included. Lunch own expense.",
    header: [
      "Course: Seoul pickup 06:00/06:30 → Seoraksan National Park (self-guided) →",
      "        lunch (own expense) → Nami Island → Eobi Valley ice wall → Seoul.",
      "SEASONAL: winter only. The ice wall is an ARTIFICIAL structure built each",
      "winter by Garil 2-ri villagers — it exists only while the cold holds.",
    ],
  },
];

function writeProduct(cfg) {
  const BUNDLE_DIR = path.join(ROOT, "components/product-tour-static", cfg.slug);
  const bundle = (loc) =>
    JSON.parse(readFileSync(path.join(BUNDLE_DIR, `${cfg.slug}.${loc}.json`), "utf8"));
  const en = bundle("en");
  const cc = en.catalog_card;
  const seo = en.seo;
  const PRICE_USD = Number(en.price.salePriceUsd);
  const HERO_ABS = `https://www.atockorea.com${cc.heroImage}`;
  const galleryImages = [HERO_ABS].concat(
    (en.galleryItems || []).slice(0, 4).map((g) => `https://www.atockorea.com${g.src}`),
  );
  const schedule = en.itineraryStops.map((s) => ({
    time: s.time,
    title: s.name,
    description: s.category || "",
  }));

  const pageInsert = (b, loc, conflict) => {
    const lcc = b.catalog_card || {};
    const lseo = b.seo || {};
    let o = "";
    o += `INSERT INTO public.tour_product_pages (\n`;
    o += `  slug, locale, product_id, is_published, sort_order, tour_id,\n`;
    o += `  title, subtitle, region_label, duration_label, stops_count,\n`;
    o += `  rating_avg, review_count, badges, hero_image_url, thumbnail_url,\n`;
    o += `  card_short_description, seo_title, meta_description,\n`;
    o += `  headline_line_1, headline_line_2,\n`;
    o += `  price_amount_label, price_currency, price_per, detail_payload\n`;
    o += `) VALUES (\n`;
    o += `  ${q(cfg.slug)},\n`;
    o += `  ${q(loc)},\n`;
    o += `  ${q(cfg.slug)},\n`;
    o += `  TRUE,\n`;
    o += `  1,\n`;
    o += `  (SELECT id FROM public.tours WHERE slug = ${q(cfg.slug)} LIMIT 1),\n`;
    o += `  ${q(lcc.title || cc.title)},\n`;
    o += `  ${q(lcc.subtitle || "")},\n`;
    o += `  ${q(lcc.region || cfg.city)},\n`;
    o += `  ${q(lcc.duration || cfg.duration)},\n`;
    o += `  ${num(lcc.stopsCount ?? cc.stopsCount)},\n`;
    o += `  0,\n`;
    o += `  0,\n`;
    o += `  ${jsonb(lcc.badges || cc.badges || [])},\n`;
    o += `  ${q(b.hero?.imageUrl || lcc.heroImage || "")},\n`;
    o += `  ${q(lcc.thumbnail || lcc.heroImage || "")},\n`;
    o += `  ${q(lcc.shortCardDescription || "")},\n`;
    o += `  ${q(lseo.pageTitle || "")},\n`;
    o += `  ${q(lseo.metaDescription || "")},\n`;
    o += `  ${q(b.headlineLine1 || "")},\n`;
    o += `  ${q(b.headlineLine2 || "")},\n`;
    o += `  ${q(String(PRICE_USD))},\n`;
    o += `  'USD',\n`;
    o += `  'person',\n`;
    o += `  ${jsonb(b)}\n`;
    o += `)\n`;
    if (conflict === "nothing") {
      o += `ON CONFLICT (slug, locale) DO NOTHING;\n\n`;
    } else {
      o += `ON CONFLICT (slug, locale) DO UPDATE SET\n`;
      o += [
        "product_id", "is_published", "sort_order", "tour_id", "title", "subtitle",
        "region_label", "duration_label", "stops_count",
        "badges", "hero_image_url", "thumbnail_url", "card_short_description",
        "seo_title", "meta_description", "headline_line_1", "headline_line_2",
        "price_amount_label", "price_currency", "price_per", "detail_payload",
      ].map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n");
      o += `,\n  updated_at = NOW();\n\n`;
    }
    return o;
  };

  // ---- main file ----------------------------------------------------------
  let out = "";
  out += `-- =============================================================================\n`;
  out += `-- ${cfg.slug} — NEW product (tour_product v2)\n`;
  out += `-- =============================================================================\n`;
  out += `-- Generated: 2026-08-04 (pending DB apply — this session has no DB access)\n`;
  for (const line of cfg.header) out += `-- ${line}\n`;
  out += `-- Price: USD ${PRICE_USD} per person. 🔴 PRICE IS A PLACEHOLDER PENDING OWNER\n`;
  out += `--        CONFIRMATION — set from the sibling Seoul products' Klook-relative\n`;
  out += `--        pricing, not from an owner decision. Confirm before selling.\n`;
  out += `-- Script: scripts/gen-seoul-new-products-sql-2026-08.mjs\n`;
  out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);\n`;
  out += `--             offer insert-if-absent.\n`;
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
  out += `  ${q(cc.title)},\n`;
  out += `  ${q(cfg.slug)},\n`;
  out += `  ${q(cfg.city)},\n`;
  out += `  ${q(cfg.tag)},\n`;
  out += `  ${q(cc.subtitle)},\n`;
  out += `  ${q(cc.shortCardDescription)},\n`;
  out += `  ${q(cc.subtitle)},\n`;
  out += `  ${PRICE_USD.toFixed(2)},\n`;
  out += `  NULL,\n`;
  out += `  'USD',\n`;
  out += `  'person',\n`;
  out += `  ${q(galleryImages[0])},\n`;
  out += `  ${jsonb(galleryImages)},\n`;
  out += `  ${q(cfg.duration)},\n`;
  out += `  ${q(cfg.difficulty)},\n`;
  out += `  ${q(cfg.groupSize)},\n`;
  out += `  FALSE,\n`;
  out += `  TRUE,\n`;
  out += `  ${q(cfg.pickupInfo)},\n`;
  out += `  ${q(cfg.notes)},\n`;
  out += `  ${jsonb(cc.badges || [])},\n`;
  out += `  '[]'::jsonb,\n`;
  out += `  '[]'::jsonb,\n`;
  out += `  '[]'::jsonb,\n`;
  out += `  ${jsonb(schedule)},\n`;
  out += `  '[]'::jsonb,\n`;
  out += `  '[]'::jsonb,\n`;
  out += `  0,\n`;
  out += `  0,\n`;
  out += `  2,\n`;
  out += `  2,\n`;
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

  out += `-- 2) tour_product_pages — marketing detail + detail_payload (6 served locales)\n`;
  for (const loc of LOCALES) out += pageInsert(loc === "en" ? en : bundle(loc), loc, "update");

  out += `-- 3) tour_product_offers — single default offer\n`;
  out += `INSERT INTO public.tour_product_offers (\n`;
  out += `  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default\n`;
  out += `)\n`;
  out += `SELECT p.id, ${q(cfg.offerLabel)}, ${PRICE_USD * 100}, 'USD', NULL, TRUE, TRUE\n`;
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
  const present = EXT_LOCALES.filter((loc) =>
    existsSync(path.join(BUNDLE_DIR, `${cfg.slug}.${loc}.json`)),
  );
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
  for (const loc of present) out2 += pageInsert(bundle(loc), loc, "nothing");
  out2 += `COMMIT;\n\n`;
  out2 += `-- Verify: SELECT locale, is_published, title FROM public.tour_product_pages WHERE slug = ${q(cfg.slug)} ORDER BY locale;\n`;
  const target2 = path.join(ROOT, "supabase/pending-db-apply", cfg.stagedFile);
  writeFileSync(target2, out2, "utf8");
  console.log("wrote", path.relative(ROOT, target2), `(${present.join(", ")})`);
}

for (const cfg of PRODUCTS) writeProduct(cfg);
