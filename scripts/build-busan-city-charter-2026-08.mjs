#!/usr/bin/env node
/**
 * Builds `busan-private-car-charter-city-tour` — the downtown Busan private
 * charter (owner instruction 2026-08-07).
 *
 * 🔴 WHY IT EXISTS. Busan had exactly one private charter, and it was the cruise
 * shore-excursion SKU. Its own `pickup_dropoff.notes` said, in production:
 *
 *     "Hotel pickup is not offered on this SKU; for hotel-based pickup, see our
 *      separate private Busan day-charter."
 *
 * There was no separate private Busan day-charter. The page had been pointing at
 * a product that did not exist. Seoul and Jeju both have the hotel-based sibling
 * (`seoul-suburbs-private-chartered-car-10hr`, `jeju-island-private-car-charter-tour`);
 * Busan was the hole. This fills it, and the cruise SKU's dangling note becomes
 * true.
 *
 * ── The route drawers are IMPORTED, not written ───────────────────────────────
 * Owner: "이미 있는 일정 서랍들, 부산 데이투어, 부산 스몰그룹, 부산 기항지 데이투어
 * 일정 서랍들을 import 해서 추천 일정으로."
 *
 * So each recommended route is generated from the real, live itinerary of the
 * product it comes from — `itineraryStops` read out of that product's own bundle
 * FOR THE SAME LOCALE. Two consequences worth stating, because they are the
 * reason it is done this way rather than by copying text:
 *
 *   ① The Korean page lists the Korean stop names, the Japanese page the
 *      Japanese ones, and so on, with zero new translation. Nothing here invents
 *      a localized string.
 *   ② If a source tour is re-coursed, re-running this script re-imports it. The
 *      recommendation cannot silently drift from the tour it describes — which
 *      is exactly what copy-pasted itineraries do.
 *
 * Transit stops (pickup / drop-off) are dropped: on a private charter the guest
 * is collected at their own hotel, so the join-in tour's station-meeting chain is
 * not part of what is being recommended.
 *
 * ── Pricing (owner, 2026-08-07) ──────────────────────────────────────────────
 * A duration grid, not a flat rate — the opposite of the cruise sibling:
 *
 *     5h ₩230,000 · 6h ₩260,000 · 7h ₩290,000 · 8h ₩320,000 · 9h ₩360,000
 *     1–7 pax one vehicle · 8+ pax a second vehicle, so twice the cell
 *     Gimhae Airport pickup or drop-off +₩50,000 · Gyeongju +₩80,000
 *     each hour past 9h +₩50,000
 *
 * Converted at 1,423.48 KRW/USD (live rate the day it was set) and rounded to
 * the nearest $5 — every cell lands within 2.1% of the won figure. The same rule
 * produced the cruise charter's $265, so the two are re-derivable from one line.
 *
 * ⚠ 9h is ₩360,000 as the owner stated it, i.e. +₩40,000 over 8h, while every
 * hour past 9h adds ₩50,000. The two sentences in the instruction imply
 * different 9-hour prices (₩360,000 vs 8h+₩50,000 = ₩370,000); the explicit
 * figure wins and the +₩50,000 rule starts at the 10th hour. Flagged, not
 * silently reconciled.
 *
 * Output: components/product-tour-static/busan-private-car-charter-city-tour/*.json
 * Run: node scripts/build-busan-city-charter-2026-08.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.join(ROOT, "components", "product-tour-static");
const SLUG = "busan-private-car-charter-city-tour";
/** Structural donor — the Busan private charter that already exists. */
const DONOR = "busan-private-car-charter-cruise-shore";
const OUT_DIR = path.join(STATIC_ROOT, SLUG);
const CONTENT_DIR = path.join(__dirname, "busan-city-charter-content");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const HERO_IMG = "/images/tours/gamcheon-culture-village/01-kakaotalk-20260510-222952680-01.webp";

/**
 * The three products whose itineraries become the recommended routes, in the
 * order the owner named them. `drop` removes transit stops by index (negative
 * counts from the end) — checked against the source length at build time so a
 * re-coursed donor fails loudly instead of quietly recommending its own pickup.
 */
const ROUTE_SOURCES = [
  { key: "highlights", slug: "busan-top-attractions-day-tour", drop: [0], expect: 7 },
  { key: "skycapsule", slug: "busan-small-group-yonggungsa-skycapsule-gamcheon-tour", drop: [0, -1], expect: 9 },
  { key: "coastal", slug: "busan-cruise-shore-excursion-bus-tour", drop: [0, -1], expect: 12 },
];

