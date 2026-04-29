/**
 * Generic SQL generator for small-group tour products.
 *
 * Usage:
 *   node scripts/gen-tour-product-sql.mjs <slug> [--out supabase/manual/insert-<slug>.sql]
 *
 * Inputs:
 *   - `components/product-tour-static/<slug>/<slug>.en.json` (required; source of truth)
 *   - `components/product-tour-static/<slug>/<slug>.<locale>.json` (ko, ja, zh, zh-TW, es — optional)
 *     Some slugs historically name their English file `<slug>.en-1.json`; we try
 *     both patterns automatically.
 *
 * Outputs a single idempotent SQL script that upserts:
 *   1. `tours` (booking + checkout)
 *   2. `tour_product_pages` × N locales (marketing + `detail_payload` JSONB)
 *   3. `tour_product_offers` (one default USD offer if none exists)
 *   4. `tour_matching_profiles` (home "See My Best Matches" pipeline)
 *
 * The `matching_profile` block is validated with
 * `scripts/_lib/matching-profile-validator.mjs` before emitting SQL, so keys
 * that `shouldHardExclude` cannot enforce fail the run loudly.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { assertMatchingProfileOrExit } from "./_lib/matching-profile-validator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

function parseArgs(argv) {
  const [, , slug, ...rest] = argv;
  if (!slug || slug.startsWith("-")) {
    console.error(
      "Usage: node scripts/gen-tour-product-sql.mjs <slug> [--out <path>] [--locales <csv>]\n" +
        "       node scripts/gen-tour-product-sql.mjs jeju-grand-highlights-loop\n" +
        "       node scripts/gen-tour-product-sql.mjs jeju-grand-highlights-loop --locales en",
    );
    process.exit(1);
  }
  const opts = { slug, outPath: null, locales: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out" && rest[i + 1]) {
      opts.outPath = rest[++i];
    } else if (rest[i] === "--locales" && rest[i + 1]) {
      opts.locales = rest[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  if (!opts.outPath) {
    opts.outPath = join(root, `supabase/manual/insert-${slug}-product.sql`);
  }
  if (opts.locales && !opts.locales.includes("en")) {
    console.error(`[gen-tour-product-sql] --locales must include "en" (got: ${opts.locales.join(",")})`);
    process.exit(1);
  }
  return opts;
}

function sqlEscapeLiteral(s) {
  return String(s).replace(/'/g, "''");
}

function sqlNullable(v) {
  if (v == null || v === "") return "NULL";
  return `'${sqlEscapeLiteral(v)}'`;
}

function sqlBool(v) {
  return v ? "TRUE" : "FALSE";
}

function sqlJsonb(obj) {
  return `'${sqlEscapeLiteral(JSON.stringify(obj ?? null))}'::jsonb`;
}

function sqlTextArray(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  if (safe.length === 0) return "ARRAY[]::text[]";
  const elems = safe.map((v) => `'${sqlEscapeLiteral(v)}'`).join(", ");
  return `ARRAY[${elems}]::text[]`;
}

function loadLocaleBundle(slug) {
  const dir = join(root, `components/product-tour-static/${slug}`);
  if (!existsSync(dir)) {
    console.error(`[gen-tour-product-sql] directory not found: ${dir}`);
    process.exit(1);
  }
  const bundle = {};
  const enCandidates = [
    join(dir, `${slug}.en.json`),
    join(dir, `${slug}.en-1.json`),
    join(dir, `${slug}-tour-product-full-page.en.json`),
  ];
  const enPath = enCandidates.find((p) => existsSync(p));
  if (!enPath) {
    console.error(`[gen-tour-product-sql] missing English source JSON in ${dir}. Tried:\n  - ${enCandidates.join("\n  - ")}`);
    process.exit(1);
  }
  bundle.en = { path: enPath, doc: JSON.parse(readFileSync(enPath, "utf8")) };

  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const p = join(dir, `${slug}.${locale}.json`);
    if (existsSync(p)) {
      bundle[locale] = { path: p, doc: JSON.parse(readFileSync(p, "utf8")) };
    }
  }
  return bundle;
}

function asRecord(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

/**
 * Same contract as `mergeFullPageWithLocaleBase` in `tourProductBundleRegistry.ts`.
 * Locale files may be partial overlays (e.g. only `bookingSupportSteps`); EN is the
 * base so `tour_product_pages.title` and `detail_payload` stay complete.
 */
