#!/usr/bin/env node
/**
 * Builds the static bundles for the NEW product (owner instruction 2026-08-04):
 *   seoul-gapyeong-nami-morning-calm-petite-france-day-tour
 *   Seoul pickup → Nami Island → lunch → Garden of Morning Calm → Petite France
 *   → return to Seoul.  Join-in-group coach; the Gapyeong trio without Seoraksan.
 *
 * Donors (both 6-locale, both already carry KB-verified stop bodies):
 *   A. seoul-seoraksan-nami-island-morning-calm-day-tour
 *      → pickup stop, Nami Island stop, Garden of Morning Calm stop, return stop,
 *        Seoul-region weather/glance/trust/support blocks, pickup_dropoff.
 *   B. seoul-private-nami-morning-calm-petite-france
 *      → Petite France stop.
 * Authored per-locale copy: scripts/seoul-gapyeong-content/<loc>.json.
 * Staged-locale donor translations: scripts/seoul-gapyeong-content/donor-overlay/<loc>.json.
 *
 * Output: components/product-tour-static/<slug>/*.json
 * Run: node scripts/build-seoul-gapyeong-2026-08.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "seoul-gapyeong-nami-morning-calm-petite-france-day-tour";
const DONOR_A = "seoul-seoraksan-nami-island-morning-calm-day-tour";
const DONOR_B = "seoul-private-nami-morning-calm-petite-france";
const OUT_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const CONTENT_DIR = path.join(__dirname, "seoul-gapyeong-content");
const OVERLAY_DIR = path.join(CONTENT_DIR, "donor-overlay");

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
// Staged locales (owner instruction 2026-08-04: "10-locale translation").
// NOT registered in the 6-locale product registries — the detail page narrows
// de/fr/it/ru to EN by design (i18n expansion track's human gate). They exist so
// the pages are ready the day that gate opens; the catalog card generator is
// filesystem-driven and picks them up already.
const EXT_LOCALES = ["de", "fr", "it", "ru"];

// Owner-facing price. NOTE: three surfaces must agree — this constant,
// SLUG_OVERRIDES.listPriceUsd in BOTH catalog modules, and the offers SQL.
const PRICE_USD = 59;

const HERO_IMG = "/images/tours/nami-island/nami-metasequoia-sunset-lake.webp";

const NAMI_IMAGES = [
  "/images/tours/nami-island/nami-metasequoia-sunset-lake.webp",
  "/images/tours/nami-island/02-kakaotalk-20260510-222949305-04.webp",
  "/images/tours/nami-island/01-kakaotalk-20260510-222949305-05.webp",
  "/images/tours/nami-island/03-chatgpt-image-2026-5-11-01-12-05.webp",
];
const GMC_IMAGES = [
  "/images/tours/garden-of-morning-calm/garden-of-morning-calm-flowers.webp",
  "/images/tours/garden-of-morning-calm/04-chatgpt-image-2026-5-10-10-36-31.webp",
  "/images/tours/garden-of-morning-calm/02-chatgpt-image-2026-5-10-10-43-58.webp",
  "/images/tours/garden-of-morning-calm/03-chatgpt-image-2026-5-11-01-09-33.webp",
];
const PETITE_IMAGES = [
  "/images/tours/petite-france/01-kakaotalk-20260510-222949305-02.webp",
  "/images/tours/petite-france/petite-france-couple-colorful.webp",
  "/images/tours/petite-france/petite-france-ai-pastel-village.webp",
];

// Gapyeong sits ~75 km from Seoul — a far shorter run than the Seoraksan donor's
// 2.5 h each way, so the whole day shifts ~1.5 h later and ends ~1 h earlier.
const TIMES = {
  pickup: "07:30 / 08:00",
  nami: "≈ 10:00",
  lunch: "≈ 12:15",
  gmc: "≈ 13:45",
  // 16:00, not 15:45: Morning Calm → Petite France measures 45 min on Kakao
  // Mobility (31.2 km), not the half hour the first draft assumed.
  petite: "≈ 16:00",
  dropoff: "≈ 18:30",
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/**
 * Per-locale terminology normalisation, applied last so it catches donor text
 * as well as authored text.
 *
 * The two donors disagree with each other in Japanese: donor A
 * (seoul-seoraksan-nami-island-morning-calm-day-tour) writes the Garden of
 * Morning Calm as 晨靜苑 with the traditional 靜, donor B
 * (seoul-private-nami-morning-calm-petite-france) writes 晨静苑 with the
 * standard shinjitai 静. Reusing stops from both put 29 of one and 25 of the
 * other on the same Japanese page. Japanese takes 静; zh-TW legitimately keeps
 * 靜, so this is deliberately locale-scoped rather than a global replace.
 */
