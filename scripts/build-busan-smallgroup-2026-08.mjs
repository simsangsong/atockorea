#!/usr/bin/env node
/**
 * Builds the static bundles for the NEW product (owner instruction 2026-08-04):
 *   busan-small-group-yonggungsa-skycapsule-gamcheon-tour
 *   Yonggungsa → Cheongsapo Daritdol → Sky Capsule (ticket optional) → lunch
 *   → Gamcheon → Dakbatgol Mural Village & wish-stairs monorail
 *
 * Donor: busan-top-attractions-day-tour (same operator, same 3-station pickup,
 * shared Yonggungsa/Gamcheon/pickup/lunch-slot stops, Busan weather block).
 * Authored per-locale copy: scripts/busan-smallgroup-content/<loc>.json.
 *
 * Output: components/product-tour-static/busan-small-group-yonggungsa-skycapsule-gamcheon-tour/*.json
 * Run: node scripts/build-busan-smallgroup-2026-08.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "busan-small-group-yonggungsa-skycapsule-gamcheon-tour";
const DONOR = "busan-top-attractions-day-tour";
const OUT_DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const CONTENT_DIR = path.join(__dirname, "busan-smallgroup-content");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
// Staged locales (owner instruction 2026-08-04: "10-locale full translation").
// These bundles are NOT registered in the 6-locale product registries — the
// detail page narrows de/fr/it/ru to EN by design (i18n expansion track's
// human gate). They exist as staged translations: catalog build picks them up
// and the DB rows are staged INSERT-only in 2026-08-04-04 SQL, so the pages
// are ready the day the fallback gate opens. Donor pieces come from
// scripts/busan-smallgroup-content/donor-overlay/<loc>.json (translated from
// donor-overlay/en.json, which carries the already-patched pickup text).
const EXT_LOCALES = ["de", "fr", "it", "ru"];
const OVERLAY_DIR = path.join(CONTENT_DIR, "donor-overlay");

// Pickup & drop-off accordion for staged locales (donor's three factual lines).
const EXT_PICKUP_ACCORDION = {
  de: {
    title: "Abholung & Rückgabe",
    content: [
      "Drei Abholpunkte entlang der U-Bahn Busan: Seomyeon Station Ausgang 4 (08:30), Bahnhof Busan Ausgang 4 — nicht das KTX-Gate (08:50), Haeundae Station Ausgang 5 (09:30).",
      "Ausstiege in Reihenfolge: Nampo-dong/Jagalchi ≈17:50, Bahnhof Busan ≈18:10, Seomyeon ≈18:30, Haeundae ≈19:00.",
      "Ihre effektive Tourdauer hängt vom Abholpunkt ab: Seomyeon ≈10 Std., Haeundae ≈9,5 Std.",
    ],
  },
  fr: {
    title: "Prise en charge & dépose",
    content: [
      "Trois points de prise en charge le long du métro de Busan : station Seomyeon sortie 4 (08:30), gare de Busan sortie 4 — pas le portillon KTX (08:50), station Haeundae sortie 5 (09:30).",
      "Déposes dans l'ordre : Nampo-dong/Jagalchi ≈17:50, gare de Busan ≈18:10, Seomyeon ≈18:30, Haeundae ≈19:00.",
      "La durée effective du circuit dépend du point de prise en charge : Seomyeon ≈10 h, Haeundae ≈9,5 h.",
    ],
  },
  it: {
    title: "Prelievo e rientro",
    content: [
      "Tre punti di prelievo lungo la metropolitana di Busan: stazione Seomyeon uscita 4 (08:30), stazione di Busan uscita 4 — non il varco KTX (08:50), stazione Haeundae uscita 5 (09:30).",
      "Discese in sequenza: Nampo-dong/Jagalchi ≈17:50, stazione di Busan ≈18:10, Seomyeon ≈18:30, Haeundae ≈19:00.",
      "La durata effettiva del tour dipende dal punto di prelievo: Seomyeon ≈10 h, Haeundae ≈9,5 h.",
    ],
  },
  ru: {
    title: "Посадка и высадка",
    content: [
      "Три точки посадки вдоль метро Пусана: станция Сомён, выход 4 (08:30), вокзал Пусана, выход 4 — не турникеты KTX (08:50), станция Хэундэ, выход 5 (09:30).",
      "Высадка по порядку: Нампхо-дон/Чагальчхи ≈17:50, вокзал Пусана ≈18:10, Сомён ≈18:30, Хэундэ ≈19:00.",
      "Фактическая длительность тура зависит от точки посадки: Сомён ≈10 ч, Хэундэ ≈9,5 ч.",
    ],
  },
};

const HERO_IMG = "/images/tours/haedong-yonggungsa/haedong-yonggungsa-sunrise-cliff.webp";
const SKYCAP_IMAGES = [
  "/images/tours/cheongsapo-blue-line/cheongsapo-sky-capsule-interior.webp",
  "/images/tours/cheongsapo-blue-line/blueline-tram-cherry-sea.webp",
  "/images/tours/cheongsapo-blue-line/chatgpt-image-2026-5-10-01-01-18.webp",
  "/images/tours/cheongsapo-blue-line/chatgpt-image-2026-5-10-12-53-19.webp",
];

const TIMES = {
  pickup: "≈ 08:30–09:30",
  yonggungsa: "≈ 10:00",
  daritdol: "≈ 11:45",
  skycapsule: "≈ 12:35",
  lunch: "≈ 13:25",
  gamcheon: "≈ 15:00",
  dakbatgol: "≈ 16:50",
  dropoff: "≈ 17:50",
};

// Donor pickup-stop description names the donor route's later stops — patch to ours.
const PICKUP_DESC_PATCH = {
  en: [
    "to keep the day on track for the later UN Memorial Cemetery and Gamcheon stops, which have stricter operating windows.",
    "to keep the day on track for the later Gamcheon and Dakbatgol village stops.",
  ],
  ko: [
    "이후 UN기념공원 및 감천문화마을 방문 일정을 원활히 진행하기 위해 예정 시각 5분 전에 탑승 장소에 나와 계시기 바랍니다. 해당 방문지들은 운영 시간이 제한적입니다.",
    "이후 감천문화마을과 닥밭골 방문 일정을 원활히 진행하기 위해 예정 시각 5분 전에 탑승 장소에 나와 계시기 바랍니다.",
  ],
  ja: [
    "UN記念公園や甘川（カムチョン）への訪問は時間の制約が厳しいため、予定時刻の5分前には乗車場所でお待ちください。",
    "甘川（カムチョン）やタクバッコルへの訪問時間を確保するため、予定時刻の5分前には乗車場所でお待ちください。",
  ],
  zh: [
    "以确保行程顺利推进，不耽误后续联合国纪念公园和甘川洞等开放时间较严格的景点。",
    "以确保行程顺利推进，不耽误后续甘川文化村与Dakbatgol的游览时间。",
  ],
  "zh-TW": [
    "以確保後續聯合國紀念公墓及甘川洞等景點的行程順利進行，這些景點的開放時段較為嚴格。",
    "以確保後續甘川文化村及Dakbatgol的遊覽時間充裕。",
  ],
  es: [
    "para mantener el ritmo del día, especialmente en las paradas posteriores del Cementerio Memorial de la ONU y Gamcheon, que tienen horarios de funcionamiento más estrictos.",
    "para mantener el ritmo del día, especialmente de cara a las paradas posteriores de Gamcheon y Dakbatgol.",
  ],
};

// Route-flow themes stay English across locales (donor convention).
const FLOW_NEW = {
  daritdol: { type: "secondary", theme: "Glass Skywalk" },
  skycapsule: { type: "primary", theme: "Sky Capsule" },
  dakbatgol: { type: "secondary", theme: "Mural Village" },
};

// Matching metadata is locale-invariant (EN) across all bundles.
const MATCHING_METADATA = {
  primary_themes: [
    "busan",
    "coastal",
    "seaside_temple",
    "sky_capsule",
    "culture_village",
    "mural_village",
    "small_group",
  ],
  secondary_themes: [
    "glass_skywalk",
    "blueline_park",
    "gamcheon",
    "dakbatgol_monorail",
    "photo_spots",
    "free_admission_anchors",
    "first_time_busan",
  ],
  best_for: [
    "first_time_busan",
    "couples",
    "photo_lovers",
    "adult_families",
    "small_group_seekers",
  ],
  not_recommended_for: [
    "minimal_walking_seekers",
    "stroller_heavy_groups",
    "nightlife_focused_travelers",
  ],
  anchor_pois: [
    "Haedong Yonggungsa Temple",
    "Cheongsapo Daritdol Observatory",
    "Haeundae Blueline Park Sky Capsule",
    "Gamcheon Culture Village",
    "Dakbatgol Mural Village",
  ],
  anchor_poi_keys: [
    "haedong_yonggungsa",
    "cheongsapo_daritdol_observatory",
    "cheongsapo_blue_line_park",
    "gamcheon_culture_village",
    "dakbatgol_mural_village",
  ],
  competing_products: [
    "busan-top-attractions-day-tour",
    "busan-small-group-sightseeing-tour-cruise-passengers",
    "busan-private-car-charter-cruise-shore",
  ],
  reviews_attribution: "New product (2026-08) — no imported reviews; rating starts at 0.",
  unesco_fit_note:
    "No UNESCO property on this route. Cultural weight comes from the seaside temple (1376 founding), Korean-War refugee village heritage at Gamcheon, and hanji paper-mulberry heritage at Dakbatgol.",
};

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

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

const STOP_TEXT_FIELDS = [
  "name", "category", "duration", "description", "highlights",
  "timeUsed", "whyOnRoute", "visitBasics", "convenience", "smartNotes",
];

function applyOverlayStop(stop, overlayStop, ctx) {
  for (const k of STOP_TEXT_FIELDS) {
    if (k in overlayStop) stop[k] = clone(overlayStop[k]);
    else if (k in stop && stop[k] !== undefined) {
      throw new Error(`${ctx}: overlay missing translated field "${k}"`);
    }
  }
}

function build(loc) {
  const isExt = EXT_LOCALES.includes(loc);
  // Staged locales build on the EN donor + translated overlay.
  const donorLoc = isExt ? "en" : loc;
  const donor = JSON.parse(
    readFileSync(path.join(ROOT, "components/product-tour-static", DONOR, `${DONOR}.${donorLoc}.json`), "utf8"),
  );
  const c = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));
  const overlay = isExt
    ? JSON.parse(readFileSync(path.join(OVERLAY_DIR, `${loc}.json`), "utf8"))
    : null;

  if (donor.itineraryStops.length !== 7) throw new Error(`[${loc}] donor stops != 7`);

  // ---- stops ---------------------------------------------------------------
  const sPickup = clone(donor.itineraryStops[0]);
  sPickup.number = 1;
  sPickup.time = TIMES.pickup;
  if (isExt) {
    applyOverlayStop(sPickup, overlay.pickupStop, `[${loc}] pickupStop`);
  } else {
    const [pFrom, pTo] = PICKUP_DESC_PATCH[loc];
    if (!sPickup.description.includes(pFrom)) {
      throw new Error(`[${loc}] pickup desc patch source not found`);
    }
    sPickup.description = sPickup.description.split(pFrom).join(pTo);
  }

  const sYong = clone(donor.itineraryStops[1]);
  sYong.number = 2;
  sYong.time = TIMES.yonggungsa;
  if (isExt) applyOverlayStop(sYong, overlay.yonggungsaStop, `[${loc}] yonggungsaStop`);
  sYong.whyOnRoute = c.yonggungsaWhy;

  const sDaritdol = authoredStop(c.daritdol, 3, TIMES.daritdol, {
    poiMeta: {
      match: "authored",
      poi_key: "cheongsapo_daritdol_observatory",
      sources: ["Visit Busan", "Busan Metropolitan City Tourism", "Blue Line Park official"],
      verified: false,
      verified_date: "2026-08-04",
    },
  });

  const sCapsule = authoredStop(c.skycapsule, 4, TIMES.skycapsule, {
    images: SKYCAP_IMAGES,
    poiMeta: {
      match: "partial",
      poi_key: "cheongsapo_blue_line_park",
      sources: ["Blue Line Park official", "Visit Busan", "Busan Metropolitan City Tourism"],
      verified: true,
      kb_version: "1.24",
      verified_date: "2026-08-04",
    },
  });

  const sLunch = clone(donor.itineraryStops[3]);
  sLunch.number = 5;
  sLunch.time = TIMES.lunch;
  sLunch.name = c.lunch.name;
  sLunch.category = c.lunch.category;
  sLunch.duration = c.lunch.duration;
  sLunch.description = c.lunch.description;
  sLunch.whyOnRoute = c.lunch.whyOnRoute;
  if (c.lunch.timeUsed) sLunch.timeUsed = c.lunch.timeUsed;
  sLunch.highlights = [];

  const sGamcheon = clone(donor.itineraryStops[5]);
  sGamcheon.number = 6;
  sGamcheon.time = TIMES.gamcheon;
  if (isExt) applyOverlayStop(sGamcheon, overlay.gamcheonStop, `[${loc}] gamcheonStop`);
  sGamcheon.duration = "90 min";
  sGamcheon.whyOnRoute = c.gamcheonWhy;

  const sDakbatgol = authoredStop(c.dakbatgol, 7, TIMES.dakbatgol, {
    poiMeta: {
      match: "authored",
      poi_key: "dakbatgol_mural_village",
      sources: ["Visit Busan", "Busan Seo-gu Office"],
      verified: false,
      verified_date: "2026-08-04",
    },
  });

  const sDropoff = authoredStop(c.dropoff, 8, TIMES.dropoff, {});

  const stops = [sPickup, sYong, sDaritdol, sCapsule, sLunch, sGamcheon, sDakbatgol, sDropoff];

  // ---- gallery -------------------------------------------------------------
  let gid = 1;
  const galleryItems = [sYong, sCapsule, sGamcheon]
    .map((s) => s.galleryItems || [])
    .flat()
    .map((g) => ({ ...g, id: gid++ }));

  // ---- route flow ----------------------------------------------------------
  const f = donor.routeFlowStops;
  if (f.length !== 7) throw new Error(`[${loc}] donor flow != 7`);
  const flowName = (idx, key) =>
    isExt ? overlay.flowNames[key] : clone(f[idx]).name;
  const routeFlowStops = [
    { ...clone(f[0]), name: flowName(0, "pickup") }, // origin
    { ...clone(f[1]), name: flowName(1, "yonggungsa") },
    { name: c.daritdol.name, ...FLOW_NEW.daritdol },
    { name: c.skycapsule.name, ...FLOW_NEW.skycapsule },
    { ...clone(f[3]), name: flowName(3, "lunch") },
    { ...clone(f[5]), name: flowName(5, "gamcheon") },
    { name: c.dakbatgol.name, ...FLOW_NEW.dakbatgol },
    { name: c.dropoff.name, type: "return", theme: "Return" },
  ];

  // ---- price / cards -------------------------------------------------------
  const price = { amountLabel: "59", currency: "USD", per: "person", salePriceUsd: 59 };
  const heroStops = isExt
    ? overlay.heroStopsLabel
    : String(donor.hero?.meta?.stops ?? "8 stops").replace(/\d+/, "8");

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
    pills: clone(isExt ? overlay.heroPills : donor.hero?.pills || []),
    meta: {
      duration: c.heroDuration,
      region: c.region,
      stops: heroStops,
      rating: 0,
      ratingStars: 0,
    },
  };

  // ---- practical accordion -------------------------------------------------
  const practicalAccordionItems = [];
  const practicalSource = isExt
    ? donor.practicalAccordionItems.map((item) => {
        if (item.id === "pickup") {
          const t = EXT_PICKUP_ACCORDION[loc];
          return { id: "pickup", title: t.title, preview: t.content[0], content: t.content };
        }
        const tr = overlay.practicalItems[item.id];
        if (tr) return { ...clone(item), ...clone(tr) };
        return clone(item); // inclusions/walking replaced below from content spec
      })
    : donor.practicalAccordionItems;
  for (const item of practicalSource) {
    if (item.id === "inclusions") {
      const it = clone(item);
      it.content = c.practical.inclusionsContent;
      it.preview = c.practical.inclusionsContent[0];
      practicalAccordionItems.push(it);
      continue;
    }
    if (item.id === "walking") {
      const it = clone(item);
      it.content = c.practical.walkingContent;
      it.preview = c.practical.walkingContent[0];
      practicalAccordionItems.push(it);
      // capsule item right after walking
      practicalAccordionItems.push({
        id: "capsule",
        title: c.practical.capsuleTitle,
        preview: c.practical.capsulePreview,
        content: c.practical.capsuleContent,
      });
      continue;
    }
    practicalAccordionItems.push(clone(item));
  }

  // ---- matching profile (donor-derived; identity + anchors patched) --------
  const matching_profile = clone(donor.matching_profile);
  matching_profile.product_id = SLUG;
  matching_profile.is_active = true;
  matching_profile.profile_version = 1;
  matching_profile.poi_tags = MATCHING_METADATA.anchor_poi_keys.slice();
  matching_profile.anchor_poi_keys = MATCHING_METADATA.anchor_poi_keys.slice();
  if ("small_group_fit" in matching_profile) matching_profile.small_group_fit = 1;
  if ("shopping_fit" in matching_profile) matching_profile.shopping_fit = 0.2;
  if ("unesco_fit" in matching_profile) matching_profile.unesco_fit = 0;
  if ("beach_fit" in matching_profile) matching_profile.beach_fit = 0.6;
  if ("cafe_fit" in matching_profile) matching_profile.cafe_fit = 0.7;

  // ---- pickup/dropoff (locale overlays omit it — fall back to EN donor) ----
  const donorPd =
    donor.pickup_dropoff ||
    JSON.parse(
      readFileSync(path.join(ROOT, "components/product-tour-static", DONOR, `${DONOR}.en.json`), "utf8"),
    ).pickup_dropoff;
  const pickup_dropoff = {
    departure: clone(donorPd.departure),
    return: clone(donorPd.return),
    notes: c.pdNotes,
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
    glanceItems: clone(isExt ? overlay.glanceItems : donor.glanceItems),
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
          title: clone(donor.whyTourWorks.routeLogicSections?.[0]?.title) || "Route logic",
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
      note: isExt ? overlay.stickyNote : donor.sticky_booking_bar?.note || "",
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
          "New product (owner instruction 2026-08-04). Donor: busan-top-attractions-day-tour — pickup/Yonggungsa/lunch-slot/Gamcheon stops, 3-station pickup_dropoff, Busan weather/glance/trust/support blocks reused per locale; Daritdol Observatory, Sky Capsule (ticket-optional), Dakbatgol Mural Village & wish-stairs monorail, and all product-level copy authored fresh in 6 locales (scripts/busan-smallgroup-content/). matching_profile derived from donor with identity/anchor patches — full KB calibration pending. Price set by owner (2026-08-04): USD 59 Sky Capsule ticket excluded / USD 79 ticket included. Daritdol and Dakbatgol ship without photos (no owned imagery yet).",
      },
    },
  };

  // ---- page_sections mirror (donor section list, props resynced) ----------
  const page_sections = clone(donor.page_sections || []);
  for (const sec of page_sections) {
    if (!sec || !sec.props) continue;
    const p = sec.props;
    for (const key of Object.keys(p)) {
      if (key === "price") {
        p.price = clone(price);
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

import { existsSync } from "node:fs";
for (const loc of LOCALES) build(loc);
for (const loc of EXT_LOCALES) {
  if (existsSync(path.join(OVERLAY_DIR, `${loc}.json`)) && existsSync(path.join(CONTENT_DIR, `${loc}.json`))) {
    build(loc);
  } else {
    console.log(`· skip ${loc} (translations not present yet)`);
  }
}
console.log("done");
