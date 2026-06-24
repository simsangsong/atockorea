#!/usr/bin/env node
/**
 * Regenerates the idempotent seed SQL for jeju-eastern-unesco-spots-day-tour
 * from the (re-coursed) static EN bundle. Mirrors the structure of the original
 * scripts/gen-tour-product-sql.mjs output (which was removed from the repo):
 *   1) public.tours                 ON CONFLICT (slug)
 *   2) public.tour_product_pages    ON CONFLICT (slug, locale)   [EN row]
 *   3) public.tour_product_offers   (default seed, non-destructive)
 *   4) public.tour_matching_profiles ON CONFLICT (product_id)
 *
 * Writes to both supabase/manual/ (canonical) and supabase/pending-upload/
 * (staging area to batch-apply against the production DB later).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const num = (v) => (v === null || v === undefined ? "NULL" : Number(v));

// tours.schedule — itinerary summary
const schedule = en.itineraryStops.map((s) => ({
  time: s.time,
  title: s.name,
  description: s.category || "",
}));

const cc = en.catalog_card;
const seo = en.seo;
const mp = en.matching_profile;
const badges = cc.badges || [];
const galleryImages = [
  "https://www.visitjeju.net/image/main/2024/seongsan-ilchulbong.jpg",
  "https://www.visitjeju.net/image/main/2024/manjanggul.jpg",
  "https://images.unsplash.com/photo-1601471569526-2c7d5e1b7e5f?w=1200",
  "https://images.unsplash.com/photo-1502175353174-a7a44e84da10?w=1200",
  "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=1200",
];

const PRICE_USD = 47;
const ORIG_USD = 59;

let out = "";
out += `-- =============================================================================\n`;
out += `-- ${SLUG} — small-group tour product (tour_product v2)\n`;
out += `-- =============================================================================\n`;
out += `-- Regenerated: re-coursed itinerary (Manjanggul Lava Tube + live Haenyeo diving\n`;
out += `--   performance), lunch moved ahead of Seongsan, price US$${PRICE_USD} (was $${ORIG_USD}).\n`;
out += `-- Script: scripts/gen-jeju-east-recourse-sql.mjs\n`;
out += `-- Source: components/product-tour-static/${SLUG}/${SLUG}.en.json\n`;
out += `-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);\n`;
out += `--            tour_product_offers inserted only when no default offer exists;\n`;
out += `--            tour_matching_profiles ON CONFLICT (product_id)\n`;
out += `-- Web: /tour-product/${SLUG}\n`;
out += `-- =============================================================================\n\n`;
out += `BEGIN;\n\n`;

// ---- 1) tours -------------------------------------------------------------
out += `-- ---------------------------------------------------------------------------\n`;
out += `-- 1) tours — booking + /tour/[id] checkout\n`;
out += `-- ---------------------------------------------------------------------------\n`;
out += `INSERT INTO public.tours (\n`;
out += `  title, slug, city, tag, subtitle, description, highlight,\n`;
out += `  price, original_price, price_currency, price_type, image_url, gallery_images,\n`;
out += `  duration, difficulty, group_size, lunch_included, ticket_included,\n`;
out += `  pickup_info, notes, badges, highlights, includes, excludes,\n`;
out += `  schedule, itinerary_details, faqs,\n`;
out += `  rating, review_count, pickup_points_count, dropoff_points_count,\n`;
out += `  is_active, is_featured, translations, seo_title, meta_description\n`;
out += `) VALUES (\n`;
out += `  'Jeju Eastern UNESCO Spots Day Tour',\n`;
out += `  ${q(SLUG)},\n`;
out += `  'Jeju',\n`;
out += `  'Small group · Eastern Jeju',\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${q(cc.shortCardDescription)},\n`;
out += `  ${q(cc.subtitle)},\n`;
out += `  ${PRICE_USD}.00,\n`;
out += `  ${ORIG_USD}.00,\n`;
out += `  'USD',\n`;
out += `  'person',\n`;
out += `  'https://www.visitjeju.net/image/main/2024/seongsan-ilchulbong.jpg',\n`;
out += `  ${jsonb(galleryImages)},\n`;
out += `  '9 hours',\n`;
out += `  'Moderate',\n`;
out += `  'Small group',\n`;
out += `  FALSE,\n`;
out += `  TRUE,\n`;
out += `  'Pickup confirmed after booking.',\n`;
out += `  'Weather and operational conditions may shift the stop order or duration. The haenyeo diving performance is open-air and weather-dependent; if cancelled, the Haenyeo Museum is visited instead. Manjanggul may close for maintenance — a nearby lava tube (Micheon Cave) is the fallback.',\n`;
out += `  ${jsonb(badges)},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  ${jsonb(schedule)},\n`;
out += `  '[]'::jsonb,\n`;
out += `  '[]'::jsonb,\n`;
out += `  4.9,\n`;
out += `  1148,\n`;
out += `  2,\n`;
out += `  0,\n`;
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
out += `;\n\n`;

// ---- 2) tour_product_pages (6 locales) -----------------------------------
out += `-- ---------------------------------------------------------------------------\n`;
out += `-- 2) tour_product_pages — marketing detail + detail_payload (6 locales)\n`;
out += `-- ---------------------------------------------------------------------------\n`;
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
  out += `  ${jsonb(lcc.badges || badges)},\n`;
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
    "region_label", "duration_label", "stops_count", "rating_avg", "review_count",
    "badges", "hero_image_url", "thumbnail_url", "card_short_description",
    "seo_title", "meta_description", "headline_line_1", "headline_line_2",
    "price_amount_label", "price_currency", "price_per", "detail_payload",
  ].map((c) => `  ${c} = EXCLUDED.${c}`).join(",\n");
  out += `,\n  updated_at = NOW();\n\n`;
}

// ---- 3) tour_product_offers ----------------------------------------------
out += `-- ---------------------------------------------------------------------------\n`;
out += `-- 3) tour_product_offers — sticky bar / checkout (USD minor units)\n`;
out += `-- ---------------------------------------------------------------------------\n`;
out += `INSERT INTO public.tour_product_offers (\n`;
out += `  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default\n`;
out += `)\n`;
out += `SELECT\n`;
out += `  p.id,\n`;
out += `  'Default (seed)',\n`;
out += `  ${PRICE_USD * 100},\n`;
out += `  'USD',\n`;
out += `  NULL,\n`;
out += `  TRUE,\n`;
out += `  TRUE\n`;
out += `FROM public.tour_product_pages p\n`;
out += `WHERE p.slug = ${q(SLUG)} AND p.locale = 'en'\n`;
out += `  AND NOT EXISTS (\n`;
out += `    SELECT 1 FROM public.tour_product_offers o\n`;
out += `    WHERE o.tour_product_page_id = p.id AND o.is_default = TRUE AND o.is_active = TRUE\n`;
out += `  );\n\n`;

// ---- 4) tour_matching_profiles -------------------------------------------
const themeTags = ["unesco", "world_heritage", "volcano", "lava_tube", "culture", "first_time_friendly", "iconic_landmarks", "intangible_heritage"];
out += `-- ---------------------------------------------------------------------------\n`;
out += `-- 4) tour_matching_profiles — recommendation / match pipeline\n`;
out += `-- ---------------------------------------------------------------------------\n`;
out += `INSERT INTO public.tour_matching_profiles (\n`;
out += `  product_id, product_type, route_type, region_type,\n`;
out += `  region_tags, theme_tags, poi_tags,\n`;
out += `  pace_level, walking_level, scenic_level, photo_level, culture_level, relax_level,\n`;
out += `  first_time_fit, family_fit, senior_fit, couple_fit, active_traveler_fit,\n`;
out += `  one_day_fit, same_day_flight_fit, rain_fit, value_for_money_fit,\n`;
out += `  iconic_landmark_fit, cafe_fit,\n`;
out += `  adult_family_fit, young_kids_fit, senior_active_fit, senior_general_fit,\n`;
out += `  mobility_friendly_fit, stroller_fit,\n`;
out += `  indoor_ratio, weather_sensitivity,\n`;
out += `  local_culture_fit, shopping_fit, storytelling_fit,\n`;
out += `  comfort_level, budget_fit, premium_fit,\n`;
out += `  small_group_fit, private_fit, bus_fit,\n`;
out += `  price_band, pickup_base, return_time_band, duration_band, min_recommended_age,\n`;
out += `  hard_constraints, walking_notes, keywords, synonym_hints,\n`;
out += `  profile_version, is_active\n`;
out += `) VALUES (\n`;
out += `  ${q(SLUG)},\n`;
out += `  ${q(mp.product_type)},\n`;
out += `  ${q(mp.route_type)},\n`;
out += `  ${q(mp.region_type)},\n`;
out += `  ${jsonb(mp.region_tags)},\n`;
out += `  ${jsonb(themeTags)},\n`;
out += `  ${jsonb(mp.poi_tags)},\n`;
out += `  ${num(mp.pace_level)}, ${num(mp.walking_level)}, ${num(mp.scenic_level)}, ${num(mp.photo_level)}, ${num(mp.culture_level)}, ${num(mp.relax_level)},\n`;
out += `  ${num(mp.first_time_fit)}, ${num(mp.family_fit)}, ${num(mp.senior_fit)}, ${num(mp.couple_fit)}, ${num(mp.active_traveler_fit)},\n`;
out += `  ${num(mp.one_day_fit)}, ${num(mp.same_day_flight_fit)}, ${num(mp.rain_fit)}, ${num(mp.value_for_money_fit)},\n`;
out += `  ${num(mp.iconic_landmark_fit)}, ${num(mp.cafe_fit)},\n`;
out += `  ${num(mp.adult_family_fit)}, ${num(mp.young_kids_fit)}, ${num(mp.senior_active_fit)}, ${num(mp.senior_general_fit)},\n`;
out += `  ${num(mp.mobility_friendly_fit)}, ${num(mp.stroller_fit)},\n`;
out += `  ${num(mp.indoor_ratio)}, ${num(mp.weather_sensitivity)},\n`;
out += `  ${num(mp.local_culture_fit)}, ${num(mp.shopping_fit)}, ${num(mp.storytelling_fit)},\n`;
out += `  ${num(mp.comfort_level)}, ${num(mp.budget_fit)}, ${num(mp.premium_fit)},\n`;
out += `  ${num(mp.small_group_fit)}, ${num(mp.private_fit)}, ${num(mp.bus_fit)},\n`;
out += `  ${q(mp.price_band)}, ${q(mp.pickup_base)}, ${q(mp.return_time_band)}, ${q(mp.duration_band)}, ${num(mp.min_recommended_age)},\n`;
out += `  ${jsonb(mp.hard_constraints)},\n`;
out += `  ${jsonb(mp.walking_notes)},\n`;
out += `  ${jsonb(mp.keywords)},\n`;
out += `  ${jsonb(mp.synonym_hints)},\n`;
out += `  ${num(mp.profile_version)},\n`;
out += `  TRUE\n`;
out += `)\n`;
out += `ON CONFLICT (product_id) DO UPDATE SET\n`;
out += [
  "product_type", "route_type", "region_type", "region_tags", "theme_tags", "poi_tags",
  "pace_level", "walking_level", "scenic_level", "photo_level", "culture_level", "relax_level",
  "first_time_fit", "family_fit", "senior_fit", "couple_fit", "active_traveler_fit",
  "one_day_fit", "same_day_flight_fit", "rain_fit", "value_for_money_fit",
  "iconic_landmark_fit", "cafe_fit",
  "adult_family_fit", "young_kids_fit", "senior_active_fit", "senior_general_fit",
  "mobility_friendly_fit", "stroller_fit", "indoor_ratio", "weather_sensitivity",
  "local_culture_fit", "shopping_fit", "storytelling_fit",
  "comfort_level", "budget_fit", "premium_fit",
  "small_group_fit", "private_fit", "bus_fit",
  "price_band", "pickup_base", "return_time_band", "duration_band", "min_recommended_age",
  "hard_constraints", "walking_notes", "keywords", "synonym_hints", "profile_version", "is_active",
].map((c) => `  ${c} = EXCLUDED.${c}`).join(",\n");
out += `,\n  updated_at = NOW();\n\n`;

out += `COMMIT;\n\n`;
out += `SELECT slug, title, price, original_price, is_active FROM public.tours WHERE slug = ${q(SLUG)};\n`;
out += `SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = ${q(SLUG)} ORDER BY locale;\n`;
out += `SELECT product_id, product_type, region_type, price_band, profile_version, is_active FROM public.tour_matching_profiles WHERE product_id = ${q(SLUG)};\n`;

const targets = [
  path.join(ROOT, "supabase/manual", `insert-${SLUG}-product.generated.sql`),
  path.join(ROOT, "supabase/pending-db-apply", `2026-06-24-07-${SLUG}.sql`),
];
mkdirSync(path.join(ROOT, "supabase/pending-db-apply"), { recursive: true });
for (const t of targets) {
  writeFileSync(t, out, "utf8");
  console.log(`✓ wrote ${path.relative(ROOT, t)} (${(out.length / 1024).toFixed(1)} KB)`);
}
