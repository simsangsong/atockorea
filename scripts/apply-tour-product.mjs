/**
 * Apply a tour-product slug's data directly to Supabase.
 *
 * Mirrors `scripts/gen-tour-product-sql.mjs` but writes via @supabase/supabase-js
 * (service-role key) instead of emitting an SQL file. Used during the 30-tour
 * migration when the read-only MCP path is unavailable.
 *
 * Usage:
 *   node scripts/apply-tour-product.mjs <slug> [--locales en]
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

import { assertMatchingProfileOrExit } from "./_lib/matching-profile-validator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local manually (no dotenv dep assumed)
function loadDotEnv(p) {
  const out = {};
  if (!existsSync(p)) return out;
  const text = readFileSync(p, "utf8").replace(/\r/g, "");
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).replace(/^"|"$/g, "");
    out[k] = v;
  }
  return out;
}
const env = { ...loadDotEnv(join(root, ".env.local")), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[apply-tour-product] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

function parseArgs(argv) {
  const [, , slug, ...rest] = argv;
  if (!slug || slug.startsWith("-")) {
    console.error("Usage: node scripts/apply-tour-product.mjs <slug> [--locales en]");
    process.exit(1);
  }
  const opts = { slug, locales: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--locales" && rest[i + 1]) {
      opts.locales = rest[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (opts.locales && !opts.locales.includes("en")) {
    console.error("[apply-tour-product] --locales must include 'en'");
    process.exit(1);
  }
  return opts;
}

function asRecord(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

function loadLocaleBundle(slug) {
  const dir = join(root, `components/product-tour-static/${slug}`);
  if (!existsSync(dir)) {
    console.error(`[apply-tour-product] directory not found: ${dir}`);
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
    console.error(`[apply-tour-product] missing English JSON in ${dir}`);
    process.exit(1);
  }
  bundle.en = JSON.parse(readFileSync(enPath, "utf8"));
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const p = join(dir, `${slug}.${locale}.json`);
    if (existsSync(p)) bundle[locale] = JSON.parse(readFileSync(p, "utf8"));
  }
  return bundle;
}

function mergeFullPageWithLocaleBase(en, loc) {
  const merged = { ...en, ...loc };
  if (loc?.sectionUi && typeof loc.sectionUi === "object" && en?.sectionUi && typeof en.sectionUi === "object") {
    merged.sectionUi = { ...en.sectionUi, ...loc.sectionUi };
  } else if (loc?.sectionUi) {
    merged.sectionUi = loc.sectionUi;
  }
  return merged;
}

const TOURS_CITY_ALLOWED = ["Seoul", "Busan", "Jeju"];
function resolveToursCity(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  if (overrides.city && TOURS_CITY_ALLOWED.includes(overrides.city)) return overrides.city;
  const haystack = [cc.region, cc.title, cc.subtitle, slug]
    .filter((v) => typeof v === "string" && v.length > 0)
    .join(" | ")
    .toLowerCase();
  for (const city of TOURS_CITY_ALLOWED) {
    if (haystack.includes(city.toLowerCase())) return city;
  }
  return "Jeju";
}

function resolveToursPrice(doc) {
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
  return 0;
}

/**
 * Load `data/tour-policies/pricing-rules.json` and look up a (destination_region, product_type)
 * pair. Returns `{ price, originalPrice, currency }` if a rule matches, else null.
 * Author overrides via `sql_overrides.tours.price` / `original_price` always win over rules.
 */
let _pricingRulesCache = null;
function loadPricingRules() {
  if (_pricingRulesCache !== null) return _pricingRulesCache;
  const p = join(root, "data/tour-policies/pricing-rules.json");
  if (!existsSync(p)) {
    _pricingRulesCache = { rules: [] };
    return _pricingRulesCache;
  }
  try {
    _pricingRulesCache = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.warn(`[apply-tour-product] could not parse pricing-rules.json:`, e?.message ?? e);
    _pricingRulesCache = { rules: [] };
  }
  return _pricingRulesCache;
}

function resolvePolicyPrice(doc) {
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  if (overrides.price != null || overrides.original_price != null) {
    return null; // explicit override — let caller use overrides + JSON
  }
  const mp = asRecord(doc.matching_profile);
  const dest = String(mp.destination_region ?? "").toLowerCase();
  const productType = String(mp.product_type ?? "");
  if (!dest || !productType) return null;
  const { rules } = loadPricingRules();
  if (!Array.isArray(rules)) return null;
  const match = rules.find(
    (r) => String(r.destination_region).toLowerCase() === dest && String(r.product_type) === productType,
  );
  if (!match) return null;
  return {
    price: Number(match.price),
    originalPrice: match.original_price != null ? Number(match.original_price) : null,
    currency: match.currency || "USD",
  };
}

