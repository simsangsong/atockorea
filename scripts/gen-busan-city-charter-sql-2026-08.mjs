#!/usr/bin/env node
/**
 * Generate the pending DB SQL for the new Busan city private charter, from the
 * built static bundles:
 *
 *   supabase/pending-db-apply/2026-08-07-06-busan-city-charter-new-product.sql
 *
 * `buildRows` is exported so a supabase-js applier can reuse the exact field
 * mapping — the 2026-08-04 batch learned the hard way that a second copy of the
 * mapping drifts, and that the SQL path and the PostgREST path disagree about
 * column types (see `textArray` below).
 *
 * Run: node scripts/gen-busan-city-charter-sql-2026-08.mjs
 * Apply: psql "$SUPABASE_DB_URL" -f supabase/pending-db-apply/2026-08-07-06-*.sql
 *        (or execute the statements over supabase-js / MCP)
 * After applying: node scripts/import-match-v18.mjs --single busan-private-car-charter-city-tour
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const SLUG = "busan-private-car-charter-city-tour";
export const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const ABS = "https://www.atockorea.com";
const OUT = path.join(ROOT, "supabase/pending-db-apply/2026-08-07-06-busan-city-charter-new-product.sql");

const CFG = {
  city: "Busan",
  tag: "Private charter · Busan city",
  duration: "5–9 hours",
  difficulty: "Easy",
  groupSize: "Private (1–7 per vehicle)",
  offerLabel: "Busan city private charter (5 hours, 1–7 pax)",
  pickupInfo:
    "Door-to-door pickup at your accommodation anywhere in central Busan (Seomyeon, Haeundae, Nampo-dong, Busan Station and surrounding districts) at a start time you choose. Drop-off anywhere in Busan. Gimhae International Airport pickup or drop-off is a paid add-on.",
  notes:
    "Sold by the hour and priced per vehicle, not per person: 5h US$160 / 6h US$185 / 7h US$205 / 8h US$225 / 9h US$255 for 1-7 guests. 8 or more guests travel in two vehicles at twice the rate. Add-ons: Gimhae Airport pickup or drop-off +US$35, a Gyeongju day +US$55, each hour past 9 +US$35. Entrance fees, ride tickets (including the Sky Capsule) and meals are paid directly at the stops you choose.",
};

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
/**
 * 🔴 `tour_product_pages.badges` is text[] while `tours.badges` is jsonb. Same
 * column name, different type, and feeding a JSON array into the text[] one
 * fails the whole transaction. That mistake shipped in the 2026-06-24 batch,
 * again in 2026-08-04, and a third time in the generator written after both —
 * because only the applied SQL was ever patched, never the generator. The
 * supabase-js path never sees it (PostgREST takes the array natively), so it
 * only breaks on psql. `__tests__/audit/pendingSqlColumnTypes.test.ts` is the
 * gate; this helper is what keeps it green.
 */
const textArray = (v) =>
  Array.isArray(v) && v.length ? `ARRAY[${v.map(q).join(", ")}]::text[]` : `${q("{}")}::text[]`;
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));
const bool = (v) => (v ? "TRUE" : "FALSE");

const bundle = (loc) =>
  JSON.parse(
    readFileSync(path.join(ROOT, "components/product-tour-static", SLUG, `${SLUG}.${loc}.json`), "utf8"),
  );