/** Rate card. Locale-invariant by design — `pricingTiers` is FORBIDDEN for
 *  translation (lib/i18n/pipeline/segments.ts), because the duration strings are
 *  lookup keys as well as labels. `chargeDurationLabel.ts` renders them. */
const DURATIONS = ["5h", "6h", "7h", "8h", "9h"];
const ONE_VEHICLE = { "5h": 160, "6h": 185, "7h": 205, "8h": 225, "9h": 255 };
const PRICING_TIERS = {
  currency: "USD",
  unit: "vehicle",
  durations: DURATIONS.slice(),
  tiers: [
    { paxLabel: "1–7 pax", paxMin: 1, paxMax: 7, prices: { ...ONE_VEHICLE } },
    {
      paxLabel: "8+ pax",
      paxMin: 8,
      paxMax: 14,
      prices: Object.fromEntries(DURATIONS.map((d) => [d, ONE_VEHICLE[d] * 2])),
    },
  ],
};
const FROM_USD = ONE_VEHICLE["5h"];
const PRICE = { amountLabel: String(FROM_USD), currency: "USD", per: "vehicle", salePriceUsd: FROM_USD };

/** Locale-invariant matcher metadata (EN across all bundles, donor convention). */
const MATCHING_METADATA = {
  primary_themes: ["busan", "private_charter", "customizable_route", "city_highlights", "coastal"],
  secondary_themes: [
    "seaside_temple",
    "culture_village",
    "sky_capsule",
    "market",
    "hotel_pickup",
    "airport_transfer_addon",
    "gyeongju_extension",
  ],
  best_for: ["families", "small_private_groups", "seniors", "first_time_busan", "flexible_planners"],
  not_recommended_for: ["solo_budget_travelers", "fixed_itinerary_seekers", "large_coach_groups"],
  anchor_pois: [
    "Haedong Yonggungsa Temple",
    "Gamcheon Culture Village",
    "Haeundae Blueline Park Sky Capsule",
    "Jagalchi Market",
    "UN Memorial Cemetery in Korea",
    "Songdo Cloud Trails Skywalk",
  ],
  anchor_poi_keys: [
    "haedong_yonggungsa",
    "gamcheon_culture_village",
    "cheongsapo_blue_line_park",
    "jagalchi_market",
    "un_memorial_cemetery",
    "songdo_skywalk",
  ],
  competing_products: [
    "busan-private-car-charter-cruise-shore",
    "busan-top-attractions-day-tour",
    "busan-small-group-yonggungsa-skycapsule-gamcheon-tour",
  ],
  reviews_attribution: "New product (2026-08) — no imported reviews; rating starts at 0.",
  unesco_fit_note:
    "No UNESCO property on these routes. Cultural weight comes from the 1376 seaside temple, the Korean-War refugee hillside at Gamcheon, and the UN Memorial Cemetery.",
};

const clone = (v) => JSON.parse(JSON.stringify(v));

const readBundle = (slug, loc) =>
  JSON.parse(readFileSync(path.join(STATIC_ROOT, slug, `${slug}.${loc}.json`), "utf8"));

/**
 * `**bold**` only renders inside itineraryStops.highlights / description /
 * whyOnRoute / smartNotes.tip — everywhere else the guest reads the asterisks
 * (see __tests__/audit/bundleUnrenderedMarkup.test.ts). Imported source strings
 * land in `timeUsed` and `category` too, so strip it on the way in rather than
 * trusting every donor to be clean.
 */
const plain = (s) => String(s ?? "").replace(/\*\*/g, "").trim();

/** "75分。" → "75分" — one donor's ja durations carry a trailing full stop that
 *  reads wrong inside parentheses. Cosmetic only, and only on import. */
const trimDuration = (s) => plain(s).replace(/[。.\s]+$/, "");

