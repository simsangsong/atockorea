#!/usr/bin/env node
/**
 * Rebuilds pocheon-sanjeong-lake-herb-island-art-valley for the 2026-08-04
 * course revision (owner instruction, referencing the competitor Klook listing).
 *
 *   OLD: Sanjeong Lake → Pocheon Herb Island → Pocheon Art Valley
 *   NEW: Sanjeong Lake → Idong-galbi lunch → Jaein Falls → Pocheon Art Valley
 *
 * Herb Island is dropped; Jaein Falls (Yeoncheon) joins as the day's second
 * Hantangang UNESCO Global Geopark geosite alongside Art Valley, and a local
 * lunch stop is added. All four stop bodies are rewritten from the per-locale
 * spec, so no Herb-Island-era text can survive anywhere in the bundle.
 *
 * 🔴 SLUG IS DELIBERATELY UNCHANGED. It still carries the legacy
 * "herb-island" token because this is an ACTIVE Klook SKU — the slug is the
 * live URL and the OTA linkage. Renaming it would break both. The mismatch
 * between slug and course is a known, accepted cost; see the handoff doc.
 *
 * Locales: en/ko/ja/zh/zh-TW/es are content locales (registered, served).
 * de/fr/it/ru are STAGED — built from the EN shell plus a translated
 * donor-overlay, invisible to guests until the TOUR_PRODUCT_FALLBACK_URL_LOCALES
 * gate opens (a separate human decision, i18n expansion track).
 *
 * Run: node scripts/build-pocheon-geopark-2026-08.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "pocheon-sanjeong-lake-herb-island-art-valley";
/**
 * Owner-supplied Klook availability calendar (2026-08-04): a fixed-schedule
 * departure, Monday / Thursday / Saturday only. Lower-case English keys, the
 * same vocabulary `matching_profile.available_days_signature` uses, so the two
 * can be diffed — but this one is what the guest-facing date picker reads.
 */
const DEPARTURE_WEEKDAYS = ["monday", "thursday", "saturday"];
const DIR = path.join(ROOT, "components/product-tour-static", SLUG);
const CONTENT_DIR = path.join(__dirname, "pocheon-geopark-content");
const OVERLAY_DIR = path.join(CONTENT_DIR, "donor-overlay");

const CONTENT_LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const EXT_LOCALES = ["de", "fr", "it", "ru"];

const KB = JSON.parse(
  readFileSync(path.join(ROOT, "data/poi_kb/poi_knowledge_base_v1.29.json"), "utf8"),
);
const KB_VERSION = KB._metadata.version;

const IMG = {
  sanjeong: [
    "/images/tours/sanjeong-lake/chatgpt-image-2026-5-10-10-42-25.webp",
    "/images/tours/sanjeong-lake/chatgpt-image-2026-5-10-10-42-29.webp",
  ],
  artvalley: [
    "/images/tours/pocheon-art-valley/chatgpt-image-2026-5-10-10-38-52.webp",
    "/images/tours/pocheon-art-valley/chatgpt-image-2026-5-10-10-38-57.webp",
  ],
  // Jaein Falls and the lunch stop have no owned imagery yet — they ship
  // image-less rather than borrowing another POI's photo.
  jaein: [],
  lunch: [],
};

const HERO_IMG = IMG.sanjeong[0];

const STOP_ORDER = ["sanjeong", "lunch", "jaein", "artvalley"];

const POI_META = {
  sanjeong: {
    poi_key: "sanjeong_lake",
    verified: true,
    match: "single_poi",
    kb_version: KB_VERSION,
    verified_date: "2026-08-04",
  },
  jaein: {
    poi_key: "jaein_falls",
    verified: true,
    match: "single_poi",
    kb_version: KB_VERSION,
    verified_date: "2026-08-04",
  },
  artvalley: {
    poi_key: "pocheon_art_valley",
    verified: true,
    match: "single_poi",
    kb_version: KB_VERSION,
    verified_date: "2026-08-04",
  },
  lunch: null,
};

const clone = (v) => JSON.parse(JSON.stringify(v));

function buildGallery(name, srcs, startId) {
  return srcs.map((src, i) => ({
    id: startId + i,
    type: "photo",
    src,
    location: name,
    alt: `${name} — gallery image ${i + 1}`,
    caption: `${name} — photo ${i + 1}`,
  }));
}

