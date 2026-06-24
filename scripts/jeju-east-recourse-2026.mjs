#!/usr/bin/env node
/**
 * One-off transform: re-course the Jeju Eastern UNESCO Spots Day Tour.
 *
 * New course (pickup/drop-off unchanged):
 *   Hamdeok Beach → Seongeup Folk Village → Lunch → Seongsan Ilchulbong (UNESCO)
 *   → Haenyeo diving performance (Haenyeo Museum fallback if cancelled)
 *   → Manjanggul Lava Tube (UNESCO) → drop-off
 *
 * Replaces the Ilchulland/Micheon-cave stop with the real UNESCO Manjanggul
 * lava tube, moves lunch ahead of Seongsan, and reframes the Haenyeo Museum
 * stop as a live haenyeo diving performance with the museum as the rain/sea
 * fallback. Applies to all 6 locale bundles + matching metadata/profile + price.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(
  __dirname,
  "../components/product-tour-static/jeju-eastern-unesco-spots-day-tour",
);
const SLUG = "jeju-eastern-unesco-spots-day-tour";
const LOCALES = ["ko", "en", "ja", "zh", "zh-TW", "es"];

const MANJANG_IMAGES = [
  "/images/tours/ilchulland/chatgpt-image-2026-5-8-07-49-08.webp",
  "/images/tours/ilchulland/chatgpt-image-2026-5-8-07-49-22.webp",
  "/images/tours/ilchulland/chatgpt-image-2026-5-8-07-49-24.webp",
];

// New times / numbers (shared across locales)
const TIMES = {
  hamdeok: "≈ 09:50",
  seongeup: "≈ 11:00",
  lunch: "≈ 12:20",
  seongsan: "≈ 13:50",
  haenyeo: "≈ 15:10",
  manjang: "≈ 16:30",
  dropoff: "≈ 17:45",
};

// ---- shared (English) matching_metadata patch -----------------------------
function patchMatchingMetadata(mm) {
  if (!mm || typeof mm !== "object") return mm;
  mm.primary_themes = [
    "jeju",
    "east_jeju",
    "unesco_focused",
    "world_heritage",
    "lava_tube",
    "haenyeo_culture",
    "intangible_heritage",
    "joseon_heritage",
  ];
  mm.secondary_themes = [
    "top_3_beach",
    "wwii_colonial_history",
    "tuff_cone",
    "feng_shui_walled_town",
    "olle_trail",
    "k_drama_filming",
    "haenyeo_diving_performance",
  ];
  mm.anchor_pois = [
    "Hamdeok Seoubong Beach",
    "Seongeup Folk Village",
    "Seongsan Ilchulbong",
    "Haenyeo Diving Performance (Haenyeo Museum fallback)",
    "Manjanggul Lava Tube",
  ];
  mm.anchor_poi_keys = [
    "hamdeok_seoubong_beach",
    "seongeup_folk_village",
    "seongsan_ilchulbong",
    "jeju_haenyeo_museum",
    "manjanggul_lava_tube",
  ];
  mm.unesco_fit_note =
    "unesco_fit=5 = 2 World Heritage Sites (Seongsan Ilchulbong AND Manjanggul Lava Tube — both inscribed 2007 under 'Jeju Volcanic Island and Lava Tubes') + 1 Intangible Cultural Heritage of Humanity (Culture of Jeju Haenyeo, inscribed 2016, experienced live via the haenyeo diving performance with the Haenyeo Museum as the weather/sea fallback). Seongeup Folk Village is Korea's national folk heritage — NOT UNESCO — and does not contribute to this score.";
  mm.audit_summary =
    "East Jeju UNESCO-anchored loop carrying TWO World Heritage Sites from the same 2007 'Jeju Volcanic Island and Lava Tubes' inscription in a single day — Seongsan Ilchulbong (Surtseyan tuff cone) and Manjanggul Lava Tube (world's tallest lava column, 7.6 m) — plus UNESCO Intangible Cultural Heritage of Humanity experienced live as a haenyeo free-diving performance beside Seongsan (Haenyeo Museum fallback when the sea show is cancelled), the Important Folklore Cultural Heritage of Seongeup Folk Village (1423 founding), and Olle Trail Course 19 walking heritage at Hamdeok. UNESCO-anchored counterpart to the signature-nature sister tour, which emphasizes Seolmundae Halmang mythology + Tadao Ando architecture instead.";
  if (mm.score_rationale && mm.score_rationale.high_scores) {
    mm.score_rationale.high_scores = {
      "unesco_focused_tour_fit=1.0":
        "Two genuine World Heritage Sites (Seongsan + Manjanggul, 2007) plus a live Intangible Cultural Heritage performance in one day — densest UNESCO concentration in the catalog",
      "world_natural_heritage_fit=1.0":
        "Twin lava-tube/tuff-cone World Heritage Sites from the same 2007 inscription visited the same afternoon",
      "haenyeo_culture_fit=1.0":
        "UNESCO Intangible 2016 — seen live as a haenyeo diving performance beside Seongsan, with the Haenyeo Museum as fallback",
      "value_priced_fit=1.0":
        "Total ₩9,000 admission per adult (Seongsan ₩5,000 + Manjanggul ₩4,000; haenyeo performance free) for two World Heritage Sites = catalog-leading UNESCO value",
      "rainy_day_friendly_fit=0.9":
        "Indoor fallback anchors (Seongeup hanok + Manjanggul cave + Haenyeo Museum) keep the day resilient; the open-air haenyeo show is the one weather-dependent element and falls back to the indoor museum",
      "wwii_history_fit=1.0":
        "Hamdeok tunnels + Seongsan 18 caves both visible in the day's narrative arc",
    };
  }
  if (mm.differentiation_vs_signature_nature_sister) {
    mm.differentiation_vs_signature_nature_sister =
      "Shares the Seongsan + Seongeup anchors but swaps the sister's mythology/architecture framing for a UNESCO-heritage spine: Hamdeok Olle 19 + TWO 2007 World Heritage Sites (Seongsan tuff cone + Manjanggul lava tube) + live UNESCO Intangible haenyeo performance (2016). This tour = twin World Heritage Sites + strongest rain-resilient anchor count + best ₩-per-UNESCO-anchor value; sister = mythology + Pulitzer architecture + 4 K-drama filming sites. Pair complementarily for guests with 2 days on Jeju.";
  }
  mm.kb_anchor_version = "1.29";
  return mm;
}

// ---- shared matching_profile patch (numeric + slug fields) ----------------
function patchMatchingProfile(mp) {
  if (!mp || typeof mp !== "object") return mp;
  mp.poi_tags = [
    "hamdeok_beach",
    "seongeup_folk_village",
    "seongsan_ilchulbong",
    "jeju_haenyeo_museum",
    "manjanggul_cave",
  ];
  mp.anchor_poi_keys = [
    "seongsan_ilchulbong",
    "manjanggul_lava_tube",
    "seongeup_folk_village",
    "jeju_haenyeo_museum",
    "hamdeok_beach",
  ];
  // Two real World Heritage Sites now, not "adjacent"
  mp.lava_tube_unesco_adjacent_fit = 1;
  mp.lava_tube_unesco_fit = 1;
  mp.unesco_world_heritage_site_count = 2;
  mp.twin_world_heritage_volcanic_fit = 1;
  mp.haenyeo_diving_performance_fit = 1;
  // Cheaper, more free anchors
  mp.total_admission_krw_per_adult = 9000;
  mp.free_admission_anchor_count = 3;
  mp.value_priced_fit = 1;
  mp.budget_traveler_fit = 1;
  // Museum is now the fallback, not the headline cultural anchor
  mp.museum_anchor_fit = 0.85;
  // Bump profile version to signal the re-course
  mp.profile_version = 7;
  return mp;
}

// ---- price (shared) -------------------------------------------------------
function newPrice() {
  return {
    amountLabel: "47",
    originalPriceUsd: 59,
    salePriceUsd: 47,
    discountPercent: 20,
    currency: "USD",
    per: "person",
  };
}

// ---------------------------------------------------------------------------
// Per-locale authored content. See CONTENT[locale] below the helpers.
// ---------------------------------------------------------------------------
const CONTENT_DIR = path.join(__dirname, "jeju-east-recourse-content");
const CONTENT = {};
for (const loc of LOCALES) {
  const p = path.join(CONTENT_DIR, `${loc}.json`);
  try {
    CONTENT[loc] = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    /* locale not authored yet */
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