function buildToursRow(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const overrides = asRecord(asRecord(doc.sql_overrides).tours);
  const policyPrice = resolvePolicyPrice(doc);
  const price = policyPrice ? policyPrice.price : resolveToursPrice(doc);
  const policyOriginalPrice = policyPrice ? policyPrice.originalPrice : null;
  const city = resolveToursCity(doc, slug);
  const priceCurrency = policyPrice
    ? policyPrice.currency
    : (asRecord(doc.price).currency ?? "USD");
  const heroImage = cc.heroImage ?? asRecord(doc.hero).imageUrl ?? "";
  const gallery = Array.isArray(doc.galleryItems)
    ? doc.galleryItems.map((g) => g?.src).filter((u) => typeof u === "string" && u.length > 0)
    : [];
  const itinerarySummary = Array.isArray(doc.itineraryStops)
    ? doc.itineraryStops.map((s) => ({
        time: s?.time ?? "",
        title: s?.name ?? "",
        description: s?.category ?? "",
      }))
    : [];

  return {
    title: cc.title ?? slug,
    slug,
    city,
    tag: overrides.tag ?? `Small group · ${cc.region ?? ""}`.trim(),
    subtitle: cc.subtitle ?? "",
    description: overrides.description ?? cc.shortCardDescription ?? "",
    highlight: overrides.highlight ?? cc.subtitle ?? "",
    price: Number(price.toFixed(2)),
    original_price:
      overrides.original_price ??
      policyOriginalPrice ??
      cc.compareAtPriceUsd ??
      null,
    price_currency: priceCurrency,
    price_type: overrides.price_type ?? asRecord(doc.price).per ?? "person",
    image_url: heroImage,
    gallery_images: gallery,
    duration: overrides.duration ?? cc.duration ?? "",
    difficulty: overrides.difficulty ?? "Moderate",
    group_size: overrides.group_size ?? "Small group",
    lunch_included: overrides.lunch_included ?? false,
    ticket_included: overrides.ticket_included ?? false,
    pickup_info: overrides.pickup_info ?? "Pickup confirmed after booking.",
    notes: overrides.notes ?? "Weather and operational conditions may shift the stop order or duration.",
    badges: Array.isArray(cc.badges) ? cc.badges : [],
    highlights: overrides.highlights ?? [],
    includes: overrides.includes ?? [],
    excludes: overrides.excludes ?? [],
    schedule: overrides.schedule ?? itinerarySummary,
    itinerary_details: overrides.itinerary_details ?? [],
    faqs: overrides.faqs ?? [],
    rating: Number(cc.rating ?? 0),
    review_count: Number(cc.reviewCount ?? 0),
    pickup_points_count: Number(overrides.pickup_points_count ?? 2),
    dropoff_points_count: Number(overrides.dropoff_points_count ?? 0),
    is_active: overrides.is_active ?? true,
    is_featured: overrides.is_featured ?? false,
    translations: overrides.translations ?? {},
    seo_title: overrides.seo_title ?? asRecord(doc.seo).pageTitle ?? cc.title ?? slug,
    meta_description: overrides.meta_description ?? asRecord(doc.seo).metaDescription ?? cc.shortCardDescription ?? "",
  };
}

function buildPagesRow(doc, slug, locale, tourId) {
  const merged = locale === "en" ? { ...doc } : doc;
  if ("page_sections" in merged) delete merged.page_sections;
  if (locale !== "en") merged.locale = locale;

  // Apply pricing policy to the merged detail_payload so the page's hero/sticky
  // bar reads the policy price (not the JSON's authored amount).
  const policyPrice = resolvePolicyPrice(doc);
  if (policyPrice) {
    const existingPrice = asRecord(merged.price);
    merged.price = {
      ...existingPrice,
      amountLabel: String(policyPrice.price),
      currency: policyPrice.currency,
      originalAmountLabel:
        policyPrice.originalPrice != null ? String(policyPrice.originalPrice) : undefined,
    };
    if (merged.sticky_booking_bar && typeof merged.sticky_booking_bar === "object") {
      const sb = merged.sticky_booking_bar;
      merged.sticky_booking_bar = {
        ...sb,
        price: {
          ...(sb.price ?? {}),
          amountLabel: String(policyPrice.price),
          currency: policyPrice.currency,
          originalAmountLabel:
            policyPrice.originalPrice != null ? String(policyPrice.originalPrice) : undefined,
        },
      };
    }
  }

  const cc = asRecord(merged.catalog_card);
  const hero = asRecord(merged.hero);
  const price = asRecord(merged.price);
  const seo = asRecord(merged.seo);

  return {
    slug,
    locale,
    product_id: slug,
    is_published: true,
    sort_order: 1,
    tour_id: tourId,
    title: cc.title ?? "",
    subtitle: cc.subtitle ?? "",
    region_label: cc.region ?? "",
    duration_label: cc.duration ?? "",
    stops_count: Number(cc.stopsCount ?? 0),
    rating_avg: Number(cc.rating ?? 0),
    review_count: Number(cc.reviewCount ?? 0),
    badges: Array.isArray(cc.badges) ? cc.badges : [],
    hero_image_url: cc.heroImage ?? hero.imageUrl ?? "",
    thumbnail_url: cc.thumbnail ?? "",
    card_short_description: cc.shortCardDescription ?? "",
    seo_title: seo.pageTitle ?? "",
    meta_description: seo.metaDescription ?? "",
    headline_line_1: merged.headlineLine1 ?? "",
    headline_line_2: merged.headlineLine2 ?? "",
    price_amount_label: price.amountLabel ?? "",
    price_currency: price.currency ?? "USD",
    price_per: price.per ?? "person",
    detail_payload: merged,
  };
}