const TERMINOLOGY = {
  ja: [["晨靜苑", "晨静苑"]],
};

/**
 * The practical accordion renders as PLAIN TEXT — both its `preview` teaser and
 * its `content` body. Donor bodies and authored copy both use ** for emphasis,
 * and copying them verbatim put literal asterisks on the customer's page: 24 on
 * the Gapyeong page against 0 on the Busan small-group product, whose accordion
 * content carries no markdown at all. Strip here, once, rather than in ten
 * content files per product.
 *
 * Stop descriptions are a different matter — those ARE markdown-rendered, so
 * their ** is left alone.
 */
function toPlain(markdown) {
  return String(markdown)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function toPreview(markdown) {
  const plain = toPlain(markdown).replace(/\s+/g, " ");
  if (plain.length <= 75) return plain;
  return plain.slice(0, 75).replace(/[\s.,;:—-]+$/, "") + "…";
}

/**
 * Rewrite every string in the document. Arrays need the index-assigning branch:
 * `node.forEach(walk)` visits a string element as a value and can never write
 * it back, which silently skips things like matching_profile.walking_notes.
 */
function mapStrings(doc, fn) {
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => {
        if (typeof v === "string") {
          const next = fn(v);
          if (next !== v) node[i] = next;
        } else visit(v);
      });
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string") {
        const next = fn(v);
        if (next !== v) node[k] = next;
      } else visit(v);
    }
  };
  visit(doc);
}