function importedRoute(sourceSlug, loc, drop, expect) {
  const src = readBundle(sourceSlug, loc);
  const stops = src.itineraryStops ?? [];
  if (stops.length !== expect) {
    throw new Error(
      `[${loc}] ${sourceSlug}: expected ${expect} stops, found ${stops.length}. ` +
        `The source was re-coursed — re-check the drop indexes before re-importing.`,
    );
  }
  const dropIdx = new Set(drop.map((d) => (d < 0 ? stops.length + d : d)));
  const kept = stops.filter((_, i) => !dropIdx.has(i));
  if (!kept.length) throw new Error(`[${loc}] ${sourceSlug}: every stop was dropped`);

  return {
    /** Stop names, in order — the drawer's bullet list. */
    highlights: kept.map((s) => plain(s.name)),
    /** The source tour's own clock, so the recommendation stays checkable. */
    timeUsed: kept.map((s) => {
      const d = trimDuration(s.duration);
      return d ? `${plain(s.time)} · ${plain(s.name)} (${d})` : `${plain(s.time)} · ${plain(s.name)}`;
    }),
    /** First photo of each stop that has one — capped so the drawer stays light. */
    images: kept
      .map((s) => (Array.isArray(s.images) && s.images.length ? s.images[0] : s.image))
      .filter((u) => typeof u === "string" && u)
      .slice(0, 6),
    stopCount: kept.length,
  };
}

function galleryFor(name, srcs, startId) {
  return srcs.map((src, i) => ({
    id: startId + i,
    type: "photo",
    src,
    location: name,
    caption: `${name} — ${i + 1}`,
    alt: `${name} — gallery image ${i + 1}`,
  }));
}