function usdMajorToMinor(major) {
  return Math.round(Number(major) * 100);
}

async function apply(slug, locales) {
  let bundle = loadLocaleBundle(slug);
  if (locales) {
    const filtered = {};
    for (const l of locales) if (bundle[l]) filtered[l] = bundle[l];
    bundle = filtered;
  }
  const enDoc = bundle.en;
  if (!enDoc) {
    console.error(`[apply-tour-product] no EN doc for ${slug}`);
    process.exit(1);
  }
  assertMatchingProfileOrExit(enDoc.matching_profile, { sourceLabel: `${slug}.en.json#matching_profile` });

  // 1) tours
  const toursRow = buildToursRow(enDoc, slug);
  const { data: toursData, error: toursErr } = await supabase
    .from("tours")
    .upsert(toursRow, { onConflict: "slug" })
    .select("id, slug")
    .single();
  if (toursErr) {
    console.error(`[apply-tour-product] tours upsert failed:`, toursErr);
    process.exit(1);
  }
  const tourId = toursData.id;
  console.log(`  ✓ tours: id=${tourId} slug=${toursData.slug}`);

  // 2) tour_product_pages — one per locale
  const localesEmitted = Object.keys(bundle);
  for (const loc of localesEmitted) {
    const baseDoc =
      loc === "en" ? bundle.en : mergeFullPageWithLocaleBase(bundle.en, bundle[loc]);
    const pagesRow = buildPagesRow(baseDoc, slug, loc, tourId);
    const { error: pagesErr } = await supabase
      .from("tour_product_pages")
      .upsert(pagesRow, { onConflict: "slug,locale" });
    if (pagesErr) {
      console.error(`[apply-tour-product] tour_product_pages [${loc}] upsert failed:`, pagesErr);
      process.exit(1);
    }
    console.log(`  ✓ tour_product_pages: locale=${loc}`);
  }

  // 3) tour_product_offers — only if no default exists
  const { data: pageRow } = await supabase
    .from("tour_product_pages")
    .select("id")
    .eq("slug", slug)
    .eq("locale", "en")
    .single();
  if (pageRow) {
    const policyPrice = resolvePolicyPrice(enDoc);
    const price = asRecord(enDoc.price);
    const usd = policyPrice
      ? policyPrice.price
      : Number(String(price.amountLabel ?? resolveToursPrice(enDoc)).replace(/[^0-9.]/g, ""));
    const amountMinor = Number.isFinite(usd) ? usdMajorToMinor(usd) : 0;
    const currency = policyPrice ? policyPrice.currency : (price.currency ?? "USD");

    const { data: existingOffer } = await supabase
      .from("tour_product_offers")
      .select("id, amount_minor, currency")
      .eq("tour_product_page_id", pageRow.id)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (!existingOffer) {
      const { error: offerErr } = await supabase.from("tour_product_offers").insert({
        tour_product_page_id: pageRow.id,
        label: "Default (seed)",
        amount_minor: amountMinor,
        currency,
        stripe_price_id: null,
        is_active: true,
        is_default: true,
      });
      if (offerErr) {
        console.error(`[apply-tour-product] tour_product_offers insert failed:`, offerErr);
        process.exit(1);
      }
      console.log(`  ✓ tour_product_offers: amount_minor=${amountMinor}`);
    } else if (existingOffer.amount_minor !== amountMinor || existingOffer.currency !== currency) {
      const { error: updErr } = await supabase
        .from("tour_product_offers")
        .update({ amount_minor: amountMinor, currency })
        .eq("id", existingOffer.id);
      if (updErr) {
        console.error(`[apply-tour-product] tour_product_offers update failed:`, updErr);
        process.exit(1);
      }
      console.log(
        `  ✓ tour_product_offers: updated amount_minor ${existingOffer.amount_minor} → ${amountMinor}`,
      );
    } else {
      console.log(`  · tour_product_offers: default already at amount_minor=${amountMinor}, no change`);
    }
  }

  console.log("  • matching: handled by match_tours via scripts/import-match-v18.mjs");
}

const { slug, locales } = parseArgs(process.argv);
console.log(`[apply-tour-product] applying ${slug} (locales: ${locales ? locales.join(",") : "all available"})`);
await apply(slug, locales);
console.log(`[apply-tour-product] ✅ done: ${slug}`);
