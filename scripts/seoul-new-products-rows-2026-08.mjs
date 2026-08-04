#!/usr/bin/env node
/**
 * Row builder for the two 2026-08-04 Seoul-departure products.
 *
 * Single source of truth shared by:
 *   - gen-seoul-new-products-sql-2026-08.mjs   (writes supabase/pending-db-apply/*.sql)
 *   - apply-seoul-new-products-2026-08.mjs     (upserts straight over supabase-js)
 *
 * They exist as two paths because the SQL files need `psql` plus a Postgres
 * connection string, and not every machine that has the repo has either. Both
 * must produce the same rows, so neither may own the field mapping.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

export const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
export const EXT_LOCALES = ["de", "fr", "it", "ru"];

export const PRODUCTS = [
  {
    slug: "seoul-gapyeong-nami-morning-calm-petite-france-day-tour",
    mainFile: "2026-08-04-08-seoul-gapyeong-new-product.sql",
    stagedFile: "2026-08-04-09-seoul-gapyeong-staged-locales.sql",
    city: "Seoul",
    tag: "Day trip from Seoul · Gapyeong",
    duration: "11.5 hours",
    difficulty: "Easy",
    groupSize: "Join-in group (up to 40)",
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
    mainFile: "2026-08-04-10-seoul-winter-eobi-new-product.sql",
    stagedFile: "2026-08-04-11-seoul-winter-eobi-staged-locales.sql",
    city: "Seoul",
    tag: "Winter only · Seoraksan & Gapyeong",
    duration: "13.5 hours",
    difficulty: "Moderate",
    groupSize: "Join-in group (up to 40)",
    offerLabel: "Winter day tour (Seoraksan, Nami Island & Eobi Valley)",
    pickupInfo:
      "Two Seoul pickup points — Starbucks Hongik University Station Exit 8 at 06:00, or Myeongdong Station Exit 2 at 06:30. Choose at booking. Drop-offs: Myeongdong ≈19:00, Hongik University ≈19:30.",
    notes:
      "WINTER-SEASON PRODUCT — do not open year-round sales. The Eobi Valley ice wall is built by villagers of Garil 2-ri each winter and is NOT guaranteed: it forms from around mid-December, is most reliable through January and early February, and the 2025-26 season ran 20 December to 19 February per the village's own site. Sold provisionally as mid-December to mid-February; dates are set by the village each year and must be confirmed with Garil 2-ri (031-585-3551) before opening dates for sale. OPS RISK: the village publishes 10:00-17:00 for the festival ground and this itinerary reaches Eobi ≈16:45, so the paid activities may already be closing — the guide should call ahead on the day. Seoraksan park entry is free; the cable car (₩16,000) is excluded and weather-dependent. Nami ferry + admission (₩19,000) included. Eobi charges small on-site village fees (~₩1,000 viewing, sled/activity passes ₩5,000-30,000) that are NOT included; parking at the village-entrance lot is free and the festival ground is a ~500 m deck walk from it. Lunch own expense.",
    header: [
      "Course: Seoul pickup 06:00/06:30 → Seoraksan National Park (self-guided) →",
      "        lunch (own expense) → Nami Island → Eobi Valley ice wall → Seoul.",
      "SEASONAL: winter only. The ice wall is an ARTIFICIAL structure built each",
      "winter by Garil 2-ri villagers — it exists only while the cold holds.",
    ],
  },
];

const ABS = "https://www.atockorea.com";

export function bundleDir(slug) {
  return path.join(ROOT, "components/product-tour-static", slug);
}

export function loadBundle(slug, loc) {
  return JSON.parse(readFileSync(path.join(bundleDir(slug), `${slug}.${loc}.json`), "utf8"));
}

export function stagedLocalesPresent(slug) {
  return EXT_LOCALES.filter((loc) =>
    existsSync(path.join(bundleDir(slug), `${slug}.${loc}.json`)),
  );
}

/**
 * Build every row this product needs, keyed by table. Values are plain JS —
 * the SQL writer quotes them, the direct applier hands them to supabase-js.
 */
export function buildRows(cfg) {
  const en = loadBundle(cfg.slug, "en");
  const cc = en.catalog_card;
  const seo = en.seo;
  const priceUsd = Number(en.price.salePriceUsd);
  const heroAbs = `${ABS}${cc.heroImage}`;
  const galleryImages = [heroAbs].concat(
    (en.galleryItems || []).slice(0, 4).map((g) => `${ABS}${g.src}`),
  );
  const schedule = en.itineraryStops.map((s) => ({
    time: s.time,
    title: s.name,
    description: s.category || "",
  }));

  const tour = {
    title: cc.title,
    slug: cfg.slug,
    city: cfg.city,
    tag: cfg.tag,
    subtitle: cc.subtitle,
    description: cc.shortCardDescription,
    highlight: cc.subtitle,
    price: priceUsd,
    original_price: null,
    price_currency: "USD",
    price_type: "person",
    image_url: galleryImages[0],
    gallery_images: galleryImages,
    duration: cfg.duration,
    difficulty: cfg.difficulty,
    group_size: cfg.groupSize,
    lunch_included: false,
    ticket_included: true,
    pickup_info: cfg.pickupInfo,
    notes: cfg.notes,
    badges: cc.badges || [],
    highlights: [],
    includes: [],
    excludes: [],
    schedule,
    itinerary_details: [],
    faqs: [],
    rating: 0,
    review_count: 0,
    pickup_points_count: 2,
    dropoff_points_count: 2,
    is_active: true,
    is_featured: false,
    translations: {},
    seo_title: seo.pageTitle,
    meta_description: seo.metaDescription,
  };

  const pageRow = (b, loc) => {
    const lcc = b.catalog_card || {};
    const lseo = b.seo || {};
    return {
      slug: cfg.slug,
      locale: loc,
      product_id: cfg.slug,
      is_published: true,
      sort_order: 1,
      title: lcc.title || cc.title,
      subtitle: lcc.subtitle || "",
      region_label: lcc.region || cfg.city,
      duration_label: lcc.duration || cfg.duration,
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
      price_per: "person",
      detail_payload: b,
    };
  };

  return {
    priceUsd,
    tour,
    pages: LOCALES.map((loc) => pageRow(loc === "en" ? en : loadBundle(cfg.slug, loc), loc)),
    stagedPages: stagedLocalesPresent(cfg.slug).map((loc) =>
      pageRow(loadBundle(cfg.slug, loc), loc),
    ),
    offer: {
      label: cfg.offerLabel,
      amount_minor: priceUsd * 100,
      currency: "USD",
      stripe_price_id: null,
      is_active: true,
      is_default: true,
    },
  };
}