function build(loc) {
  const donor = readBundle(DONOR, loc);
  const c = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));

  if (c.routes.length !== ROUTE_SOURCES.length) {
    throw new Error(`[${loc}] content has ${c.routes.length} routes, builder imports ${ROUTE_SOURCES.length}`);
  }

  // ---- route drawers -------------------------------------------------------
  const itineraryStops = [];
  let galleryItems = [];
  let gid = 1;

  ROUTE_SOURCES.forEach((rs, i) => {
    const imported = importedRoute(rs.slug, loc, rs.drop, rs.expect);
    const authored = c.routes[i];
    const images = imported.images;
    const gal = galleryFor(authored.name, images, gid);
    gid += gal.length;
    galleryItems = galleryItems.concat(gal);

    itineraryStops.push({
      number: i + 1,
      time: authored.fits,
      duration: authored.duration,
      name: authored.name,
      category: authored.category,
      description: authored.description,
      image: images[0] ?? null,
      images: images.slice(),
      imageCredits: images.map((url) => ({ url, source: "atoc-korea" })),
      galleryItems: gal,
      highlights: imported.highlights,
      timeUsed: imported.timeUsed,
      whyOnRoute: authored.whyOnRoute,
      _poi_meta: {
        match: "route_variant_no_single_poi",
        poi_key: `route_variant_${rs.key}`,
        imported_from: rs.slug,
        imported_stop_count: imported.stopCount,
        verified: true,
        verified_date: "2026-08-07",
        note:
          `Recommended route imported from ${rs.slug} at build time (owner instruction ` +
          `2026-08-07). Stop names and times are that product's own, per locale — ` +
          `re-run scripts/build-busan-city-charter-2026-08.mjs after re-coursing it.`,
      },
    });
  });

  // The fourth drawer is the owner's "자기절로 customizing 가능하다" note — it is a
  // route option in its own right, not a footnote, so it sits in the same list
  // the other three do and is the last thing read.
  itineraryStops.push({
    number: ROUTE_SOURCES.length + 1,
    time: c.customRoute.fits,
    duration: c.customRoute.duration,
    name: c.customRoute.name,
    category: c.customRoute.category,
    description: c.customRoute.description,
    image: null,
    images: [],
    imageCredits: [],
    galleryItems: [],
    highlights: c.customRoute.highlights,
    timeUsed: c.customRoute.timeUsed,
    whyOnRoute: c.customRoute.whyOnRoute,
    _poi_meta: {
      match: "route_variant_no_single_poi",
      poi_key: "route_variant_custom",
      verified: true,
      verified_date: "2026-08-07",
      note: "Custom-route option — no fixed POIs by definition.",
    },
  });

  // ---- assembled document --------------------------------------------------
  const catalog_card = {
    slug: SLUG,
    title: c.title,
    subtitle: c.subtitle,
    region: c.region,
    duration: c.duration,
    stopsCount: itineraryStops.length,
    rating: 0,
    reviewCount: 0,
    badges: c.badges,
    tags: c.tags,
    heroImage: HERO_IMG,
    thumbnail: HERO_IMG,
    priceLabel: "",
    shortCardDescription: c.shortCardDescription,
  };

  const doc = {
    document_kind: "tour_product_full_page_v1",
    schema_version: 7,
    slug: SLUG,
    locale: loc,
    product_id: SLUG,
    seo: {
      pageTitle: c.seo.pageTitle,
      metaDescription: c.seo.metaDescription,
      title: c.seo.title,
      description: c.seo.description,
      primaryKeywords: c.seo.primaryKeywords,
      ogImage: `https://www.atockorea.com${HERO_IMG}`,
    },
    catalog_card,
    headlineLine1: c.headlineLine1,
    headlineLine2: c.headlineLine2,
    price: clone(PRICE),
    hero: {
      imageUrl: HERO_IMG,
      imagePosition: "center 45%",
      images: [HERO_IMG],
      tagline: c.heroTagline,
      pills: c.heroPills,
      meta: {
        duration: c.heroDuration,
        region: c.region,
        stops: c.heroStops,
        rating: 0,
        ratingStars: 0,
      },
    },
    subnavItems: clone(donor.subnavItems),
    glanceItems: clone(donor.glanceItems),
    galleryItems,
    itineraryStops,
    routeFlowStops: c.routeFlowStops,
    routePhases: c.routePhases,
    routeShapeIntro: c.routeShapeIntro,
    whyTourWorks: {
      bestFor: c.whyTourWorks.bestFor,
      lessIdealFor: c.whyTourWorks.lessIdealFor,
      routeLogicSections: c.whyTourWorks.routeLogicSections.map((s, i) => ({
        title: s.title,
        icon: ["highlight", "ticket", "shield-check"][i] ?? "route",
        iconBg: ["bg-amber-50/80", "bg-sky-50/80", "bg-emerald-50/80"][i] ?? "bg-slate-50/80",
        iconColor: ["text-amber-600", "text-sky-600", "text-emerald-600"][i] ?? "text-slate-600",
        items: s.items,
      })),
    },
    practicalAccordionItems: c.practicalAccordionItems.map((it) => ({
      id: it.id,
      title: it.title,
      preview: it.preview ?? it.content[0],
      content: it.content,
    })),
    practicalWeatherStatic: clone(donor.practicalWeatherStatic),
    // Season copy is generic Busan weather and is reused verbatim from the
    // donor locale; only `swaps` names stops, so only `swaps` is authored.
    seasonalVariations: clone(donor.seasonalVariations).map((s, i) => ({
      ...s,
      swaps: c.seasonalSwaps[i] ?? s.swaps,
    })),
    bookingTrustItems: c.bookingTrustItems,
    bookingSupportSteps: c.bookingSupportSteps.map((s, i) => ({ step: i + 1, ...s })),
    staticQuestions: c.staticQuestions,
    guestReviews: [],
    reviewsSummary: clone(donor.reviewsSummary),
    sticky_booking_bar: { note: c.stickyNote, price: clone(PRICE) },
    pickup_dropoff: {
      type: "hotel_pickup",
      meeting_points: [{ name: c.pd.pickupName, time: c.pd.pickupTime, note: c.pd.pickupNote }],
      dropoff_points: [{ name: c.pd.dropoffName, approx_time: c.pd.dropoffTime, note: c.pd.dropoffNote }],
      hotel_pickup_available: true,
      notes: c.pd.notes,
    },
    matching_profile: buildMatchingProfile(donor),
    matching_metadata: clone(MATCHING_METADATA),
    itinerary_variants: [],
    pricingTiers: clone(PRICING_TIERS),
    _publication: {
      schema_version: "v4_canonical",
      created: "2026-08-07",
      last_modified: "2026-08-07",
      version_history: ["v1_authored_2026_08_07"],
      fix_passes: {
        v1_authored_2026_08_07:
          "New product (owner instruction 2026-08-07: Busan had a cruise-port private charter but no city one). " +
          "Structural donor: busan-private-car-charter-cruise-shore (glance/weather/subnav/reviews blocks per locale). " +
          "The three recommended routes are IMPORTED at build time from busan-top-attractions-day-tour, " +
          "busan-small-group-yonggungsa-skycapsule-gamcheon-tour and busan-cruise-shore-excursion-bus-tour — " +
          "stop names and times come from those products' own bundles in the same locale, so nothing here is a " +
          "re-translation and re-running the builder re-syncs them. Fourth drawer is the custom-route option. " +
          "Rate card set by the owner in KRW (5h 230,000 / 6h 260,000 / 7h 290,000 / 8h 320,000 / 9h 360,000; " +
          "1–7 pax one vehicle, 8+ a second vehicle at twice the cell) and converted at 1,423.48 KRW/USD, " +
          "rounded to the nearest $5. Add-ons: Gimhae Airport pickup or drop-off +50,000 KRW, Gyeongju +80,000 KRW, " +
          "each hour past 9h +50,000 KRW.",
      },
    },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, `${SLUG}.${loc}.json`), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(
    `✓ ${loc.padEnd(5)} ${(JSON.stringify(doc).length / 1024).toFixed(0)} KB · ` +
      `${itineraryStops.length} drawers · ${galleryItems.length} photos · ` +
      `imported ${itineraryStops.slice(0, 3).map((s) => s.highlights.length).join("/")} stops`,
  );
}