function mergeFullPageWithLocaleBase(en, loc) {
  const merged = { ...en, ...loc };
  if (loc && typeof loc.sectionUi === "object" && en && typeof en.sectionUi === "object") {
    merged.sectionUi = { ...en.sectionUi, ...loc.sectionUi };
  } else if (loc && loc.sectionUi) {
    merged.sectionUi = loc.sectionUi;
  }
  return merged;
}

/**
 * Resolve `tours.city` as one of the check-constraint allow-list values
 * (`Seoul | Busan | Jeju`). Authors typically put a marketing label in
 * `catalog_card.region` (e.g. "Jeju Full-Island Route"), which would
 * violate `tours_city_check`, so we fall back to a keyword scan across
 * region / title / subtitle / slug and default to `Jeju` (the flagship
 * region today). Authors can always force a value via `sql_overrides.tours.city`.
 */
const TOURS_CITY_ALLOWED = ["Seoul", "Busan", "Jeju"];
function resolveToursCity(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  const candidate = overrides.city ?? null;
  if (candidate && TOURS_CITY_ALLOWED.includes(candidate)) return candidate;
  if (candidate) {
    console.error(
      `[gen-tour-product-sql] sql_overrides.tours.city='${candidate}' is not one of ${TOURS_CITY_ALLOWED.join("|")} for ${slug}`,
    );
    process.exit(1);
  }
  const haystack = [cc.region, cc.title, cc.subtitle, slug]
    .filter((v) => typeof v === "string" && v.length > 0)
    .join(" | ")
    .toLowerCase();
  for (const city of TOURS_CITY_ALLOWED) {
    if (haystack.includes(city.toLowerCase())) return city;
  }
  return "Jeju";
}