function applyTerminology(doc, loc) {
  const rules = TERMINOLOGY[loc];
  if (!rules) return;
  mapStrings(doc, (s) => {
    let next = s;
    for (const [from, to] of rules) next = next.split(from).join(to);
    return next;
  });
  const blob = JSON.stringify(doc);
  for (const [from] of rules) {
    if (blob.includes(from)) throw new Error(`[${loc}] terminology rule left "${from}" in the bundle`);
  }
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

/**
 * Verified string replacement. A silent no-op here is the worst outcome — the
 * donor sentence would keep naming Seoraksan on a tour that never goes there.
 */
function descReplace(text, from, to, ctx) {
  if (!text.includes(from)) throw new Error(`${ctx}: replacement source not found: ${from.slice(0, 60)}`);
  return text.split(from).join(to);
}

function loadDonor(slug, loc) {
  return JSON.parse(
    readFileSync(path.join(ROOT, "components/product-tour-static", slug, `${slug}.${loc}.json`), "utf8"),
  );
}

function build(loc) {
  const isExt = EXT_LOCALES.includes(loc);
  const donorLoc = isExt ? "en" : loc;
  const donorA = loadDonor(DONOR_A, donorLoc);
  const donorB = loadDonor(DONOR_B, donorLoc);
  const c = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));
  const overlay = isExt
    ? JSON.parse(readFileSync(path.join(OVERLAY_DIR, `${loc}.json`), "utf8"))
    : null;

  if (donorA.itineraryStops.length !== 5) throw new Error(`[${loc}] donor A stops != 5`);
  if (donorB.itineraryStops.length !== 3) throw new Error(`[${loc}] donor B stops != 3`);

  const donorNami = donorA.itineraryStops[2];
  const donorGmc = donorA.itineraryStops[3];
  const donorPetite = donorB.itineraryStops[2];
  if (donorNami._poi_meta?.poi_key !== "nami_island") throw new Error(`[${loc}] donor A[2] is not Nami`);
  if (donorGmc._poi_meta?.poi_key !== "garden_of_morning_calm") throw new Error(`[${loc}] donor A[3] is not GMC`);
  if (donorPetite._poi_meta?.poi_key !== "petite_france") throw new Error(`[${loc}] donor B[2] is not Petite France`);

  // ---- stops ---------------------------------------------------------------
  // 1. Pickup — donor text is written for an 06:00 Seoraksan run. Fully authored
  //    here instead of patched: every clause (times, drive, first stop) changes.
  const sPickup = authoredStop(c.pickup, 1, TIMES.pickup, {});

  // 2. Nami Island — donor body reused verbatim; only position/time/why change.
  const sNami = clone(donorNami);
  sNami.number = 2;
  sNami.time = TIMES.nami;
  if (isExt) applyOverlayStop(sNami, overlay.namiStop, `[${loc}] namiStop`);
  sNami.duration = c.namiDuration;
  sNami.whyOnRoute = c.namiWhy;
  if (c.namiVisitBasics) sNami.visitBasics = clone(c.namiVisitBasics);
  sNami.images = NAMI_IMAGES.slice();
  sNami.image = NAMI_IMAGES[0];
  sNami.imageCredits = NAMI_IMAGES.map((url) => ({ url, source: "atoc-korea" }));
  sNami.galleryItems = buildGalleryFor(sNami.name, NAMI_IMAGES, 1);

  // 3. Lunch — authored (donor A has no lunch stop; the Gapyeong day has a real
  //    midday break because the drive is short).
  const sLunch = authoredStop(c.lunch, 3, TIMES.lunch, {});

  // 4. Garden of Morning Calm — donor body reused.
  const sGmc = clone(donorGmc);
  sGmc.number = 4;
  sGmc.time = TIMES.gmc;
  if (isExt) applyOverlayStop(sGmc, overlay.gmcStop, `[${loc}] gmcStop`);
  sGmc.duration = c.gmcDuration;
  sGmc.whyOnRoute = c.gmcWhy;
  if (c.gmcVisitBasics) sGmc.visitBasics = clone(c.gmcVisitBasics);
  sGmc.images = GMC_IMAGES.slice();
  sGmc.image = GMC_IMAGES[0];
  sGmc.imageCredits = GMC_IMAGES.map((url) => ({ url, source: "atoc-korea" }));
  sGmc.galleryItems = buildGalleryFor(sGmc.name, GMC_IMAGES, 1);

  // 5. Petite France — from donor B (the private product), retimed for a coach.
  const sPetite = clone(donorPetite);
  sPetite.number = 5;
  sPetite.time = TIMES.petite;
  if (isExt) applyOverlayStop(sPetite, overlay.petiteStop, `[${loc}] petiteStop`);
  sPetite.duration = c.petiteDuration;
  sPetite.whyOnRoute = c.petiteWhy;
  if (c.petiteVisitBasics) sPetite.visitBasics = clone(c.petiteVisitBasics);
  // The donor carries an admission figure inside its highlights (₩10,000) that
  // contradicts its own visitBasics (₩12,000). Re-checked 2026-08-04: the gate
  // price is ₩12,000, so drop the stale highlight rather than ship two numbers.
  if (Array.isArray(sPetite.highlights)) {
    const before = sPetite.highlights.length;
    sPetite.highlights = sPetite.highlights.filter((h) => !c.petiteHighlightDropMarker || !String(h).includes(c.petiteHighlightDropMarker));
    if (c.petiteHighlightDropMarker && sPetite.highlights.length === before) {
      throw new Error(`[${loc}] petite highlight drop marker not found: ${c.petiteHighlightDropMarker}`);
    }
  }
  sPetite.images = PETITE_IMAGES.slice();
  sPetite.image = PETITE_IMAGES[0];
  sPetite.imageCredits = PETITE_IMAGES.map((url) => ({ url, source: "atoc-korea" }));
  sPetite.galleryItems = buildGalleryFor(sPetite.name, PETITE_IMAGES, 1);

  // 6. Return — authored (donor's return names Seoraksan drive times).
  const sDropoff = authoredStop(c.dropoff, 6, TIMES.dropoff, {});

  const stops = [sPickup, sNami, sLunch, sGmc, sPetite, sDropoff];

  // ---- gallery -------------------------------------------------------------
  let gid = 1;
  const galleryItems = [sNami, sGmc, sPetite]
    .map((s) => s.galleryItems || [])
    .flat()
    .map((g) => ({ ...g, id: gid++ }));

  // ---- route flow ----------------------------------------------------------
  const routeFlowStops = [
    { name: c.flow.pickup, type: "origin", theme: "Seoul pickup" },
    { name: c.flow.nami, type: "primary", theme: "K-drama island" },
    { name: c.flow.lunch, type: "secondary", theme: "Lunch break" },
    { name: c.flow.gmc, type: "primary", theme: "Themed garden" },
    { name: c.flow.petite, type: "primary", theme: "French village" },
    { name: c.flow.dropoff, type: "return", theme: "Drop-off" },
  ];

  // ---- price / cards -------------------------------------------------------
  const price = {
    amountLabel: String(PRICE_USD),
    currency: "USD",
    per: "person",
    salePriceUsd: PRICE_USD,
  };

  // 🔴 catalog_card.slug MUST stay the untranslated slug. A translated value here
  // makes scripts/build-catalog-cards.mjs mint a phantom catalog entry that links
  // to a 404 (this already happened to jeju-eastern-unesco-spots-day-tour .es).
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
    imagePosition: "center 45%",
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

  // ---- practical accordion -------------------------------------------------
  // Donor item ids: pickup, what-to-bring, weather-policy, inclusions, language,
  // walking, lunch, cancellation. Everything route-specific is re-authored; the
  // rest keeps the donor's (already translated) operator boilerplate.
  const practicalSource = isExt ? overlay.practicalItems : donorA.practicalAccordionItems;
  const practicalAccordionItems = practicalSource.map((item) => {
    const it = clone(item);
    const authored = c.practical[item.id];
    if (authored) {
      if (authored.title) it.title = authored.title;
      it.content = authored.content;
      it.preview = toPreview(authored.content[0]);
    }
    // The accordion body renders as plain text, not markdown — verified
    // 2026-08-04 against the Busan small-group product, whose accordion content
    // carries no ** and whose page shows none, while this one showed 24 literal
    // asterisks. Both the donor bodies and the authored copy use ** for
    // emphasis, so strip it here rather than in ten content files.
    if (Array.isArray(it.content)) it.content = it.content.map(toPlain);
    if (typeof it.preview === "string") it.preview = toPlain(it.preview);
    return it;
  });

  // ---- matching profile (donor A derived; identity + anchors patched) -------
  const matching_profile = clone(donorA.matching_profile);
  matching_profile.product_id = SLUG;
  matching_profile.is_active = true;
  matching_profile.profile_version = 1;
  matching_profile.poi_tags = MATCHING_METADATA.anchor_poi_keys.slice();
  matching_profile.anchor_poi_keys = MATCHING_METADATA.anchor_poi_keys.slice();
  // This route drops the mountain and keeps the gardens: recalibrate the axes
  // that the Seoraksan donor scored for a national-park day.
  if ("duration_hours" in matching_profile) matching_profile.duration_hours = 11.5;
  // The donor's notes describe the donor's day — 13 hours, Seoraksan paths, a
  // Seoraksan cable car. This tour is 11.5 hours and never goes near Seoraksan;
  // cloning the profile carried all three across. State this tour's own stops.
  matching_profile.walking_notes = [
    "11.5-hour day with ~4-5 km total walking.",
    "Nami Island is flat; the Garden of Morning Calm is rolling terrain; Petite France sits on a gentle slope.",
    "Closed-toe shoes recommended.",
    "Nami bicycle and e-buggy rental optional and not included.",
  ];
  if ("national_park_fit" in matching_profile) matching_profile.national_park_fit = 0;
  if ("unesco_fit" in matching_profile) matching_profile.unesco_fit = 0;
  if ("buddhist_temple_fit" in matching_profile) matching_profile.buddhist_temple_fit = 0;
  if ("walking_level" in matching_profile) matching_profile.walking_level = 2;
  if ("themed_garden_fit" in matching_profile) matching_profile.themed_garden_fit = 1;
  if ("k_drama_filming_fit" in matching_profile) matching_profile.k_drama_filming_fit = 1;
  if ("winter_sonata_fit" in matching_profile) matching_profile.winter_sonata_fit = 1;
  if ("senior_fit" in matching_profile) matching_profile.senior_fit = 0.8;
  if ("young_kids_fit" in matching_profile) matching_profile.young_kids_fit = 0.8;
  if ("stroller_fit" in matching_profile) matching_profile.stroller_fit = 0.6;
  if ("photo_level" in matching_profile) matching_profile.photo_level = 5;

  const pickup_dropoff = {
    primary: {
      ...clone(donorA.pickup_dropoff.primary),
      time: c.pd.primaryTime,
      ...(c.pd.primaryName ? { name: c.pd.primaryName } : {}),
      ...(c.pd.primaryAddress ? { address: c.pd.primaryAddress } : {}),
      ...(c.pd.primaryInstructions ? { instructions: c.pd.primaryInstructions } : {}),
    },
    alternates: [
      {
        ...clone(donorA.pickup_dropoff.alternates[0]),
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
    subnavItems: clone(isExt ? overlay.subnavItems : donorA.subnavItems),
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
    practicalWeatherStatic: clone(isExt ? overlay.practicalWeatherStatic : donorA.practicalWeatherStatic),
    seasonalVariations: c.seasonalVariations,
    bookingTrustItems: clone(isExt ? overlay.bookingTrustItems : donorA.bookingTrustItems),
    bookingSupportSteps: clone(isExt ? overlay.bookingSupportSteps : donorA.bookingSupportSteps),
    staticQuestions: c.staticQuestions,
    guestReviews: [],
    reviewsSummary: clone(isExt ? overlay.reviewsSummary : donorA.reviewsSummary),
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
          "New product (owner instruction 2026-08-04). The Gapyeong trio as a join-in-group coach day tour — the join-in counterpart to the existing private seoul-private-nami-morning-calm-petite-france. Donor A (seoul-seoraksan-nami-island-morning-calm-day-tour) supplied the KB-verified Nami Island and Garden of Morning Calm stop bodies plus Seoul-region weather/trust/support blocks and the two-point Seoul pickup; donor B (seoul-private-nami-morning-calm-petite-france) supplied the Petite France stop body. Pickup, lunch, return and all product-level copy authored fresh in 6 locales (scripts/seoul-gapyeong-content/) with de/fr/it/ru staged. Stop admission/hours re-verified 2026-08-04 against operator and KTO sources. matching_profile derived from donor A with the mountain axes zeroed and garden/K-drama axes raised — full KB calibration pending.",
      },
    },
  };

  // ---- page_sections mirror (donor section list, props resynced) ----------
  const page_sections = clone(donorA.page_sections || []);
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

  applyTerminology(doc, loc);

  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${SLUG}.${loc}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc} (${(JSON.stringify(doc).length / 1024).toFixed(0)} KB)`);
}

// Matching metadata is locale-invariant (EN) across all bundles.
const MATCHING_METADATA = {
  primary_themes: [
    "gapyeong",
    "seoul_day_trip",
    "k_drama_filming",
    "themed_garden",
    "river_island",
    "french_village",
  ],
  secondary_themes: [
    "winter_sonata",
    "metasequoia_lane",
    "lighting_festival",
    "photo_spots",
    "autumn_foliage",
    "first_time_korea",
  ],
  best_for: [
    "first_time_korea",
    "couples",
    "photo_lovers",
    "families",
    "k_drama_fans",
    "seniors",
  ],
  not_recommended_for: [
    "hikers_seeking_mountains",
    "nightlife_focused_travelers",
    "travelers_wanting_a_short_half_day",
  ],
  anchor_pois: ["Nami Island", "The Garden of Morning Calm", "Petite France"],
  anchor_poi_keys: ["nami_island", "garden_of_morning_calm", "petite_france"],
  competing_products: [
    "seoul-seoraksan-nami-island-morning-calm-day-tour",
    "seoul-private-nami-morning-calm-petite-france",
    "pocheon-sanjeong-lake-herb-island-art-valley",
  ],
  reviews_attribution: "New product (2026-08) — no imported reviews; rating starts at 0.",
  unesco_fit_note:
    "No UNESCO property on this route. Cultural weight is popular-culture and horticultural: Winter Sonata's metasequoia lane on Nami Island, a 330,000 m² private arboretum, and a licensed Le Petit Prince village.",
};

for (const loc of LOCALES) build(loc);
for (const loc of EXT_LOCALES) {
  if (existsSync(path.join(OVERLAY_DIR, `${loc}.json`)) && existsSync(path.join(CONTENT_DIR, `${loc}.json`))) {
    build(loc);
  } else {
    console.log(`· skip ${loc} (translations not present yet)`);
  }
}