/** Donor profile with the cruise-specific dimensions moved to city values. */
function buildMatchingProfile(donor) {
  const mp = clone(donor.matching_profile);
  mp.product_id = SLUG;
  mp.profile_version = 1;
  mp.is_active = true;
  mp.duration_hours = 8;
  mp.duration_band = "5h-9h";
  mp.pickup_base = "busan_hotel";
  mp.region_tags = ["busan", "busan_central", "busan_eastern", "busan_western"];
  mp.theme_tags = ["private_charter", "customizable_route", "city_highlights", "coastal", "cultural"];
  mp.poi_tags = MATCHING_METADATA.anchor_poi_keys.slice();
  mp.anchor_poi_keys = MATCHING_METADATA.anchor_poi_keys.slice();
  mp.keywords = [
    "Busan private car charter",
    "Busan private day tour",
    "Busan hotel pickup private tour",
    "Busan chauffeur day tour",
    "Busan to Gyeongju private car",
  ];
  // The cruise SKU is bound to a ship's clock; this one is not. Left wrong, the
  // recommender would keep offering a hotel charter to cruise-day queries.
  mp.hard_constraints = [
    "Private charter — 1 to 7 guests in one vehicle. 8 or more guests are quoted as two vehicles.",
    "Sold by the hour: 5 to 9 hours. Each hour past 9 is a paid extension, subject to driver availability.",
    "Gimhae Airport pickup or drop-off and the Gyeongju extension are paid add-ons, not included in the base hours.",
  ];
  mp.walking_notes =
    "Door-to-door by vehicle between stops. The only sustained walking is inside a chosen stop — Gamcheon Culture Village is a steep hillside village, and market stops are flat but crowded.";
  if ("same_day_flight_fit" in mp) mp.same_day_flight_fit = 0.8; // airport transfer is an add-on here
  if ("value_for_money_fit" in mp) mp.value_for_money_fit = 0.7;

  /**
   * 🔴 Measured, not assumed. The first import of this product came back
   * `cruise=true`, because `detectCruiseExcursion` in import-match-v18 reads
   * `cruise_market_segment_fit >= 1` and `cruise_reboarding_safety_buffer_fit
   * >= 1` — both inherited at 1 from the cruise donor along with five more
   * cruise dimensions nobody would think to look for.
   *
   * That is the wrong answer in the way that matters: the matcher would offer a
   * hotel-pickup charter to someone whose entire constraint is being back
   * aboard before the all-aboard call, which is the one thing this product does
   * not plan around. The cruise SKU exists for that and stays where it is.
   *
   * Only keys the donor actually has are written, so a donor that drops one of
   * these does not silently gain it back here.
   */
  const CRUISE_NEUTRALIZED = {
    cruise_passenger_fit: 0.3,
    cruise_shore_excursion_fit: 0,
    private_cruise_charter_fit: 0,
    cruise_market_segment_fit: 0.2,
    cruise_reboarding_safety_buffer_fit: 0,
    busan_port_pickup_fit: 0.2,
    non_cruise_day_tripper_fit: 1,
  };
  for (const [k, v] of Object.entries(CRUISE_NEUTRALIZED)) {
    if (k in mp) mp[k] = v;
  }
  delete mp.differentiates_from_busan_small_group_cruise_pair_partner;
  return mp;
}

// `--only=en,ko` builds a subset while the remaining locales are still being
// authored; no argument builds all six.
const only = process.argv.find((a) => a.startsWith("--only="));
const targets = only ? only.slice("--only=".length).split(",").filter(Boolean) : LOCALES;
for (const loc of targets) {
  if (!LOCALES.includes(loc)) throw new Error(`unknown locale "${loc}"`);
  build(loc);
}
console.log(`\ndone — ${targets.length} locale(s). Next: node scripts/build-catalog-cards.mjs`);