export function buildRows() {
  const en = bundle("en");
  const cc = en.catalog_card;
  const priceUsd = Number(en.price.salePriceUsd);
  const heroAbs = `${ABS}${cc.heroImage}`;
  const galleryImages = [heroAbs].concat((en.galleryItems || []).slice(0, 4).map((g) => `${ABS}${g.src}`));

  // The "schedule" of a charter is its route options, not a clock — each
  // itineraryStop here IS a route drawer. `time` carries "Best in 8–9 hours".
  const schedule = en.itineraryStops.map((s) => ({
    time: s.time,
    title: s.name,
    description: s.category || "",
  }));

  const tour = {
    title: cc.title,
    slug: SLUG,
    city: CFG.city,
    tag: CFG.tag,
    subtitle: cc.subtitle,
    description: cc.shortCardDescription,
    highlight: cc.subtitle,
    price: priceUsd,
    original_price: null,
    price_currency: "USD",
    // 🔴 vehicle, not person. /api/bookings multiplies by guest count only when
    // this says "person"; a charter billed per guest would sell a 5-hour car to
    // a family of five for US$800.
    price_type: "vehicle",
    image_url: galleryImages[0],
    gallery_images: galleryImages,
    duration: CFG.duration,
    difficulty: CFG.difficulty,
    group_size: CFG.groupSize,
    lunch_included: false,
    ticket_included: false,
    pickup_info: CFG.pickupInfo,
    notes: CFG.notes,
    badges: cc.badges || [],
    highlights: [],
    includes: [],
    excludes: [],
    schedule,
    itinerary_details: [],
    faqs: [],
    rating: 0,
    review_count: 0,
    pickup_points_count: 1,
    dropoff_points_count: 1,
    is_active: true,
    is_featured: false,
    translations: {},
    seo_title: en.seo.pageTitle,
    meta_description: en.seo.metaDescription,
  };

  const pageRow = (b, loc) => {
    const lcc = b.catalog_card || {};
    const lseo = b.seo || {};
    return {
      slug: SLUG,
      locale: loc,
      product_id: SLUG,
      is_published: true,
      sort_order: 1,
      title: lcc.title || cc.title,
      subtitle: lcc.subtitle || "",
      region_label: lcc.region || CFG.city,
      duration_label: lcc.duration || CFG.duration,
      stops_count: lcc.stopsCount ?? cc.stopsCount,
      rating_avg: 0,
      review_count: 0,
      badges: lcc.badges || cc.badges || [],
      hero_image_url: b.hero?.imageUrl || lcc.heroImage || "",
      thumbnail_url: lcc.thumbnail || lcc.heroImage || "",
      card_short_description: lcc.shortCardDescription || "",
      seo_title: lseo.pageTitle || "",
      meta_description: lseo.metaDescription || "",
      headline_line_1: b.headlineLine1 || "",
      headline_line_2: b.headlineLine2 || "",
      price_amount_label: String(priceUsd),
      price_currency: "USD",
      price_per: "vehicle",
      detail_payload: b,
    };
  };

  return {
    priceUsd,
    tour,
    pages: LOCALES.map((loc) => pageRow(loc === "en" ? en : bundle(loc), loc)),
    offer: {
      label: CFG.offerLabel,
      amount_minor: priceUsd * 100,
      currency: "USD",
      stripe_price_id: null,
      is_active: true,
      is_default: true,
    },
  };
}

const TOUR_COLS = [
  "title", "slug", "city", "tag", "subtitle", "description", "highlight",
  "price", "original_price", "price_currency", "price_type", "image_url", "gallery_images",
  "duration", "difficulty", "group_size", "lunch_included", "ticket_included",
  "pickup_info", "notes", "badges", "highlights", "includes", "excludes",
  "schedule", "itinerary_details", "faqs",
  "rating", "review_count", "pickup_points_count", "dropoff_points_count",
  "is_active", "is_featured", "translations", "seo_title", "meta_description",
];

const PAGE_COLS = [
  "slug", "locale", "product_id", "is_published", "sort_order",
  "title", "subtitle", "region_label", "duration_label", "stops_count",
  "rating_avg", "review_count", "badges", "hero_image_url", "thumbnail_url",
  "card_short_description", "seo_title", "meta_description",
  "headline_line_1", "headline_line_2",
  "price_amount_label", "price_currency", "price_per", "detail_payload",
];

/** jsonb columns on `tours`; everything array-shaped on `tour_product_pages` is text[]. */
const TOUR_JSONB = new Set(["gallery_images", "badges", "highlights", "includes", "excludes", "schedule", "itinerary_details", "faqs", "translations"]);
const PAGE_TEXT_ARRAY = new Set(["badges"]);
const PAGE_JSONB = new Set(["detail_payload"]);

function tourValue(col, v) {
  if (TOUR_JSONB.has(col)) return jsonb(v ?? (Array.isArray(v) ? [] : {}));
  if (typeof v === "boolean") return bool(v);
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return num(v);
  return q(v);
}

function pageValue(col, v) {
  if (PAGE_JSONB.has(col)) return jsonb(v);
  if (PAGE_TEXT_ARRAY.has(col)) return textArray(v);
  if (typeof v === "boolean") return bool(v);
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return num(v);
  return q(v);
}

// Writing the file is a side effect, so it only happens when this script is the
// entry point — `apply-busan-city-charter-2026-08.mjs` imports `buildRows` from
// here and must not rewrite the SQL just by loading the module.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSql();
}