function buildStop(key, spec, number) {
  const s = spec.stops[key];
  const images = IMG[key] || [];
  const stop = {
    number,
    time: s.time,
    duration: s.duration,
    name: s.name,
    category: s.category,
    description: s.description,
    highlights: s.highlights || [],
    timeUsed: s.timeUsed || [],
    whyOnRoute: s.whyOnRoute,
    image: images[0] || null,
    images: images.slice(),
    imageCredits: images.map((url) => ({ url, source: "atoc-korea" })),
    galleryItems: images.length ? buildGallery(s.name, images, 1) : [],
  };
  if (s.visitBasics) stop.visitBasics = s.visitBasics;
  if (s.convenience) stop.convenience = s.convenience;
  if (s.smartNotes) stop.smartNotes = s.smartNotes;
  if (POI_META[key]) stop._poi_meta = clone(POI_META[key]);
  return stop;
}

function build(loc) {
  const isExt = EXT_LOCALES.includes(loc);
  const baseFile = path.join(DIR, `${SLUG}.${isExt ? "en" : loc}.json`);
  const doc = JSON.parse(readFileSync(baseFile, "utf8"));
  const spec = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));
  const overlay = isExt
    ? JSON.parse(readFileSync(path.join(OVERLAY_DIR, `${loc}.json`), "utf8"))
    : null;

  doc.locale = loc;

  // ---- stops ---------------------------------------------------------------
  doc.itineraryStops = STOP_ORDER.map((key, i) => buildStop(key, spec, i + 1));

  // ---- gallery: attraction stops in itinerary order, re-id -----------------
  let gid = 1;
  doc.galleryItems = doc.itineraryStops
    .flatMap((s) => s.galleryItems || [])
    .map((g) => ({ ...g, id: gid++ }));

  // ---- narrative -----------------------------------------------------------
  doc.routeFlowStops = clone(spec.routeFlowStops);
  doc.routePhases = clone(spec.routePhases);
  doc.routeShapeIntro = clone(spec.routeShapeIntro);
  doc.seasonalVariations = clone(spec.seasonalVariations);
  doc.staticQuestions = clone(spec.staticQuestions);
  doc.glanceItems = clone(spec.glanceItems);

  /**
   * Owner-supplied 2026-08-04 (Klook availability calendar): this is a
   * fixed-schedule departure running Monday / Thursday / Saturday only. The
   * bundle previously made no departure-day claim at all, so a guest could
   * pick any date and only discover the constraint at checkout.
   */
  const dd = spec.departureDays;
  if (!dd) throw new Error(`[${loc}] spec is missing departureDays`);
  doc.staticQuestions.splice(1, 0, { question: dd.faqQ, answer: dd.faqA });

  /**
   * 🔴 The machine-readable half. Everything above is prose — a badge, an
   * accordion, an FAQ, a lessIdealFor line — and prose does not stop anyone
   * booking a Tuesday. `matching_profile.available_days_signature` carries the
   * same three days but that block is FORBIDDEN in segments.ts (recommender
   * input, never translated, not in the view model), so the booking UI must not
   * read it. This field is the presentational one the date picker filters on.
   *
   * Locale-invariant on purpose: weekday KEYS are not translated. The visible
   * wording lives in the spec per locale; this is the contract.
   */
  doc.departureWeekdays = [...DEPARTURE_WEEKDAYS];

  doc.whyTourWorks = {
    ...doc.whyTourWorks,
    bestFor: clone(spec.whyTourWorks.bestFor),
    lessIdealFor: [...clone(spec.whyTourWorks.lessIdealFor), dd.lessIdeal],
    routeLogicSections: [
      {
        ...(doc.whyTourWorks.routeLogicSections?.[0] ?? {
          icon: "route",
          iconBg: "bg-sky-50/80",
          iconColor: "text-sky-600",
        }),
        items: clone(spec.whyTourWorks.items),
      },
    ],
  };

  // ---- headline / hero / cards / seo ---------------------------------------
  doc.headlineLine1 = spec.headlineLine1;
  doc.headlineLine2 = spec.headlineLine2;
  doc.hero = {
    ...doc.hero,
    imageUrl: HERO_IMG,
    tagline: spec.heroTagline,
    pills: clone(spec.heroPills),
    meta: {
      ...doc.hero.meta,
      duration: spec.heroDuration,
      region: spec.region,
      stops: spec.heroStopsLabel,
    },
  };
  doc.catalog_card = {
    ...doc.catalog_card,
    title: spec.title,
    subtitle: spec.subtitle,
    shortCardDescription: spec.shortCardDescription,
    region: spec.region,
    duration: spec.duration,
    stopsCount: spec.stopsCount,
    badges: (() => {
      const b = clone(spec.badges).filter((x) => x !== dd.badge);
      b.splice(1, 0, dd.badge);
      return b;
    })(),
    tags: clone(spec.tags),
    heroImage: HERO_IMG,
    thumbnail: HERO_IMG,
  };
  doc.seo = {
    ...doc.seo,
    pageTitle: spec.seo.pageTitle,
    metaDescription: spec.seo.metaDescription,
    title: spec.seo.title,
    primaryKeywords: clone(spec.seo.primaryKeywords),
    ogImage: `https://www.atockorea.com${HERO_IMG}`,
  };

  // ---- practical accordion --------------------------------------------------
  // Carryover items come from the base bundle (or the overlay for staged
  // locales); walking + included are rewritten; a geopark item is appended.
  const carry = (id) => {
    if (isExt) {
      const t = overlay.practicalCarryover[id];
      const base = doc.practicalAccordionItems.find((p) => p.id === id);
      return t ? { ...clone(base), ...clone(t) } : clone(base);
    }
    return clone(doc.practicalAccordionItems.find((p) => p.id === id));
  };
  const rewrite = (id, title, content) => {
    const base = doc.practicalAccordionItems.find((p) => p.id === id);
    return { ...clone(base), title, preview: content[0], content: clone(content) };
  };
  /**
   * The base "weather" item listed the old route's seasons and still named
   * Herb Island lavender and its light festival. Rebuild its seasonal lines
   * from the (already translated) seasonalVariations and keep the base item's
   * final line, which is the rain policy rather than a season.
   */
  const weatherItem = () => {
    const base = carry("weather");
    if (!Array.isArray(base.content) || base.content.length < 2) {
      throw new Error(`[${loc}] weather accordion has an unexpected shape`);
    }
    const rainPolicy = base.content[base.content.length - 1];
    return {
      ...base,
      content: [...spec.seasonalVariations.map((s) => `${s.season}: ${s.description}`), rainPolicy],
    };
  };
  doc.practicalAccordionItems = [
    {
      id: "departure-days",
      title: dd.accordionTitle,
      preview: dd.accordionContent[0],
      content: clone(dd.accordionContent),
    },
    rewrite("pickup", carry("pickup").title, spec.pickupDropoff.accordionContent),
    rewrite("walking", spec.practical.walkingTitle, spec.practical.walkingContent),
    weatherItem(),
    carry("wear"),
    rewrite("included", spec.practical.includedTitle, spec.practical.includedContent),
    {
      id: "geopark",
      title: spec.practical.geoparkTitle,
      preview: spec.practical.geoparkPreview,
      content: clone(spec.practical.geoparkContent),
    },
    carry("cancellation"),
  ].filter(Boolean);

  // ---- staged-locale shell blocks ------------------------------------------
  if (isExt) {
    doc.subnavItems = clone(overlay.subnavItems);
    doc.bookingTrustItems = clone(overlay.bookingTrustItems);
    doc.bookingSupportSteps = clone(overlay.bookingSupportSteps);
    doc.practicalWeatherStatic = clone(overlay.practicalWeatherStatic);
  }

  // ---- pickup / drop-off (owner-supplied 2026-08-04) ------------------------
  // Two meeting points now, not three: Hongik Exit 8 at 08:00 and Myeongdong
  // Exit 2 at 08:30, returning Myeongdong ≈18:00 then Hongik ≈18:30. The
  // Dongdaemun point is gone, so this replaces the arrays rather than merging
  // into them — a merge would leave the third stale entry behind.
  const pd = spec.pickupDropoff;
  if (!pd || !Array.isArray(pd.meetingPoints) || pd.meetingPoints.length !== 2) {
    throw new Error(`[${loc}] spec.pickupDropoff must carry exactly 2 meeting points`);
  }
  doc.pickup_dropoff = {
    ...doc.pickup_dropoff,
    meeting_points: pd.meetingPoints.map((m) => ({ name: m.name, time: m.time, note: m.note })),
    dropoff_points: pd.dropoffPoints.map((m) => ({ name: m.name, time: m.time, note: m.note })),
    notes: spec.pdNotes,
  };

  // ---- sticky bar ----------------------------------------------------------
  // The base bundle shipped a mistranslated dev comment here in every locale
  // ("checkout_tour_id resolves at runtime…"). Replace it with real copy.
  doc.sticky_booking_bar = {
    ...doc.sticky_booking_bar,
    note: spec.stickyNote,
  };

  // ---- matching profile / metadata -----------------------------------------
  const mm = spec.matchingMetadata;
  doc.matching_metadata = {
    ...doc.matching_metadata,
    ...clone(mm),
    stop_count: spec.stopsCount,
    enrichment_kb_version: KB_VERSION,
    enrichment_date: "2026-08-04",
    score_rationale: {
      ...(doc.matching_metadata.score_rationale ?? {}),
      photo_level:
        "Maxed — the emerald quarry lake under 50 m granite walls, an 18 m waterfall framed head-on from a suspension bridge, and mist-and-mountain reflections on the lake are three distinct hero frames.",
      rain_fit:
        "3 — mostly outdoor. Art Valley has a small indoor cafe and exhibition space, but Sanjeong Lake and the Jaein Falls gorge are fully exposed, and heavy summer rain can close the Jaein deck sections.",
    },
  };
  const mp = doc.matching_profile;
  mp.poi_tags = clone(mm.anchor_poi_keys);
  mp.anchor_poi_keys = clone(mm.anchor_poi_keys);
  // These are matching-engine fields (English machine data in every locale).
  // They still described the Herb Island route, which would keep steering the
  // recommender at a stop the tour no longer visits.
  mp.walking_notes = [
    "This is one of the gentler day-trips from Seoul, with mostly easy walking and optional shorter routes.",
    "Sanjeong Lake offers a short half-loop along the boardwalk for travelers who do not want the full 3.2 km.",
    "Jaein Falls has a swaying 80 m suspension bridge and a stepped boardwalk down toward the plunge pool; both are optional and the rim viewpoint sees the falls without either.",
    "Pocheon Art Valley has a monorail option that handles the uphill section to the quarry observatory.",
    "Comfortable walking shoes with grip are recommended; the Jaein Falls boardwalk can be wet.",
  ];
  mp.keywords = [
    "pocheon day trip from seoul",
    "sanjeong lake jaein falls art valley tour",
    "jaein falls suspension bridge tour",
    "hantangang unesco global geopark tour",
    "pocheon art valley monorail tour",
    "pocheon nature day trip",
    "seoul to pocheon small group",
    "less crowded gyeonggi day trip",
    "korea waterfall day tour from seoul",
    "yeoncheon geopark day tour",
  ];
  mp.signature_window_label =
    "Year-round on Monday / Thursday / Saturday departures (peak: October-November silver-grass + autumn foliage; summer for peak waterfall flow; mid-Dec to mid-Feb Sanjeong Sledding Festival + frozen Cheonjuho)";
  // Fixed departure days (owner-supplied Klook calendar, 2026-08-04).
  mp.available_days_signature = ["monday", "thursday", "saturday"];
  mp.fixed_departure_monday_thursday_saturday = true;
  /**
   * Herb Island is no longer on the route, but these bespoke signals survived
   * the re-course and were still scored 1 — which would keep the recommender
   * surfacing this tour for herb-garden, lighting-festival and drama-filming
   * intents it can no longer serve. No code reads them by name.
   */
  for (const stale of [
    "mediterranean_herb_garden_fit",
    "year_round_lighting_festival_fit",
    "korea_largest_herb_museum_fit",
    "korea_drama_filming_density_high_fit",
    "legend_of_the_blue_sea_filming_fit",
    "moon_lovers_scarlet_heart_ryeo_filming_fit",
  ]) {
    delete mp[stale];
  }
  // Owner-supplied 2026-08-04 window: 08:00 Hongik / 08:30 Myeongdong out,
  // Myeongdong ≈18:00 / Hongik ≈18:30 back. Was 18:30-19:30 on three points.
  if ("return_time_band" in mp) mp.return_time_band = "18:00-18:30";
  if ("unesco_fit" in mp) mp.unesco_fit = 0.7;
  if ("unesco_fit" in mp) mp.unesco_fit = 0.7;
  if ("waterfall_fit" in mp) mp.waterfall_fit = 1;
  if ("nature_fit" in mp) mp.nature_fit = 1;
  if ("garden_fit" in mp) mp.garden_fit = 0.2;
  if ("flower_fit" in mp) mp.flower_fit = 0.3;
  mp.profile_version = (Number(mp.profile_version) || 0) + 1;

  const NRF = "travelers_needing_non_monday_thursday_saturday_dates";
  if (Array.isArray(doc.matching_metadata.not_recommended_for)) {
    if (!doc.matching_metadata.not_recommended_for.includes(NRF)) {
      doc.matching_metadata.not_recommended_for.push(NRF);
    }
  } else {
    doc.matching_metadata.not_recommended_for = [NRF];
  }

  // ---- publication log -----------------------------------------------------
  doc._publication = {
    ...(doc._publication ?? {}),
    last_modified: "2026-08-04",
    fix_passes: {
      ...(doc._publication?.fix_passes ?? {}),
      v19_geopark_recourse_2026_08_04:
        "Course revision (owner instruction, referencing a competitor listing): Herb Island dropped; " +
        "Jaein Falls (Yeoncheon) added as the day's second Hantangang UNESCO Global Geopark geosite " +
        "alongside Art Valley, plus an Idong-galbi lunch stop. New order: Sanjeong Lake → lunch → " +
        "Jaein Falls → Art Valley. All four stop bodies rewritten from scripts/pocheon-geopark-content/, " +
        "so no Herb-Island-era text survives. POI KB bumped to v" + KB_VERSION + " (jaein_falls added; " +
        "art valley 2026 fares + geosite status; sanjeong lake 3.2 km loop + sculpture symposium + " +
        "Gungye legend). Sticky-bar note replaced — the bundle previously shipped a dev comment " +
        "('checkout_tour_id resolves at runtime…') as guest-facing copy in every locale. " +
        "SLUG UNCHANGED on purpose: it is an active Klook SKU and the slug is the live URL/OTA link, " +
        "so it still carries the legacy 'herb-island' token. Price untouched (owner decision pending). " +
        "Jaein Falls and the lunch stop ship without photos — no owned imagery yet. " +
        "Departure days added (owner-supplied Klook calendar): Monday / Thursday / Saturday only. " +
        "The bundle previously made no departure-day claim at all, so guests could pick any date " +
        "and hit the constraint only at checkout. Six Herb-Island-era matching signals " +
        "(herb garden, lighting festival, herb museum, drama-filming density, and two K-drama " +
        "title fits) were still scored 1 and are now dropped.",
    },
  };

  // ---- page_sections mirror -------------------------------------------------
  if (Array.isArray(doc.page_sections)) {
    for (const sec of doc.page_sections) {
      if (!sec || !sec.props) continue;
      const p = sec.props;
      for (const key of Object.keys(p)) {
        if (key === "note" && doc.sticky_booking_bar) {
          p.note = doc.sticky_booking_bar.note;
          continue;
        }
        if (key === "price" && doc.sticky_booking_bar) {
          p.price = clone(doc.sticky_booking_bar.price);
          continue;
        }
        if (key in doc) p[key] = clone(doc[key]);
      }
    }
  }

  writeFileSync(path.join(DIR, `${SLUG}.${loc}.json`), JSON.stringify(doc, null, 2) + "\n", "utf8");
  const stops = doc.itineraryStops.map((s) => s.name).join(" → ");
  console.log(`✓ ${loc.padEnd(6)} ${stops.slice(0, 78)}`);
}

for (const loc of CONTENT_LOCALES) {
  if (!existsSync(path.join(CONTENT_DIR, `${loc}.json`))) {
    console.log(`· skip ${loc} (spec not present yet)`);
    continue;
  }
  build(loc);
}
for (const loc of EXT_LOCALES) {
  if (
    existsSync(path.join(CONTENT_DIR, `${loc}.json`)) &&
    existsSync(path.join(OVERLAY_DIR, `${loc}.json`))
  ) {
    build(loc);
  } else {
    console.log(`· skip ${loc} (translations not present yet)`);
  }
}
console.log("done");
