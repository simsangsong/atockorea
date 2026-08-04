#!/usr/bin/env node
/**
 * Builds the static bundles for the NEW seasonal product (owner instruction
 * 2026-08-04):
 *   seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour
 *   Seoul pickup 06:00/06:30 → Seoraksan (self-guided) → lunch → Nami Island
 *   → Eobi Ice Valley → return Myeongdong ≈19:30 / Hongdae ≈20:00.
 *   Winter-only: runs roughly 20 Dec – 28 Feb, when the ice wall exists at all.
 *
 * Donor: seoul-seoraksan-nami-island-morning-calm-day-tour — same operator, same
 * two-point Seoul pickup, same coach, and it already carries the KB-verified
 * Seoraksan and Nami Island stop bodies plus the Seoul-region UI blocks.
 * Authored per-locale copy: scripts/seoul-winter-eobi-content/<loc>.json.
 * Staged-locale donor translations: .../donor-overlay/<loc>.json.
 *
 * Output: components/product-tour-static/<slug>/*.json
 * Run: node scripts/build-seoul-winter-eobi-2026-08.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour";
const DONOR = "seoul-seoraksan-nami-island-morning-calm-day-tour";
const OUT_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const CONTENT_DIR = path.join(__dirname, "seoul-winter-eobi-content");
const OVERLAY_DIR = path.join(CONTENT_DIR, "donor-overlay");

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const EXT_LOCALES = ["de", "fr", "it", "ru"];

// Owner-facing price. Three surfaces must agree: this constant, SLUG_OVERRIDES
// in BOTH catalog modules, and the offers SQL.
const PRICE_USD = 64;

const HERO_IMG = "/images/tours/seoraksan-national-park/seoraksan-ridge-view.webp";

const SEORAK_IMAGES = [
  "/images/tours/seoraksan-national-park/seoraksan-ridge-view.webp",
  "/images/tours/seoraksan-national-park/seoraksan-sinheungsa-ulsanbawi.webp",
  "/images/tours/seoraksan-national-park/seoraksan-gwongumseong-cable-car.webp",
  "/images/tours/seoraksan-national-park/seoraksan-sinheungsa-ulsan-rock.webp",
];
const NAMI_IMAGES = [
  "/images/tours/nami-island/nami-metasequoia-sunset-lake.webp",
  "/images/tours/nami-island/kakaotalk-20260510-222949305-04.webp",
  "/images/tours/nami-island/kakaotalk-20260510-222949305-05.webp",
  "/images/tours/nami-island/chatgpt-image-2026-5-11-01-12-05.webp",
];
// Eobi Ice Valley ships without photos — no owned imagery yet (same posture as
// Daritdol/Dakbatgol on the Busan small-group product).
const EOBI_IMAGES = [];

// Eobi's viewing area is village-run and its published festival hours have been
// reported as roughly 10:00-17:00, so the day is paced to reach the valley by
// ~16:45 rather than after 17:00. In deep winter that lands at dusk, which is
// when the deck path's night lighting comes on — stated plainly in the copy.
const TIMES = {
  pickup: "06:00 / 06:30",
  seoraksan: "≈ 09:30",
  lunch: "≈ 11:45",
  nami: "≈ 14:35",
  eobi: "≈ 16:45",
  dropoff: "≈ 19:00",
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function buildGalleryFor(name, srcs, startId) {
  return srcs.map((src, i) => ({
    id: startId + i,
    type: "photo",
    src,
    location: name,
    caption: `${name} — photo ${i + 1}`,
    alt: `${name} — gallery image ${i + 1}`,
  }));
}

function authoredStop(c, number, time, opts = {}) {
  const images = opts.images || [];
  return {
    number,
    time,
    duration: c.duration,
    name: c.name,
    category: c.category,
    description: c.description,
    image: images[0] || null,
    highlights: c.highlights || [],
    timeUsed: c.timeUsed || [],
    whyOnRoute: c.whyOnRoute,
    _poi_meta: opts.poiMeta || null,
    smartNotes: c.smartNotes || undefined,
    convenience: c.convenience || undefined,
    visitBasics: c.visitBasics || undefined,
    images: images.slice(),
    imageCredits: images.map((url) => ({ url, source: "atoc-korea" })),
    galleryItems: images.length ? buildGalleryFor(c.name, images, 1) : [],
  };
}

const STOP_TEXT_FIELDS = [
  "name", "category", "duration", "description", "highlights",
  "timeUsed", "whyOnRoute", "visitBasics", "convenience", "smartNotes",
];

function applyOverlayStop(stop, overlayStop, ctx) {
  if (!overlayStop) throw new Error(`${ctx}: overlay stop missing`);
  for (const k of STOP_TEXT_FIELDS) {
    if (k in overlayStop) stop[k] = clone(overlayStop[k]);
    else if (k in stop && stop[k] !== undefined) {
      throw new Error(`${ctx}: overlay missing translated field "${k}"`);
    }
  }
}

function loadDonor(loc) {
  return JSON.parse(
    readFileSync(path.join(ROOT, "components/product-tour-static", DONOR, `${DONOR}.${loc}.json`), "utf8"),
  );
}

const MATCHING_METADATA = {
  primary_themes: [
    "winter",
    "seasonal",
    "seoul_day_trip",
    "national_park",
    "ice_wall",
    "k_drama_filming",
  ],
  secondary_themes: [
    "frozen_waterfall",
    "snow_scenery",
    "winter_sonata",
    "metasequoia_lane",
    "photo_spots",
    "first_time_korea",
  ],
  best_for: [
    "winter_travelers",
    "photo_lovers",
    "couples",
    "first_time_korea",
    "snow_seekers",
  ],
  not_recommended_for: [
    "travelers_sensitive_to_cold",
    "minimal_walking_seekers",
    "visitors_outside_dec_to_feb",
  ],
  anchor_pois: ["Seoraksan National Park", "Nami Island", "Eobi Ice Valley"],
  anchor_poi_keys: ["seoraksan_national_park", "nami_island", "eobi_ice_valley"],
  competing_products: [
    "seoul-seoraksan-nami-island-morning-calm-day-tour",
    "seoul-seoraksan-national-park-sokcho-beach-day-trip",
    "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
  ],
  reviews_attribution: "New product (2026-08) — no imported reviews; rating starts at 0.",
  unesco_fit_note:
    "Seoraksan is Korea's first UNESCO Biosphere Reserve (1982) and a UNESCO World Heritage tentative site, but no stop on this route is an inscribed World Heritage property.",
};

function build(loc) {
  const isExt = EXT_LOCALES.includes(loc);
  const donorLoc = isExt ? "en" : loc;
  const donor = loadDonor(donorLoc);
  const c = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));
  const overlay = isExt
    ? JSON.parse(readFileSync(path.join(OVERLAY_DIR, `${loc}.json`), "utf8"))
    : null;

  if (donor.itineraryStops.length !== 5) throw new Error(`[${loc}] donor stops != 5`);
  const donorSeorak = donor.itineraryStops[1];
  const donorNami = donor.itineraryStops[2];
  if (donorSeorak._poi_meta?.poi_key !== "seoraksan_national_park") {
    throw new Error(`[${loc}] donor[1] is not Seoraksan`);
  }
  if (donorNami._poi_meta?.poi_key !== "nami_island") throw new Error(`[${loc}] donor[2] is not Nami`);

  // 1. Pickup — same 06:00/06:30 as the donor, but the day ends later and the
  //    winter caveats differ, so it is authored rather than patched.
  const sPickup = authoredStop(c.pickup, 1, TIMES.pickup, {});

  // 2. Seoraksan — donor body reused; winter-specific duration/why/basics applied.
  const sSeorak = clone(donorSeorak);
  sSeorak.number = 2;
  sSeorak.time = TIMES.seoraksan;
  if (isExt) applyOverlayStop(sSeorak, overlay.seoraksanStop, `[${loc}] seoraksanStop`);
  sSeorak.duration = c.seoraksanDuration;
  sSeorak.whyOnRoute = c.seoraksanWhy;
  if (c.seoraksanVisitBasics) sSeorak.visitBasics = clone(c.seoraksanVisitBasics);
  if (c.seoraksanSmartNotes) sSeorak.smartNotes = clone(c.seoraksanSmartNotes);
  sSeorak.images = SEORAK_IMAGES.slice();
  sSeorak.image = SEORAK_IMAGES[0];
  sSeorak.imageCredits = SEORAK_IMAGES.map((url) => ({ url, source: "atoc-korea" }));
  sSeorak.galleryItems = buildGalleryFor(sSeorak.name, SEORAK_IMAGES, 1);

  // 3. Lunch — authored.
  const sLunch = authoredStop(c.lunch, 3, TIMES.lunch, {});

  // 4. Nami Island — donor body reused, winter framing.
  const sNami = clone(donorNami);
  sNami.number = 4;
  sNami.time = TIMES.nami;
  if (isExt) applyOverlayStop(sNami, overlay.namiStop, `[${loc}] namiStop`);
  sNami.duration = c.namiDuration;
  sNami.whyOnRoute = c.namiWhy;
  if (c.namiVisitBasics) sNami.visitBasics = clone(c.namiVisitBasics);
  sNami.images = NAMI_IMAGES.slice();
  sNami.image = NAMI_IMAGES[0];
  sNami.imageCredits = NAMI_IMAGES.map((url) => ({ url, source: "atoc-korea" }));
  sNami.galleryItems = buildGalleryFor(sNami.name, NAMI_IMAGES, 1);

  // 5. Eobi Ice Valley — fully authored, no donor and no owned photos.
  const sEobi = authoredStop(c.eobi, 5, TIMES.eobi, {
    images: EOBI_IMAGES,
    poiMeta: {
      match: "authored",
      poi_key: "eobi_ice_valley",
      sources: c.eobiSources,
      verified: true,
      verified_date: "2026-08-04",
    },
  });

  // 6. Return — authored.
  const sDropoff = authoredStop(c.dropoff, 6, TIMES.dropoff, {});

  const stops = [sPickup, sSeorak, sLunch, sNami, sEobi, sDropoff];

  let gid = 1;
  const galleryItems = [sSeorak, sNami]
    .map((s) => s.galleryItems || [])
    .flat()
    .map((g) => ({ ...g, id: gid++ }));

  const routeFlowStops = [
    { name: c.flow.pickup, type: "origin", theme: "Seoul pickup" },
    { name: c.flow.seoraksan, type: "primary", theme: "Winter mountain" },
    { name: c.flow.lunch, type: "secondary", theme: "Lunch break" },
    { name: c.flow.nami, type: "primary", theme: "K-drama island" },
    { name: c.flow.eobi, type: "primary", theme: "Ice wall" },
    { name: c.flow.dropoff, type: "return", theme: "Drop-off" },
  ];

  const price = {
    amountLabel: String(PRICE_USD),
    currency: "USD",
    per: "person",
    salePriceUsd: PRICE_USD,
  };

  // 🔴 Never translate catalog_card.slug — a translated value mints a phantom
  // catalog entry pointing at a 404 (see jeju-eastern-unesco-spots-day-tour .es).
  const catalog_card = {
    slug: SLUG,
    title: c.title,
    subtitle: c.subtitle,
    region: c.region,
    duration: c.duration,
    stopsCount: c.stopsCount,
    rating: 0,
    reviewCount: 0,
    badges: c.badges,
    tags: c.tags,
    heroImage: HERO_IMG,
    thumbnail: HERO_IMG,
    priceLabel: "",
    shortCardDescription: c.shortCardDescription,
  };

  const seo = {
    pageTitle: c.seo.pageTitle,
    metaDescription: c.seo.metaDescription,
    title: c.seo.title,
    description: c.seo.description,
    primaryKeywords: c.seo.primaryKeywords,
    ogImage: `https://www.atockorea.com${HERO_IMG}`,
  };

  const hero = {
    imageUrl: HERO_IMG,
    imagePosition: "center 40%",
    images: [HERO_IMG],
    tagline: c.heroTagline,
    pills: c.heroPills,
    meta: {
      duration: c.heroDuration,
      region: c.region,
      stops: c.heroStopsLabel,
      rating: 0,
      ratingStars: 0,
    },
  };

  const practicalSource = isExt ? overlay.practicalItems : donor.practicalAccordionItems;
  const practicalAccordionItems = practicalSource.map((item) => {
    const authored = c.practical[item.id];
    if (!authored) return clone(item);
    const it = clone(item);
    if (authored.title) it.title = authored.title;
    it.content = authored.content;
    it.preview = authored.content[0];
    return it;
  });
  // Winter-only product: an explicit season accordion sits after weather-policy.
  const seasonIdx = practicalAccordionItems.findIndex((i) => i.id === "weather-policy");
  const seasonItem = {
    id: "season-window",
    title: c.practicalSeasonWindow.title,
    preview: c.practicalSeasonWindow.content[0],
    content: c.practicalSeasonWindow.content,
  };
  practicalAccordionItems.splice(seasonIdx >= 0 ? seasonIdx + 1 : 0, 0, seasonItem);

  const matching_profile = clone(donor.matching_profile);
  matching_profile.product_id = SLUG;
  matching_profile.is_active = true;
  matching_profile.profile_version = 1;
  matching_profile.poi_tags = MATCHING_METADATA.anchor_poi_keys.slice();
  matching_profile.anchor_poi_keys = MATCHING_METADATA.anchor_poi_keys.slice();
  matching_profile.seasonality = "winter_only";
  if ("duration_hours" in matching_profile) matching_profile.duration_hours = 13.5;
  if ("themed_garden_fit" in matching_profile) matching_profile.themed_garden_fit = 0;
  if ("winter_lighting_festival_fit" in matching_profile) matching_profile.winter_lighting_festival_fit = 0;
  if ("autumn_foliage_fit" in matching_profile) matching_profile.autumn_foliage_fit = 0;
  if ("seasonal_fit" in matching_profile) matching_profile.seasonal_fit = 1;
  if ("weather_sensitivity" in matching_profile) matching_profile.weather_sensitivity = "high";
  if ("senior_fit" in matching_profile) matching_profile.senior_fit = 0.5;
  if ("young_kids_fit" in matching_profile) matching_profile.young_kids_fit = 0.5;
  if ("stroller_fit" in matching_profile) matching_profile.stroller_fit = 0.2;
  if ("rain_fit" in matching_profile) matching_profile.rain_fit = 0.3;

  const pickup_dropoff = {
    primary: {
      ...clone(donor.pickup_dropoff.primary),
      time: c.pd.primaryTime,
      ...(c.pd.primaryName ? { name: c.pd.primaryName } : {}),
      ...(c.pd.primaryAddress ? { address: c.pd.primaryAddress } : {}),
      ...(c.pd.primaryInstructions ? { instructions: c.pd.primaryInstructions } : {}),
    },
    alternates: [
      {
        ...clone(donor.pickup_dropoff.alternates[0]),
        time: c.pd.alternateTime,
        ...(c.pd.alternateName ? { name: c.pd.alternateName } : {}),
        ...(c.pd.alternateAddress ? { address: c.pd.alternateAddress } : {}),
        ...(c.pd.alternateInstructions ? { instructions: c.pd.alternateInstructions } : {}),
      },
    ],
  };

  const doc = {
    document_kind: "tour_product_full_page_v1",
    schema_version: 7,
    slug: SLUG,
    locale: loc,
    product_id: SLUG,
    seo,
    catalog_card,
    headlineLine1: c.headlineLine1,
    headlineLine2: c.headlineLine2,
    price,
    hero,
    subnavItems: clone(isExt ? overlay.subnavItems : donor.subnavItems),
    glanceItems: c.glanceItems,
    galleryItems,
    itineraryStops: stops,
    routeFlowStops,
    routePhases: c.routePhases,
    routeShapeIntro: c.routeShapeIntro,
    whyTourWorks: {
      bestFor: c.whyTourWorks.bestFor,
      lessIdealFor: c.whyTourWorks.lessIdealFor,
      routeLogicSections: [
        {
          title: c.whyTourWorks.routeLogicTitle,
          icon: "route",
          iconBg: "bg-sky-50/80",
          iconColor: "text-sky-600",
          items: c.whyTourWorks.items,
        },
      ],
    },
    practicalAccordionItems,
    practicalWeatherStatic: clone(isExt ? overlay.practicalWeatherStatic : donor.practicalWeatherStatic),
    seasonalVariations: c.seasonalVariations,
    bookingTrustItems: clone(isExt ? overlay.bookingTrustItems : donor.bookingTrustItems),
    bookingSupportSteps: clone(isExt ? overlay.bookingSupportSteps : donor.bookingSupportSteps),
    staticQuestions: c.staticQuestions,
    guestReviews: [],
    reviewsSummary: clone(isExt ? overlay.reviewsSummary : donor.reviewsSummary),
    sticky_booking_bar: {
      note: c.stickyNote,
      price: clone(price),
    },
    pickup_dropoff,
    matching_profile,
    matching_metadata: clone(MATCHING_METADATA),
    itinerary_variants: [],
    _publication: {
      schema_version: "v4_canonical",
      created: "2026-08-04",
      last_modified: "2026-08-04",
      version_history: ["v1_authored_2026_08_04"],
      fix_passes: {
        v1_authored_2026_08_04:
          "New seasonal product (owner instruction 2026-08-04). Winter-only Seoraksan + Nami Island + Eobi Ice Valley coach day tour, running roughly 20 Dec – 28 Feb. Donor seoul-seoraksan-nami-island-morning-calm-day-tour supplied the KB-verified Seoraksan and Nami Island stop bodies plus the two-point Seoul pickup and Seoul-region UI blocks. Eobi Ice Valley, pickup, lunch, return and all product-level copy authored fresh in 6 locales (scripts/seoul-winter-eobi-content/) with de/fr/it/ru staged. Eobi Ice Valley ships without photos — no owned imagery yet. matching_profile derived from the donor with seasonality forced to winter_only and the garden/foliage axes zeroed.",
      },
    },
  };

  const page_sections = clone(donor.page_sections || []);
  for (const sec of page_sections) {
    if (!sec || !sec.props) continue;
    const p = sec.props;
    for (const key of Object.keys(p)) {
      if (key === "price") {
        p.price = clone(price);
        continue;
      }
      if (key === "note") {
        p.note = doc.sticky_booking_bar.note;
        continue;
      }
      if (key in doc) p[key] = clone(doc[key]);
    }
  }
  doc.page_sections = page_sections;

  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${SLUG}.${loc}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc} (${(JSON.stringify(doc).length / 1024).toFixed(0)} KB)`);
}

for (const loc of LOCALES) build(loc);
for (const loc of EXT_LOCALES) {
  if (existsSync(path.join(OVERLAY_DIR, `${loc}.json`)) && existsSync(path.join(CONTENT_DIR, `${loc}.json`))) {
    build(loc);
  } else {
    console.log(`· skip ${loc} (translations not present yet)`);
  }
}