function manjangStop(loc, number) {
  const c = CONTENT[loc].manjang;
  const name = c.name;
  return {
    number,
    time: TIMES.manjang,
    duration: c.duration,
    name,
    category: c.category,
    description: c.description,
    image: MANJANG_IMAGES[0],
    highlights: c.highlights,
    timeUsed: c.timeUsed,
    whyOnRoute: c.whyOnRoute,
    _poi_meta: {
      poi_key: "manjanggul_lava_tube",
      kb_version: "1.29",
      verified_date: "2026-04-29",
      sources: [
        "visitjeju.net (Visit Jeju official)",
        "english.visitkorea.or.kr",
        "jeju.go.kr/geopark",
        "UNESCO Jeju Volcanic Island and Lava Tubes (whc.unesco.org)",
        "Wikipedia Manjanggul (Dec 2025)",
      ],
    },
    convenience: c.convenience,
    smartNotes: c.smartNotes,
    visitBasics: c.visitBasics,
    images: MANJANG_IMAGES.slice(),
    imageCredits: MANJANG_IMAGES.map((url) => ({ url, source: "atoc-korea" })),
    galleryItems: buildGalleryFor(name, MANJANG_IMAGES, 1),
  };
}

function haenyeoStop(loc, number, srcImages) {
  const c = CONTENT[loc].haenyeo;
  const name = c.name;
  return {
    number,
    time: TIMES.haenyeo,
    duration: c.duration,
    name,
    category: c.category,
    description: c.description,
    image: srcImages[3] || srcImages[0],
    highlights: c.highlights,
    timeUsed: c.timeUsed,
    whyOnRoute: c.whyOnRoute,
    _poi_meta: {
      poi_key: "jeju_haenyeo_museum",
      kb_version: "1.29",
      verified_date: "2026-04-29",
      sources: [
        "UNESCO Intangible Cultural Heritage — Culture of Jeju Haenyeo (2016 inscription)",
        "Jeju Haenyeo Museum official site (haenyeo.go.kr)",
        "VisitJeju — Seongsan Haenyeo diving performance",
        "Jeju Special Self-Governing Province — haenyeo population census records",
      ],
    },
    convenience: c.convenience,
    smartNotes: c.smartNotes,
    visitBasics: c.visitBasics,
    images: srcImages.slice(),
    imageCredits: srcImages.map((url) => ({ url, source: "atoc-korea" })),
    galleryItems: buildGalleryFor(name, srcImages, 1),
  };
}

