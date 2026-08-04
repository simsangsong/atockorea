#!/usr/bin/env node
/**
 * One-off transform: reorder the Jeju Eastern UNESCO Spots Day Tour (2026-08).
 *
 * Old course: Hamdeok → Seongeup → Lunch → Seongsan → Haenyeo → Manjanggul
 * New course: Manjanggul → Seongeup → Lunch → Seongsan → Haenyeo → Hamdeok
 *   (pickup/drop-off points and the stop set unchanged — pure reorder)
 *
 * Rationale (owner instruction 2026-08-04): cave-first at Manjanggul's 09:00
 * opening beats the midday tour-bus crowds; Hamdeok Beach becomes the
 * late-afternoon finale and, being the closest stop to Jeju City, keeps the
 * final transfer the shortest of the day.
 *
 * Applies to all 6 locale bundles: itineraryStops order/times/numbers,
 * galleryItems order, routeFlowStops order, routePhases, routeShapeIntro,
 * whyTourWorks (new route-logic item), SEO, catalog_card, per-stop whyOnRoute,
 * targeted description patches, walking-accordion line order, pickup_dropoff
 * notes, and the page_sections mirror. Matching profile/metadata unchanged
 * (same POI set).
 *
 * Per-locale authored copy lives in scripts/jeju-east-reorder-content/<loc>.json.
 * Run: node scripts/jeju-east-reorder-2026-08.mjs [locale]
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
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// New times (shared across locales). Haenyeo/Seongsan keep the old slots —
// the 15:00 sea show below Seongsan anchors the afternoon either way.
const TIMES = {
  pickup: "09:00",
  manjang: "≈ 09:50",
  seongeup: "≈ 11:15",
  lunch: "≈ 12:40",
  seongsan: "≈ 13:50",
  haenyeo: "≈ 15:10",
  hamdeok: "≈ 16:35",
  dropoff: "≈ 18:00",
};

const CONTENT_DIR = path.join(__dirname, "jeju-east-reorder-content");
const CONTENT = {};
for (const loc of LOCALES) {
  CONTENT[loc] = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${loc}.json`), "utf8"));
}

function applyReplaces(text, pairs, ctx) {
  let out = text;
  for (const [from, to] of pairs || []) {
    if (!out.includes(from)) {
      throw new Error(`[${ctx}] search text not found: ${from.slice(0, 80)}…`);
    }
    out = out.split(from).join(to);
  }
  return out;
}

function transform(loc) {
  const file = path.join(DIR, `${SLUG}.${loc}.json`);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const c = CONTENT[loc];

  const stops = doc.itineraryStops;
  if (stops.length !== 8) throw new Error(`[${loc}] expected 8 stops, got ${stops.length}`);
  const [sPickup, sHamdeok, sSeongeup, sLunch, sSeongsan, sHaenyeo, sManjang, sDropoff] = stops;

  // --- reorder + re-time + re-number -------------------------------------
  const order = [
    [sPickup, "pickup"],
    [sManjang, "manjang"],
    [sSeongeup, "seongeup"],
    [sLunch, "lunch"],
    [sSeongsan, "seongsan"],
    [sHaenyeo, "haenyeo"],
    [sHamdeok, "hamdeok"],
    [sDropoff, "dropoff"],
  ];
  order.forEach(([stop, key], i) => {
    stop.number = i + 1;
    stop.time = TIMES[key];
    const cc = c[key];
    if (cc) {
      if (cc.whyOnRoute) stop.whyOnRoute = cc.whyOnRoute;
      if (cc.description) stop.description = cc.description;
      if (cc.descReplace && cc.descReplace.length) {
        stop.description = applyReplaces(stop.description, cc.descReplace, `${loc}:${key}`);
      }
    }
  });
  doc.itineraryStops = order.map(([stop]) => stop);

  // --- top-level gallery = concat in new itinerary order, re-id ----------
  const gallerySources = [sManjang, sSeongeup, sSeongsan, sHaenyeo, sHamdeok]
    .map((s) => s.galleryItems || []);
  let gid = 1;
  doc.galleryItems = gallerySources.flat().map((g) => ({ ...g, id: gid++ }));

  // --- routeFlowStops: pure reorder (origin, manjang, seongeup, lunch,
  //     seongsan, haenyeo, hamdeok, return) -------------------------------
  const f = doc.routeFlowStops;
  if (f.length !== 8) throw new Error(`[${loc}] expected 8 routeFlowStops, got ${f.length}`);
  doc.routeFlowStops = [f[0], f[6], f[2], f[3], f[4], f[5], f[1], f[7]];

  // --- routePhases / routeShapeIntro -------------------------------------
  doc.routePhases = c.routePhases;
  if (doc.routeShapeIntro && c.routeShapeSubtitle) {
    doc.routeShapeIntro.subtitle = c.routeShapeSubtitle;
  }

  // --- SEO / catalog_card -------------------------------------------------
  if (doc.seo) {
    if (c.seo.metaDescription) doc.seo.metaDescription = c.seo.metaDescription;
    if (c.seo.description) doc.seo.description = c.seo.description;
  }
  if (doc.catalog_card) {
    doc.catalog_card.subtitle = c.catalog.subtitle;
    doc.catalog_card.shortCardDescription = c.catalog.shortCardDescription;
  }

  // --- whyTourWorks: insert the order-logic item after the UNESCO item ---
  const sec = doc.whyTourWorks && doc.whyTourWorks.routeLogicSections?.[0];
  if (sec && Array.isArray(sec.items) && c.whyNewItem) {
    sec.items = sec.items.filter((it) => it.label !== c.whyNewItem.label);
    sec.items.splice(1, 0, { label: c.whyNewItem.label, detail: c.whyNewItem.detail });
  }

  // --- walking accordion: reorder the per-stop lines to the new course ---
  const walking = (doc.practicalAccordionItems || []).find((p) => p.id === "walking");
  if (walking && Array.isArray(walking.content)) {
    if (walking.content.length !== 8) {
      throw new Error(`[${loc}] walking accordion expected 8 lines, got ${walking.content.length}`);
    }
    const w = walking.content;
    walking.content = [w[0], w[5], w[2], w[3], w[4], w[1], w[6], w[7]];
  }

  // --- pickup_dropoff notes ----------------------------------------------
  if (doc.pickup_dropoff && Array.isArray(c.pdNotes)) {
    doc.pickup_dropoff.notes = c.pdNotes;
  }

  // --- publication log ----------------------------------------------------
  if (doc._publication) {
    doc._publication.last_modified = "2026-08-04";
    doc._publication.fix_passes = doc._publication.fix_passes || {};
    doc._publication.fix_passes.v19_reorder_2026_08_04 =
      "Course reorder (owner instruction): Manjanggul → Seongeup → Lunch → Seongsan → Haenyeo performance → Hamdeok. " +
      "Same stop set — cave-first at 09:00 opening (before tour-bus crowds), Hamdeok Beach becomes the golden-hour finale " +
      "closest to Jeju City. Times shifted (Manjanggul ≈09:50, Seongeup ≈11:15, lunch ≈12:40, Seongsan/haenyeo unchanged, " +
      "Hamdeok ≈16:35, drop-off ≈18:00–18:30). routePhases/routeShapeIntro/whyTourWorks/SEO/catalog updated across 6 locales. " +
      "matching_profile/metadata unchanged (identical POI set).";
  }

  // --- resync the (non-rendered) page_sections mirror ---------------------
  if (Array.isArray(doc.page_sections)) {
    for (const s of doc.page_sections) {
      if (!s || !s.props) continue;
      const p = s.props;
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
  transform(loc);
}
console.log("done");