/** Derive `tours.price` (integer) from authoring JSON. */
function resolveToursPrice(doc, slug) {
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  if (overrides.price != null) {
    const forced = Number(overrides.price);
    if (Number.isFinite(forced) && forced >= 0) return forced;
  }
  const priceAmountLabel = asRecord(doc.price).amountLabel;
  if (priceAmountLabel != null) {
    const n = Number(String(priceAmountLabel).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const priceLabel = asRecord(doc.catalog_card).priceLabel;
  if (typeof priceLabel === "string") {
    const m = priceLabel.match(/(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]);
  }
  // Products with TBD/placeholder pricing (e.g. cruise shore excursions where
  // the cruise-day rate is finalized per sailing) can explicitly opt in by
  // setting `sql_overrides.tours.price = 0`. If we reach this fallback without
  // any signal, emit a warning but keep the row insertable so seeding isn't
  // blocked during authoring.
  console.warn(
    `[gen-tour-product-sql] price unresolved for ${slug}; falling back to 0.00. ` +
      `Set price.amountLabel, catalog_card.priceLabel, or sql_overrides.tours.price.`,
  );
  return 0;
}

/** `tours` catalog row — optional author overrides live in `doc.sql_overrides.tours`. */
function buildToursInsert(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  const price = resolveToursPrice(doc, slug);
  const city = resolveToursCity(doc, slug);
  const priceCurrency = asRecord(doc.price).currency ?? "USD";
  const originalPrice = overrides.original_price ?? cc.compareAtPriceUsd ?? null;
  const heroImage = cc.heroImage ?? asRecord(doc.hero).imageUrl ?? "";
  const gallery = Array.isArray(doc.galleryItems)
    ? doc.galleryItems
        .map((g) => (g && typeof g === "object" ? g.src : null))
        .filter((u) => typeof u === "string" && u.length > 0)
    : [];
  const badges = Array.isArray(cc.badges) ? cc.badges : [];

  const itinerarySummary = Array.isArray(doc.itineraryStops)
    ? doc.itineraryStops.map((s) => {
        const row = asRecord(s);
        return {
          time: row.time ?? "",
          title: row.name ?? "",
          description: row.category ?? "",
        };
      })
    : [];

  return `INSERT INTO public.tours (
  title, slug, city, tag, subtitle, description, highlight,
  price, original_price, price_currency, price_type, image_url, gallery_images,
  duration, difficulty, group_size, lunch_included, ticket_included,
  pickup_info, notes, badges, highlights, includes, excludes,
  schedule, itinerary_details, faqs,
  rating, review_count, pickup_points_count, dropoff_points_count,
  is_active, is_featured, translations, seo_title, meta_description
) VALUES (
  '${sqlEscapeLiteral(cc.title ?? slug)}',
  '${sqlEscapeLiteral(slug)}',
  '${sqlEscapeLiteral(city)}',
  ${sqlNullable(overrides.tag ?? `Small group · ${cc.region ?? ""}`.trim())},
  ${sqlNullable(cc.subtitle ?? "")},
  ${sqlNullable(overrides.description ?? cc.shortCardDescription ?? "")},
  ${sqlNullable(overrides.highlight ?? cc.subtitle ?? "")},
  ${price.toFixed(2)},
  ${originalPrice != null ? Number(originalPrice).toFixed(2) : "NULL"},
  '${sqlEscapeLiteral(priceCurrency)}',
  ${sqlNullable(overrides.price_type ?? asRecord(doc.price).per ?? "person")},
  ${sqlNullable(heroImage)},
  ${sqlJsonb(gallery)},
  ${sqlNullable(overrides.duration ?? cc.duration ?? "")},
  ${sqlNullable(overrides.difficulty ?? "Moderate")},
  ${sqlNullable(overrides.group_size ?? "Small group")},
  ${sqlBool(overrides.lunch_included ?? false)},
  ${sqlBool(overrides.ticket_included ?? false)},
  ${sqlNullable(overrides.pickup_info ?? "Pickup confirmed after booking.")},
  ${sqlNullable(overrides.notes ?? "Weather and operational conditions may shift the stop order or duration.")},
  ${sqlJsonb(badges)},
  ${sqlJsonb(overrides.highlights ?? [])},
  ${sqlJsonb(overrides.includes ?? [])},
  ${sqlJsonb(overrides.excludes ?? [])},
  ${sqlJsonb(overrides.schedule ?? itinerarySummary)},
  ${sqlJsonb(overrides.itinerary_details ?? [])},
  ${sqlJsonb(overrides.faqs ?? [])},
  ${Number(cc.rating ?? 0)},
  ${Number(cc.reviewCount ?? 0)},
  ${Number(overrides.pickup_points_count ?? 2)},
  ${Number(overrides.dropoff_points_count ?? 0)},
  ${sqlBool(overrides.is_active ?? true)},
  ${sqlBool(overrides.is_featured ?? false)},
  ${sqlJsonb(overrides.translations ?? {})},
  ${sqlNullable(overrides.seo_title ?? asRecord(doc.seo).pageTitle ?? cc.title ?? slug)},
  ${sqlNullable(overrides.meta_description ?? asRecord(doc.seo).metaDescription ?? cc.shortCardDescription ?? "")}
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  city = EXCLUDED.city,
  tag = EXCLUDED.tag,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  highlight = EXCLUDED.highlight,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  price_currency = EXCLUDED.price_currency,
  price_type = EXCLUDED.price_type,
  image_url = EXCLUDED.image_url,
  gallery_images = EXCLUDED.gallery_images,
  duration = EXCLUDED.duration,
  difficulty = EXCLUDED.difficulty,
  group_size = EXCLUDED.group_size,
  lunch_included = EXCLUDED.lunch_included,
  ticket_included = EXCLUDED.ticket_included,
  pickup_info = EXCLUDED.pickup_info,
  notes = EXCLUDED.notes,
  badges = EXCLUDED.badges,
  highlights = EXCLUDED.highlights,
  includes = EXCLUDED.includes,
  excludes = EXCLUDED.excludes,
  schedule = EXCLUDED.schedule,
  itinerary_details = EXCLUDED.itinerary_details,
  faqs = EXCLUDED.faqs,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  pickup_points_count = EXCLUDED.pickup_points_count,
  dropoff_points_count = EXCLUDED.dropoff_points_count,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  translations = EXCLUDED.translations,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  updated_at = NOW();`;
}

/** One tour_product_pages upsert per locale, each embedding its own detail_payload. */
function buildTourProductPagesInserts(bundle, slug) {
  const blocks = [];
  const enDoc = bundle.en?.doc;
  if (!enDoc) {
    console.error(`[gen-tour-product-sql] missing bundle.en for ${slug}`);
    process.exit(1);
  }
  for (const [locale, entry] of Object.entries(bundle)) {
    const doc =
      locale === "en"
        ? { ...entry.doc }
        : mergeFullPageWithLocaleBase(enDoc, entry.doc);
    // page_sections are authoring-side snapshots; detail_payload doesn't need them.
    if ("page_sections" in doc) delete doc.page_sections;
    if (locale !== "en") {
      doc.locale = locale;
    }
    const detailPayloadJson = JSON.stringify(doc);

    const cc = asRecord(doc.catalog_card);
    const hero = asRecord(doc.hero);
    const price = asRecord(doc.price);
    const seo = asRecord(doc.seo);
    const badges = Array.isArray(cc.badges) ? cc.badges : [];

    blocks.push(`INSERT INTO public.tour_product_pages (
  slug, locale, product_id, is_published, sort_order, tour_id,
  title, subtitle, region_label, duration_label, stops_count,
  rating_avg, review_count, badges, hero_image_url, thumbnail_url,
  card_short_description, seo_title, meta_description,
  headline_line_1, headline_line_2,
  price_amount_label, price_currency, price_per, detail_payload
) VALUES (
  '${sqlEscapeLiteral(slug)}',
  '${sqlEscapeLiteral(locale)}',
  '${sqlEscapeLiteral(slug)}',
  TRUE,
  1,
  (SELECT id FROM public.tours WHERE slug = '${sqlEscapeLiteral(slug)}' LIMIT 1),
  ${sqlNullable(cc.title ?? "")},
  ${sqlNullable(cc.subtitle ?? "")},
  ${sqlNullable(cc.region ?? "")},
  ${sqlNullable(cc.duration ?? "")},
  ${Number(cc.stopsCount ?? 0)},
  ${Number(cc.rating ?? 0)},
  ${Number(cc.reviewCount ?? 0)},
  ${sqlTextArray(badges)},
  ${sqlNullable(cc.heroImage ?? hero.imageUrl ?? "")},
  ${sqlNullable(cc.thumbnail ?? "")},
  ${sqlNullable(cc.shortCardDescription ?? "")},
  ${sqlNullable(seo.pageTitle ?? "")},
  ${sqlNullable(seo.metaDescription ?? "")},
  ${sqlNullable(doc.headlineLine1 ?? "")},
  ${sqlNullable(doc.headlineLine2 ?? "")},
  ${sqlNullable(price.amountLabel ?? "")},
  ${sqlNullable(price.currency ?? "USD")},
  ${sqlNullable(price.per ?? "person")},
  '${sqlEscapeLiteral(detailPayloadJson)}'::jsonb
)
ON CONFLICT (slug, locale) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order,
  tour_id = EXCLUDED.tour_id,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  region_label = EXCLUDED.region_label,
  duration_label = EXCLUDED.duration_label,
  stops_count = EXCLUDED.stops_count,
  rating_avg = EXCLUDED.rating_avg,
  review_count = EXCLUDED.review_count,
  badges = EXCLUDED.badges,
  hero_image_url = EXCLUDED.hero_image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  card_short_description = EXCLUDED.card_short_description,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  headline_line_1 = EXCLUDED.headline_line_1,
  headline_line_2 = EXCLUDED.headline_line_2,
  price_amount_label = EXCLUDED.price_amount_label,
  price_currency = EXCLUDED.price_currency,
  price_per = EXCLUDED.price_per,
  detail_payload = EXCLUDED.detail_payload,
  updated_at = NOW();`);
  }
  return blocks.join("\n\n");
}

/** USD → minor units (cents). */
function usdMajorToMinor(major) {
  return Math.round(Number(major) * 100);
}

function buildTourProductOffersInsert(doc, slug) {
  const price = asRecord(doc.price);
  const amountLabel = price.amountLabel ?? String(resolveToursPrice(doc, slug));
  const usd = Number(String(amountLabel).replace(/[^0-9.]/g, ""));
  const amountMinor = Number.isFinite(usd) ? usdMajorToMinor(usd) : 0;
  const currency = price.currency ?? "USD";
  return `INSERT INTO public.tour_product_offers (
  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default
)
SELECT
  p.id,
  'Default (seed)',
  ${amountMinor},
  '${sqlEscapeLiteral(currency)}',
  NULL,
  TRUE,
  TRUE
FROM public.tour_product_pages p
WHERE p.slug = '${sqlEscapeLiteral(slug)}' AND p.locale = 'en'
  AND NOT EXISTS (
    SELECT 1 FROM public.tour_product_offers o
    WHERE o.tour_product_page_id = p.id AND o.is_default = TRUE AND o.is_active = TRUE
  );`;
}

function buildTourMatchingProfileInsert(doc, slug) {
  const mp = asRecord(doc.matching_profile);
  const get = (k, dflt) => (mp[k] !== undefined ? mp[k] : dflt);
  const required = (k) => {
    const v = mp[k];
    if (v === undefined) {
      console.error(`[gen-tour-product-sql] matching_profile.${k} is required for ${slug}`);
      process.exit(1);
    }
    return v;
  };

  return `INSERT INTO public.tour_matching_profiles (
  product_id, product_type, route_type, region_type,
  region_tags, theme_tags, poi_tags,
  pace_level, walking_level, scenic_level, photo_level, culture_level, relax_level,
  first_time_fit, family_fit, senior_fit, couple_fit, active_traveler_fit,
  one_day_fit, same_day_flight_fit, rain_fit, value_for_money_fit,
  iconic_landmark_fit, cafe_fit,
  adult_family_fit, young_kids_fit, senior_active_fit, senior_general_fit,
  mobility_friendly_fit, stroller_fit,
  indoor_ratio, weather_sensitivity,
  local_culture_fit, shopping_fit, storytelling_fit,
  comfort_level, budget_fit, premium_fit,
  small_group_fit, private_fit, bus_fit,
  price_band, pickup_base, return_time_band, duration_band, min_recommended_age,
  hard_constraints, walking_notes, keywords, synonym_hints,
  profile_version, is_active
)
VALUES (
  '${sqlEscapeLiteral(slug)}',
  '${sqlEscapeLiteral(required("product_type"))}',
  '${sqlEscapeLiteral(required("route_type"))}',
  '${sqlEscapeLiteral(required("region_type"))}',
  ${sqlJsonb(get("region_tags", []))},
  ${sqlJsonb(get("theme_tags", []))},
  ${sqlJsonb(get("poi_tags", []))},
  ${Number(required("pace_level"))},
  ${Number(required("walking_level"))},
  ${Number(required("scenic_level"))},
  ${Number(required("photo_level"))},
  ${Number(required("culture_level"))},
  ${Number(required("relax_level"))},
  ${Number(required("first_time_fit"))},
  ${Number(required("family_fit"))},
  ${Number(required("senior_fit"))},
  ${Number(required("couple_fit"))},
  ${Number(required("active_traveler_fit"))},
  ${Number(required("one_day_fit"))},
  ${Number(required("same_day_flight_fit"))},
  ${Number(required("rain_fit"))},
  ${Number(required("value_for_money_fit"))},
  ${Number(required("iconic_landmark_fit"))},
  ${Number(required("cafe_fit"))},
  ${Number(required("adult_family_fit"))},
  ${Number(required("young_kids_fit"))},
  ${Number(required("senior_active_fit"))},
  ${Number(required("senior_general_fit"))},
  ${Number(required("mobility_friendly_fit"))},
  ${Number(required("stroller_fit"))},
  ${Number(required("indoor_ratio"))},
  ${Number(required("weather_sensitivity"))},
  ${Number(required("local_culture_fit"))},
  ${Number(required("shopping_fit"))},
  ${Number(required("storytelling_fit"))},
  ${Number(required("comfort_level"))},
  ${Number(required("budget_fit"))},
  ${Number(required("premium_fit"))},
  ${Number(required("small_group_fit"))},
  ${Number(required("private_fit"))},
  ${Number(required("bus_fit"))},
  '${sqlEscapeLiteral(required("price_band"))}',
  '${sqlEscapeLiteral(required("pickup_base"))}',
  '${sqlEscapeLiteral(required("return_time_band"))}',
  '${sqlEscapeLiteral(required("duration_band"))}',
  ${Number(required("min_recommended_age"))},
  ${sqlJsonb(get("hard_constraints", { avoidIf: [], notIdealFor: [] }))},
  ${sqlJsonb(get("walking_notes", []))},
  ${sqlJsonb(get("keywords", []))},
  ${sqlJsonb(get("synonym_hints", []))},
  ${Number(get("profile_version", 1))},
  ${sqlBool(get("is_active", true))}
)
ON CONFLICT (product_id) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  route_type = EXCLUDED.route_type,
  region_type = EXCLUDED.region_type,
  region_tags = EXCLUDED.region_tags,
  theme_tags = EXCLUDED.theme_tags,
  poi_tags = EXCLUDED.poi_tags,
  pace_level = EXCLUDED.pace_level,
  walking_level = EXCLUDED.walking_level,
  scenic_level = EXCLUDED.scenic_level,
  photo_level = EXCLUDED.photo_level,
  culture_level = EXCLUDED.culture_level,
  relax_level = EXCLUDED.relax_level,
  first_time_fit = EXCLUDED.first_time_fit,
  family_fit = EXCLUDED.family_fit,
  senior_fit = EXCLUDED.senior_fit,
  couple_fit = EXCLUDED.couple_fit,
  active_traveler_fit = EXCLUDED.active_traveler_fit,
  one_day_fit = EXCLUDED.one_day_fit,
  same_day_flight_fit = EXCLUDED.same_day_flight_fit,
  rain_fit = EXCLUDED.rain_fit,
  value_for_money_fit = EXCLUDED.value_for_money_fit,
  iconic_landmark_fit = EXCLUDED.iconic_landmark_fit,
  cafe_fit = EXCLUDED.cafe_fit,
  adult_family_fit = EXCLUDED.adult_family_fit,
  young_kids_fit = EXCLUDED.young_kids_fit,
  senior_active_fit = EXCLUDED.senior_active_fit,
  senior_general_fit = EXCLUDED.senior_general_fit,
  mobility_friendly_fit = EXCLUDED.mobility_friendly_fit,
  stroller_fit = EXCLUDED.stroller_fit,
  indoor_ratio = EXCLUDED.indoor_ratio,
  weather_sensitivity = EXCLUDED.weather_sensitivity,
  local_culture_fit = EXCLUDED.local_culture_fit,
  shopping_fit = EXCLUDED.shopping_fit,
  storytelling_fit = EXCLUDED.storytelling_fit,
  comfort_level = EXCLUDED.comfort_level,
  budget_fit = EXCLUDED.budget_fit,
  premium_fit = EXCLUDED.premium_fit,
  small_group_fit = EXCLUDED.small_group_fit,
  private_fit = EXCLUDED.private_fit,
  bus_fit = EXCLUDED.bus_fit,
  price_band = EXCLUDED.price_band,
  pickup_base = EXCLUDED.pickup_base,
  return_time_band = EXCLUDED.return_time_band,
  duration_band = EXCLUDED.duration_band,
  min_recommended_age = EXCLUDED.min_recommended_age,
  hard_constraints = EXCLUDED.hard_constraints,
  walking_notes = EXCLUDED.walking_notes,
  keywords = EXCLUDED.keywords,
  synonym_hints = EXCLUDED.synonym_hints,
  profile_version = EXCLUDED.profile_version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();`;
}

function main() {
  const { slug, outPath, locales } = parseArgs(process.argv);
  let bundle = loadLocaleBundle(slug);
  if (locales) {
    const filtered = {};
    for (const l of locales) {
      if (bundle[l]) filtered[l] = bundle[l];
    }
    bundle = filtered;
  }
  const enDoc = bundle.en.doc;

  // Hard gate: matching_profile must satisfy pipeline contract.
  assertMatchingProfileOrExit(enDoc.matching_profile, {
    sourceLabel: `${slug}.en.json#matching_profile`,
  });

  const now = new Date().toISOString();
  const localesEmitted = Object.keys(bundle);

  const toursSql = buildToursInsert(enDoc, slug);
  const pagesSql = buildTourProductPagesInserts(bundle, slug);
  const offersSql = buildTourProductOffersInsert(enDoc, slug);
  const matchingSql = buildTourMatchingProfileInsert(enDoc, slug);

  const sql = `-- =============================================================================
-- ${slug} — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: ${now}
-- Script: scripts/gen-tour-product-sql.mjs
-- Locales emitted: ${localesEmitted.join(", ")}
-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);
--            tour_product_offers inserted only when no default offer exists;
--            tour_matching_profiles ON CONFLICT (product_id)
-- Web: /tour-product/${slug}
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) tours — booking + /tour/[id] checkout
-- ---------------------------------------------------------------------------
${toursSql}

-- ---------------------------------------------------------------------------
-- 2) tour_product_pages — marketing detail + detail_payload (view-model)
-- ---------------------------------------------------------------------------
${pagesSql}

-- ---------------------------------------------------------------------------
-- 3) tour_product_offers — sticky bar / checkout (USD minor units)
-- ---------------------------------------------------------------------------
${offersSql}

-- ---------------------------------------------------------------------------
-- 4) tour_matching_profiles — recommendation / match pipeline
-- ---------------------------------------------------------------------------
${matchingSql}

COMMIT;

SELECT slug, title, is_active FROM public.tours WHERE slug = '${sqlEscapeLiteral(slug)}';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = '${sqlEscapeLiteral(slug)}' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = '${sqlEscapeLiteral(slug)}';
`;

  writeFileSync(outPath, sql, "utf8");
  console.log(`[gen-tour-product-sql] wrote ${outPath} (${localesEmitted.length} locales)`);
}

main();