function transform(loc) {
  const file = path.join(DIR, `${SLUG}.${loc}.json`);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const c = CONTENT[loc];

  const stops = doc.itineraryStops;
  const sPickup = stops[0];
  const sHamdeok = stops[1];
  const sSeongeup = stops[2];
  const sLunch = stops[4];
  const sSeongsan = stops[5];
  const sHaenyeoOld = stops[6];
  const sDropoff = stops[7];

  // Re-time / re-number kept stops
  sPickup.number = 1;
  sHamdeok.number = 2;
  sHamdeok.time = TIMES.hamdeok;
  sSeongeup.number = 3;
  sSeongeup.time = TIMES.seongeup;
  sLunch.number = 4;
  sLunch.time = TIMES.lunch;
  if (c.lunchDescription) sLunch.description = c.lunchDescription;
  sSeongsan.number = 5;
  sSeongsan.time = TIMES.seongsan;
  sDropoff.number = 8;
  sDropoff.time = TIMES.dropoff;

  // Reframe kept-stop whyOnRoute to the new sequence
  if (c.whyOnRoute) {
    if (c.whyOnRoute.hamdeok) sHamdeok.whyOnRoute = c.whyOnRoute.hamdeok;
    if (c.whyOnRoute.seongeup) sSeongeup.whyOnRoute = c.whyOnRoute.seongeup;
    if (c.whyOnRoute.lunch) sLunch.whyOnRoute = c.whyOnRoute.lunch;
    if (c.whyOnRoute.seongsan) sSeongsan.whyOnRoute = c.whyOnRoute.seongsan;
  }

  const haenyeo = haenyeoStop(loc, 6, sHaenyeoOld.images || []);
  const manjang = manjangStop(loc, 7);

  doc.itineraryStops = [
    sPickup,
    sHamdeok,
    sSeongeup,
    sLunch,
    sSeongsan,
    haenyeo,
    manjang,
    sDropoff,
  ];

  // Top-level gallery = concat in itinerary order, re-id sequentially
  const gallerySources = [
    sHamdeok.galleryItems || [],
    sSeongeup.galleryItems || [],
    sSeongsan.galleryItems || [],
    haenyeo.galleryItems || [],
    manjang.galleryItems || [],
  ];
  let gid = 1;
  doc.galleryItems = gallerySources.flat().map((g) => ({ ...g, id: gid++ }));

  // routeFlowStops — reorder + new entries
  const f = doc.routeFlowStops;
  doc.routeFlowStops = [
    f[0],
    f[1],
    f[2],
    f[4], // lunch
    f[5], // seongsan
    { name: c.routeFlow.haenyeoName, type: "primary", theme: c.routeFlow.haenyeoTheme },
    { name: c.routeFlow.manjangName, type: "primary", theme: c.routeFlow.manjangTheme },
    f[7],
  ];

  // routePhases
  doc.routePhases = c.routePhases;

  // routeShapeIntro subtitle
  if (doc.routeShapeIntro && c.routeShapeSubtitle) {
    doc.routeShapeIntro.subtitle = c.routeShapeSubtitle;
  }

  // SEO
  if (doc.seo) {
    if (c.seo.metaDescription) doc.seo.metaDescription = c.seo.metaDescription;
    if (c.seo.description) doc.seo.description = c.seo.description;
    if (c.seo.primaryKeywords) doc.seo.primaryKeywords = c.seo.primaryKeywords;
  }

  // catalog_card
  if (doc.catalog_card) {
    doc.catalog_card.shortCardDescription = c.catalog.shortCardDescription;
    doc.catalog_card.subtitle = c.catalog.subtitle;
    doc.catalog_card.priceLabel = c.catalog.priceLabel;
  }

  // whyTourWorks route-logic items
  if (
    doc.whyTourWorks &&
    Array.isArray(doc.whyTourWorks.routeLogicSections) &&
    doc.whyTourWorks.routeLogicSections[0] &&
    c.whyTourWorks &&
    c.whyTourWorks.items
  ) {
    doc.whyTourWorks.routeLogicSections[0].items = c.whyTourWorks.items;
  }

  // bookingTrustItems bodies (route + group)
  if (Array.isArray(doc.bookingTrustItems) && c.bookingTrust) {
    for (const it of doc.bookingTrustItems) {
      if (it.icon === "route" && c.bookingTrust.routeBody) it.body = c.bookingTrust.routeBody;
      if (it.icon === "users" && c.bookingTrust.groupBody) it.body = c.bookingTrust.groupBody;
    }
  }

  // staticQuestions
  if (c.staticQuestions) doc.staticQuestions = c.staticQuestions;

  // practicalAccordionItems — walking + cave
  if (Array.isArray(doc.practicalAccordionItems) && c.practical) {
    for (const it of doc.practicalAccordionItems) {
      if (it.id === "walking" && c.practical.walkingContent) {
        it.content = c.practical.walkingContent;
        it.preview = c.practical.walkingPreview || it.preview;
      }
      if (it.id === "cave" && c.practical.caveContent) {
        it.title = c.practical.caveTitle || it.title;
        it.preview = c.practical.cavePreview || it.preview;
        it.content = c.practical.caveContent;
      }
    }
  }

  // Price (top-level + sticky)
  doc.price = newPrice();
  if (doc.sticky_booking_bar) doc.sticky_booking_bar.price = newPrice();

  // Matching metadata / profile (shared English/numeric patch)
  doc.matching_metadata = patchMatchingMetadata(doc.matching_metadata);
  doc.matching_profile = patchMatchingProfile(doc.matching_profile);

  // Re-sync the (non-rendered) page_sections mirror from the updated top-level
  if (Array.isArray(doc.page_sections)) {
    for (const sec of doc.page_sections) {
      if (!sec || !sec.props) continue;
      const p = sec.props;
      for (const key of [
        "headlineLine1",
        "headlineLine2",
        "hero",
        "subnavItems",
        "glanceItems",
        "galleryItems",
        "itineraryStops",
        "routeFlowStops",
        "routePhases",
        "routeShapeIntro",
        "whyTourWorks",
        "practicalAccordionItems",
        "practicalWeatherStatic",
        "seasonalVariations",
        "bookingTrustItems",
        "bookingSupportSteps",
        "staticQuestions",
        "guestReviews",
        "reviewsSummary",
      ]) {
        if (key in p && key in doc) p[key] = JSON.parse(JSON.stringify(doc[key]));
      }
      if ("price" in p && doc.sticky_booking_bar) {
        p.price = JSON.parse(JSON.stringify(doc.sticky_booking_bar.price));
      }
    }
  }

  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc}`);
}

const only = process.argv[2];
for (const loc of LOCALES) {
  if (only && only !== loc) continue;
  if (!CONTENT[loc]) {
    console.log(`· skip ${loc} (no content yet)`);
    continue;
  }
  transform(loc);
}
console.log("done");