function writeSql() {
const rows = buildRows();
const lines = [];
const p = (s = "") => lines.push(s);

p("-- =============================================================================");
p(`-- ${SLUG} — NEW product (tour_product v2)`);
p("-- =============================================================================");
p("-- Generated 2026-08-07. Regenerate with:");
p("--   node scripts/gen-busan-city-charter-sql-2026-08.mjs");
p("--");
p("-- Owner instruction 2026-08-07: Busan had a cruise-port private charter but no");
p("-- city one. Its own pickup notes even pointed guests at \"our separate private");
p("-- Busan day-charter\", which did not exist. This is that product.");
p("--");
p("-- Recommended routes are IMPORTED at build time from the three Busan tours the");
p("-- owner named (top-attractions, small-group Sky Capsule, cruise-shore coastal),");
p("-- per locale, plus a fourth custom-route drawer. See");
p("-- scripts/build-busan-city-charter-2026-08.mjs.");
p("--");
p("-- 🔴 price_type = 'vehicle'. /api/bookings multiplies the unit price by guest");
p("-- count only when price_type is 'person'. Getting this wrong would bill a");
p("-- family of five five times for one car.");
p("--");
p("-- Rate card (owner, converted at 1,423.48 KRW/USD, rounded to the nearest $5):");
p("--   5h ₩230,000→$160 · 6h ₩260,000→$185 · 7h ₩290,000→$205");
p("--   8h ₩320,000→$225 · 9h ₩360,000→$255      1–7 pax; 8+ pax = 2x (second car)");
p("--   Gimhae Airport pickup or drop-off ₩50,000→$35 · Gyeongju ₩80,000→$55");
p("--   each hour past 9h ₩50,000→$35");
p("-- tours.price is the cheapest cell, because the rate card is what gets charged");
p("-- (lib/tour-product/charterRateCard.ts, owner decision the same day).");
p("--");
p("-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);");
p("--             offer insert-if-absent.");
p(`-- AFTER APPLYING: node scripts/import-match-v18.mjs --single ${SLUG}`);
p(`-- Web: /tour-product/${SLUG}`);
p("-- =============================================================================");
p();
p("BEGIN;");
p();
p("-- 1) tours — booking + /tour/[id] checkout");
p(`INSERT INTO public.tours (\n  ${TOUR_COLS.join(", ")}\n) VALUES (`);
p(TOUR_COLS.map((c) => `  ${tourValue(c, rows.tour[c])}`).join(",\n"));
p(")");
p("ON CONFLICT (slug) DO UPDATE SET");
p(
  TOUR_COLS.filter((c) => c !== "slug")
    .map((c) => `  ${c} = EXCLUDED.${c}`)
    .join(",\n") + ",",
);
p("  updated_at = NOW();");
p();
p("-- 2) tour_product_pages — one row per content locale (de/fr/it/ru serve EN by");
p("--    design until the TOUR_PRODUCT_FALLBACK_URL_LOCALES gate opens, which is a");
p("--    human decision, so they are deliberately not seeded here.");
for (const row of rows.pages) {
  p(`INSERT INTO public.tour_product_pages (\n  ${PAGE_COLS.join(", ")}\n) VALUES (`);
  p(PAGE_COLS.map((c) => `  ${pageValue(c, row[c])}`).join(",\n"));
  p(")");
  p("ON CONFLICT (slug, locale) DO UPDATE SET");
  p(
    PAGE_COLS.filter((c) => c !== "slug" && c !== "locale")
      .map((c) => `  ${c} = EXCLUDED.${c}`)
      .join(",\n") + ",",
  );
  p("  updated_at = NOW();");
  p();
}
p("-- 3) default offer — the cheapest rate-card cell, so the catalogue, the page");
p("--    and checkout all state the same number.");
p("INSERT INTO public.tour_product_offers (tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default)");
p("SELECT p.id, " + [q(rows.offer.label), num(rows.offer.amount_minor), q(rows.offer.currency), "NULL", bool(true), bool(true)].join(", "));
p("  FROM public.tour_product_pages p");
p(` WHERE p.slug = ${q(SLUG)} AND p.locale = 'en'`);
p("   AND NOT EXISTS (SELECT 1 FROM public.tour_product_offers o WHERE o.tour_product_page_id = p.id);");
p();
p("COMMIT;");
p();
p("-- Verify");
p("--   SELECT t.slug, t.price, t.price_type, t.is_active,");
p("--          (SELECT count(*) FROM tour_product_pages p WHERE p.slug = t.slug AND p.is_published) AS published");
p(`--     FROM tours t WHERE t.slug = ${q(SLUG)};`);
p("--   -- expect price 160, price_type vehicle, is_active t, published 6");

writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`wrote ${path.relative(ROOT, OUT)} (${(lines.join("\n").length / 1024).toFixed(0)} KB)`);
console.log(`  tours: 1 · tour_product_pages: ${rows.pages.length} · offers: 1`);
console.log(`  price ${rows.priceUsd} USD per ${rows.tour.price_type}`);
}
