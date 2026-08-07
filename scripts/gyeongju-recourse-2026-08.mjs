#!/usr/bin/env node
/**
 * One-off transform: re-course the Busan → Gyeongju day tour (2026-08).
 *
 * Old course: Ahopsan → Bulguksa → lunch → National Museum → Gyochon → Woljeonggyo
 * New course (owner instruction 2026-08-04):
 *   Ahopsan → Bulguksa → lunch
 *   → Gyochon Hanok Village + Choi Family House + Woljeonggyo   (one drop-off, walked)
 *   → Daereungwon + Hwangnidan-gil                              (one drop-off, walked)
 *   → Gyeongju National Museum, or Donggung & Wolji in winter    (seasonal last stop)
 *
 * Why the merges: Gyochon's southern edge IS Woljeonggyo's north bank (10–15 min
 * along the Namcheon), and Daereungwon's west wall IS Hwangnidan-gil. Four places,
 * two stops — the boarding time saved becomes walking time (75 min per block).
 *
 * Why the museum moved last: arriving ~17:00 still clears its 17:30 last-admission
 * by 30 minutes, AND in Nov–Feb that same hour is when sunset (17:15–17:30) turns
 * Donggung & Wolji into the best night view in Gyeongju — a shot the summer
 * timetable cannot produce.
 *
 * Three factual defects in the shipped copy are fixed in the same pass:
 *   1. The museum was marked "closed Mondays" — it is not. Regular closures are
 *      Jan 1 / Seollal / Chuseok only (verified gyeongju.museum.go.kr, 2026-08-04).
 *   2. The pickup stop's prose said 08:25 / 08:40 while the accordion and
 *      pickup_dropoff said 08:30 / 09:10. The latter pair is authoritative.
 *   3. "Busan subway Line 1 serves all three" — Haeundae is Line 2.
 * And per owner instruction every pickup/drop-off point is now explicitly a
 * SUBWAY exit: Busan Station Exit 4 is the subway exit, NOT the KTX rail terminal.
 *
 * Per-locale authored copy lives in scripts/gyeongju-recourse-content/<loc>.json.
 * Run: node scripts/gyeongju-recourse-2026-08.mjs [locale]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLUG = "from-busan-gyeongju-ancient-capital-day-tour";
const DIR = path.resolve(__dirname, `../components/product-tour-static/${SLUG}`);
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

/**
 * New times (shared across locales). Museum ≈17:00 clears its 17:30 last admission.
 *
 * Ahopsan also moves 09:50 → 09:40 and its dwell drops 75 → 60 min: the shipped
 * timetable left only 25 minutes for Ahopsan (Gijang) → Bulguksa, a ~45 km leg
 * that really takes ~50. With the museum now last and gated by a hard closing
 * time, optimism at the front of the day is a missed admission at the end of it.
 * Haeundae 09:10 → Ahopsan 09:40 is the real 30-minute leg.
 */
const TIMES = {
  pickup: "08:10",
  ahopsan: "≈ 09:40",
  bulguksa: "≈ 11:30",
  lunch: "≈ 13:00",
  gyochon: "≈ 14:10",
  daereungwon: "≈ 15:35",
  museum: "≈ 17:00",
  dropoff: "≈ 18:05",
};

const CONTENT_DIR = path.join(__dirname, "gyeongju-recourse-content");
/** Loaded per locale so a single-locale run works before the others are authored. */
function loadContent(loc) {
  const f = path.join(CONTENT_DIR, `${loc}.json`);
  if (!existsSync(f)) throw new Error(`missing locale content: ${f}`);
  return JSON.parse(readFileSync(f, "utf8"));
}

/** Photos that belong with Hwangnidan-gil, not with Gyochon (Hwangnam bread is
 *  from Hwangnam-dong — the very neighbourhood Hwangnidan-gil runs through). */
const HWANGNAM_BREAD_RE = /hwangnam-bread/;
const DAEREUNGWON_PHOTOS = [
  "/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-30.webp",
  "/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-33.webp",
  "/images/tours/daereungwon/daereungwon-cheonmachong-interior.webp",
];

function galleryItem(src, location, alt, caption, id) {
  return { id, type: "photo", src, location, alt, caption };
}

function transform(loc) {
  const file = path.join(DIR, `${SLUG}.${loc}.json`);
  let doc = JSON.parse(readFileSync(file, "utf8"));
  const c = loadContent(loc);

  const stops = doc.itineraryStops;
  if (stops.length !== 8) throw new Error(`[${loc}] expected 8 stops, got ${stops.length}`);
  const [sPickup, sAhopsan, sBulguksa, sLunch, sMuseum, sGyochon, sWoljeong, sDropoff] = stops;

  // Guard: the transform assumes a known starting course. If a previous run or an
  // unrelated edit already moved things, fail loudly instead of scrambling.
  const meta = (s) => (s._poi_meta || {}).poi_key;
  const expected = [
    [sMuseum, "gyeongju_national_museum"],
    [sGyochon, "gyochon_hanok_village"],
    [sWoljeong, "woljeonggyo_bridge"],
    [sBulguksa, "bulguksa_temple"],
    [sAhopsan, "ahopsan_bamboo_forest"],
  ];
  for (const [stop, key] of expected) {
    if (meta(stop) !== key) {
      throw new Error(`[${loc}] unexpected source course: stop ${stop.number} is ${meta(stop)}, expected ${key}`);
    }
  }

  // ── 1. pickup — subway-exit clarity + time correction ────────────────────
  sPickup.name = c.pickup.name;
  sPickup.category = c.pickup.category;
  sPickup.description = c.pickup.description;
  sPickup.highlights = c.pickup.highlights;
  sPickup.timeUsed = c.pickup.timeUsed;
  sPickup.whyOnRoute = c.pickup.whyOnRoute;

  // ── 2. Gyochon + Choi House + Woljeonggyo = one walked block ─────────────
  const gyochonGallery = [...(sGyochon.galleryItems || []), ...(sWoljeong.galleryItems || [])];
  const breadPhotos = gyochonGallery.filter((g) => HWANGNAM_BREAD_RE.test(g.src || ""));
  const gyochonKept = gyochonGallery.filter((g) => !HWANGNAM_BREAD_RE.test(g.src || ""));
  if (breadPhotos.length === 0) {
    throw new Error(`[${loc}] expected Hwangnam-bread photos in the Gyochon gallery to move to Hwangnidan-gil`);
  }

  const gyochonStop = {
    ...sGyochon,
    name: c.gyochon.name,
    category: c.gyochon.category,
    duration: c.gyochon.duration,
    description: c.gyochon.description,
    highlights: c.gyochon.highlights,
    timeUsed: c.gyochon.timeUsed,
    whyOnRoute: c.gyochon.whyOnRoute,
    galleryItems: gyochonKept,
    // visitBasics/smartNotes ARE rendered (TourStopDetailDrawer) — a merged stop
    // whose basics still describe only one of its two places is a lie on screen.
    visitBasics: { ...(sGyochon.visitBasics || {}), ...(c.gyochonBasics?.visitBasics || {}) },
    smartNotes: { ...(sGyochon.smartNotes || {}), ...(c.gyochonBasics?.smartNotes || {}) },
    _poi_meta: {
      ...(sGyochon._poi_meta || {}),
      poi_key: "gyochon_hanok_village",
      is_compound_stop: true,
      secondary_poi_keys: ["woljeonggyo_bridge"],
      compound_stop_note:
        "Gyochon Hanok Village (incl. the Choi Family House, Important Folklore Material No. 27) and Woljeonggyo Bridge sit on opposite banks of the Namcheon, 10–15 min apart on foot, and are visited as ONE 75-min drop-off. Both remain separate POIs in the KB.",
      verified_date: "2026-08-04",
    },
  };

  // ── 3. Daereungwon + Hwangnidan-gil = new walked block ───────────────────
  let gid = 1;
  const daereungwonGallery = [
    ...DAEREUNGWON_PHOTOS.map((src) =>
      galleryItem(src, c.daereungwon.name, `${c.daereungwon.name} — ${gid}`, `${c.daereungwon.name} — ${gid++}`, 0),
    ),
    // The Hwangnam-bread photos come from the Gyochon stop and still carry its
    // label. The page-level atmosphere gallery prints `location`, so leaving it
    // would caption Hwangnam-bread as Gyochon — and the bread is eaten at
    // Hwangnidan-gil now, which is the whole reason the photos moved.
    ...breadPhotos.map((g) => ({ ...g, location: c.daereungwon.name })),
  ];
  const daereungwonStop = {
    number: 0,
    time: TIMES.daereungwon,
    duration: c.daereungwon.duration,
    name: c.daereungwon.name,
    category: c.daereungwon.category,
    description: c.daereungwon.description,
    highlights: c.daereungwon.highlights,
    timeUsed: c.daereungwon.timeUsed,
    whyOnRoute: c.daereungwon.whyOnRoute,
    // This stop is built from scratch rather than spread from an existing one,
    // so nothing seeds the card imagery the way `...sGyochon` does for its
    // neighbours. Without these three fields the stop card renders with no
    // thumbnail while stops 5 and 7 have one — visible on the real page even
    // though the stop already owns five gallery photos.
    image: DAEREUNGWON_PHOTOS[0],
    images: [...DAEREUNGWON_PHOTOS],
    imageCredits: DAEREUNGWON_PHOTOS.map((url) => ({ url, source: "atoc-korea" })),
    galleryItems: daereungwonGallery,
    visitBasics: c.daereungwonBasics.visitBasics,
    convenience: c.daereungwonBasics.convenience,
    smartNotes: c.daereungwonBasics.smartNotes,
    _poi_meta: {
      poi_key: "daereungwon_tomb_complex",
      kb_version: "1.29",
      verified_date: "2026-08-04",
      is_compound_stop: true,
      secondary_poi_keys: ["hwangnidan_gil"],
      compound_stop_note:
        "Daereungwon (23 Silla royal tombs incl. Cheonmachong, 11,526 artifacts) and Hwangnidan-gil (the hanok cafe street literally named 'Hwangnam-dong's Gyeongnidan-gil') are separated only by Daereungwon's west wall and are visited as ONE 75-min drop-off. hwangnidan_gil is not yet a POI KB entry — facts here verified 2026-08-04 (namu.wiki, VisitKorea, Gyeongju city map).",
      sources: [
        "POI KB v1.29 (daereungwon_tomb_complex)",
        "VisitKorea (Hwangnidan-gil)",
        "Gyeongju city tourism map",
        "Wikipedia (Cheonmachong / Hwangnamdaechong)",
      ],
    },
    _role: sGyochon._role,
  };

  // ── 4. Museum, moved last + seasonal Donggung & Wolji alternate ──────────
  const museumStop = {
    ...sMuseum,
    name: c.museum.name,
    category: c.museum.category,
    duration: c.museum.duration,
    description: c.museum.description,
    highlights: c.museum.highlights,
    timeUsed: c.museum.timeUsed,
    whyOnRoute: c.museum.whyOnRoute,
    // The shipped visitBasics said "Tue–Sun" / "closed Mondays". Both are wrong
    // and both are rendered — fixing the prose alone would have left the drawer
    // telling guests to avoid a Monday that the museum is in fact open.
    visitBasics: { ...(sMuseum.visitBasics || {}), ...c.museumBasics.visitBasics },
    _poi_meta: {
      ...(sMuseum._poi_meta || {}),
      poi_key: "gyeongju_national_museum",
      seasonal_alternate_poi_key: "donggung_wolji_pond",
      seasonal_alternate_months: "11,12,1,2",
      seasonal_alternate_note:
        "Nov–Feb the last stop becomes Donggung & Wolji (Historic Site No. 18, 09:00–22:00, adult ₩3,000) because sunset falls at 17:15–17:30. Museum hours corrected 2026-08-04: 10:00–18:00, last admission 17:30, closed only Jan 1 / Seollal / Chuseok — NOT Mondays.",
      verified_date: "2026-08-04",
    },
  };

  // ── 5. assemble, re-number, re-time ─────────────────────────────────────
  const ordered = [
    [sPickup, "pickup"],
    [sAhopsan, "ahopsan"],
    [sBulguksa, "bulguksa"],
    [sLunch, "lunch"],
    [gyochonStop, "gyochon"],
    [daereungwonStop, "daereungwon"],
    [museumStop, "museum"],
    [sDropoff, "dropoff"],
  ];
  ordered.forEach(([stop, key], i) => {
    stop.number = i + 1;
    stop.time = TIMES[key];
  });
  if (!c.ahopsanDuration) throw new Error(`[${loc}] ahopsanDuration missing (locale-formatted, e.g. "60분")`);
  sAhopsan.duration = c.ahopsanDuration;
  sDropoff.description = c.dropoff.description;
  sDropoff.highlights = c.dropoff.highlights;
  sDropoff.timeUsed = c.dropoff.timeUsed;
  sDropoff.whyOnRoute = c.dropoff.whyOnRoute;

  doc.itineraryStops = ordered.map(([stop]) => stop);

  // ── 6. top-level gallery = concat in new order, re-id ────────────────────
  gid = 1;
  doc.galleryItems = doc.itineraryStops
    .flatMap((s) => s.galleryItems || [])
    .map((g) => ({ ...g, id: gid++ }));

  // ── 7. route flow / phases / shape ──────────────────────────────────────
  doc.routeFlowStops = c.routeFlowStops;
  doc.routePhases = c.routePhases;
  if (doc.routeShapeIntro && c.routeShapeSubtitle) doc.routeShapeIntro.subtitle = c.routeShapeSubtitle;

  // ── 8. SEO / catalog card ───────────────────────────────────────────────
  if (doc.seo) {
    if (c.seo.metaDescription) doc.seo.metaDescription = c.seo.metaDescription;
    if (c.seo.description) doc.seo.description = c.seo.description;
  }
  if (doc.catalog_card) {
    doc.catalog_card.subtitle = c.catalog.subtitle;
    doc.catalog_card.shortCardDescription = c.catalog.shortCardDescription;
  }

  // ── 8b. shelf copy — the day grew ~1h (ends ≈19:50, was ≈18:50), so the hero
  //     and card must stop selling "10.5 hours" and "earlier return". Missing
  //     keys throw: a silently surviving claim is a false promise on the card.
  for (const k of ["heroTagline", "heroDurationMeta", "cardDuration", "cardBadges", "glanceWalking"]) {
    if (!c[k]) throw new Error(`[${loc}] ${k} missing — the old 10.5h / "earlier return" copy must not survive`);
  }
  if (!doc.hero || !doc.hero.meta) throw new Error(`[${loc}] hero.meta missing`);
  doc.hero.tagline = c.heroTagline;
  doc.hero.meta.duration = c.heroDurationMeta;
  doc.catalog_card.duration = c.cardDuration;
  doc.catalog_card.badges = c.cardBadges;
  const walkGlance = (doc.glanceItems || []).find((g) => g.icon === "footprints");
  if (!walkGlance) throw new Error(`[${loc}] walking glance item missing`);
  walkGlance.value = c.glanceWalking.value;
  walkGlance.level = c.glanceWalking.level;

  // ── 9. whyTourWorks route logic — replaced wholesale (the old items sold a
  //      10h30 "shorter than the UNESCO version" framing that the new 6-block
  //      day no longer honours) ──────────────────────────────────────────────
  const sec = doc.whyTourWorks && doc.whyTourWorks.routeLogicSections?.[0];
  if (!sec || !Array.isArray(sec.items)) throw new Error(`[${loc}] routeLogicSections[0].items missing`);
  sec.items = c.whyItems;

  // ── 10. seasonal variations ─────────────────────────────────────────────
  doc.seasonalVariations = c.seasonal;

  // ── 11. practical accordions ────────────────────────────────────────────
  const acc = (id) => (doc.practicalAccordionItems || []).find((p) => p.id === id);
  const setAcc = (id, lines) => {
    const item = acc(id);
    if (!item) throw new Error(`[${loc}] accordion "${id}" missing`);
    item.content = lines;
  };
  setAcc("pickup", c.pickupAccordion);
  setAcc("walking", c.walking);
  setAcc("inclusions", c.inclusions);
  setAcc("seasonal", c.seasonalAccordion);

  // `preview` is the collapsed-state teaser derived from content[0]. The script
  // rewrites `content` but nothing regenerated `preview`, so the pickup teaser
  // still read "along Busan subway Line 1, three points…" — the very Line-1
  // error this pass fixes, left showing on the closed accordion. Regenerate it
  // from the new first line, preserving each locale's own truncation length.
  for (const item of doc.practicalAccordionItems || []) {
    if (typeof item.preview !== "string" || !Array.isArray(item.content) || !item.content.length) continue;
    const first = String(item.content[0]);
    if (item.preview.endsWith("…")) {
      const keep = [...item.preview].length - 1;
      const chars = [...first];
      item.preview = chars.length > keep ? chars.slice(0, keep).join("") + "…" : first;
    } else {
      item.preview = first;
    }
  }

  // ── 12. pickup_dropoff — subway-explicit names, 3 points both ways ───────
  const pd = doc.pickup_dropoff;
  if (!pd || !Array.isArray(pd.departure)) throw new Error(`[${loc}] pickup_dropoff.departure missing`);
  const names = c.pickupPoints;
  if (!names || names.length !== 3) throw new Error(`[${loc}] pickupPoints must list exactly 3 names`);
  const times = ["08:10", "08:30", "09:10"];
  if (pd.departure.length !== 3) throw new Error(`[${loc}] expected 3 departure points, got ${pd.departure.length}`);
  pd.departure.forEach((p, i) => {
    p.name = names[i];
    p.time = times[i];
    p.order = i + 1;
  });
  // Drop-off mirrors the pickup set exactly, reverse order (Haeundae → Seomyeon
  // → Busan Station). The old Nampo-dong / Jagalchi extra point is removed:
  // owner named three points, and an unstaffed fourth stop is a promise the
  // timetable does not keep.
  const byName = pd.departure.map((p) => ({ ...p }));
  pd.return = [byName[2], byName[1], byName[0]].map((p, i) => {
    const { time, ...rest } = p;
    return { ...rest, order: i + 1 };
  });
  pd.notes = c.pdNotes;

  // ── 13. FAQ — patch the two answers the new course invalidates, append new
  // Prefer matching by the FAQ's stable `id` (locale-independent); fall back to
  // a question substring for entries authored before ids were used.
  for (const rep of c.faqReplace || []) {
    const q = (doc.staticQuestions || []).find((x) =>
      rep.id ? x.id === rep.id : (x.question || "").includes(rep.match),
    );
    if (!q) throw new Error(`[${loc}] FAQ to replace not found: ${rep.id || rep.match}`);
    q.question = rep.question;
    q.answer = rep.answer;
  }
  // Appended questions need a stable `id`: TourFaqSection uses it as the React
  // key AND as the accordion's expanded-item identity, so three entries with
  // id === undefined would collide and open together on one tap. Ids are
  // assigned positionally here so every locale gets the same ones.
  (c.faqAdd || []).forEach((add, i) => {
    const entry = { id: `q-recourse-${i + 1}`, ...add };
    const dup = (doc.staticQuestions || []).findIndex((x) => x.question === entry.question || x.id === entry.id);
    if (dup >= 0) doc.staticQuestions[dup] = { ...doc.staticQuestions[dup], ...entry };
    else doc.staticQuestions.push(entry);
  });
  const ids = (doc.staticQuestions || []).map((x) => x.id);
  if (ids.some((x) => !x) || new Set(ids).size !== ids.length) {
    throw new Error(`[${loc}] staticQuestions ids must all be present and unique — got ${JSON.stringify(ids)}`);
  }

  // ── 13b. fields the re-course silently invalidated ──────────────────────
  //   · the lunch stop's whyOnRoute described the afternoon as "museum + hanok
  //     village" — the museum is last now, and the afternoon is two walked blocks
  //   · bestFor still sold "prefers an earlier evening return" (false: ≈19:50)
  //   · lessIdealFor pointed at the retired UNESCO-legacy sister tour
  for (const k of ["lunchWhyOnRoute", "bestFor", "lessIdealFor"]) {
    if (!c[k]) throw new Error(`[${loc}] ${k} missing — the re-course invalidated this field`);
  }
  sLunch.whyOnRoute = c.lunchWhyOnRoute;
  doc.whyTourWorks.bestFor = c.bestFor;
  doc.whyTourWorks.lessIdealFor = c.lessIdealFor;

  // ── 13c. the last of the retired-sister-tour copy. Bulguksa's whyOnRoute and
  //     the lunch stop both sold "15 minutes longer than the UNESCO Legacy
  //     sister tour" — a product withdrawn 2026-06-29. The lunch copy also
  //     quoted ₩12,000–18,000 while `inclusions` and the admissions FAQ say
  //     ₩15,000–25,000; one page, two prices.
  for (const k of ["bulguksaWhyOnRoute", "lunchDescription", "lunchHighlights"]) {
    if (!c[k]) throw new Error(`[${loc}] ${k} missing — retired-sister-tour copy / stale lunch price`);
  }
  sBulguksa.whyOnRoute = c.bulguksaWhyOnRoute;
  sLunch.description = c.lunchDescription;
  sLunch.highlights = c.lunchHighlights;
  // en is the only locale whose bookingTrustItems copy carries a duration claim.
  if (c.bookingTrustBody) {
    const trust = (doc.bookingTrustItems || [])[c.bookingTrustBody.index ?? 0];
    if (!trust) throw new Error(`[${loc}] bookingTrustItems entry not found`);
    for (const field of ["body", "description"]) {
      if (field in trust && c.bookingTrustBody[field]) trust[field] = c.bookingTrustBody[field];
    }
  }

  // ── 14. matching profile — new POIs + the traits the course now has ──────
  const mp = doc.matching_profile;
  if (mp) {
    mp.poi_tags = [
      "ahopsan_bamboo_forest",
      "bulguksa_temple",
      "gyochon_hanok_village",
      "woljeonggyo_bridge",
      "daereungwon_tomb_complex",
      "hwangnidan_gil",
      "gyeongju_national_museum",
      "donggung_wolji_pond",
    ];
    mp.anchor_poi_keys = [
      "bulguksa_temple",
      "daereungwon_tomb_complex",
      "gyochon_hanok_village",
      "gyeongju_national_museum",
      "woljeonggyo_bridge",
      "ahopsan_bamboo_forest",
    ];
    // The day now contains a cafe street, a night-view winter variant, more
    // walking and a later finish — say so, rather than leaving the old values
    // to lie to the matcher. NOTE: every *_fit here is a 0–1 score, not a 1–5
    // level (the glanceItems use 1–5; these do not).
    mp.duration_hours = 11.5;
    mp.duration_band = "11h";
    mp.return_time_band = "19:15-19:50";
    mp.cafe_fit = 0.75; // Hwangnidan-gil is now a scheduled stop, not scenery
    mp.shopping_fit = 0.45; // hanok boutiques + Hwangnam bread as the souvenir
    mp.nightlife_fit = 0.3; // a lit pond in winter is not nightlife — nudge only
    mp.instagrammable_fit = 0.9;
    mp.late_finish_fit = 0.75; // last drop ≈19:50, was ≈18:50
    mp.walking_level = 0.7; // ~5–5.5 km, up from ~3.5–4 km
  }

  // ── 14b. drop the dead differentiator. `matching_metadata` has no renderer
  //     (only `matching_metadata.catalog_card.title` is read, by explainer-haiku)
  //     and this key describes the UNESCO-legacy sister tour withdrawn
  //     2026-06-29 — plus its numbers ("15-min longer dwell", "lunch 60 vs 45")
  //     no longer describe this course either. Stale metadata about a product
  //     that is not sold is worse than no metadata.
  if (doc.matching_metadata) {
    delete doc.matching_metadata.differentiation_vs_unesco_legacy_sister;
  }

  // ── 15. publication log ─────────────────────────────────────────────────
  if (doc._publication) {
    doc._publication.last_modified = "2026-08-04";
    doc._publication.fix_passes = doc._publication.fix_passes || {};
    doc._publication.fix_passes.v20_recourse_2026_08_04 =
      "Course revision (owner instruction): Ahopsan → Bulguksa → lunch → [Gyochon + Choi Family House + Woljeonggyo] → " +
      "[Daereungwon + Hwangnidan-gil] → [Gyeongju National Museum, or Donggung & Wolji in Nov–Feb]. Two new compound " +
      "stops replace four separate ones (both walkable blocks); the museum moves from 4th to last (arrives ≈17:00, " +
      "clearing its 17:30 last admission) and gains a winter night-view alternate. Pickup/drop-off restated as three " +
      "SUBWAY exits (Busan Stn Exit 4 = subway, NOT the KTX rail terminal; Seomyeon Exit 4; Haeundae Exit 5) and the " +
      "unlisted Nampo-dong drop-off removed. Fixed three shipped factual errors: museum 'closed Mondays' (it is not — " +
      "Jan 1 / Seollal / Chuseok only), pickup prose times 08:25/08:40 vs authoritative 08:30/09:10, and 'Line 1 serves " +
      "all three' (Haeundae is Line 2). Day now ends ≈19:50 in Busan (was ≈18:50). 6 locales; photos for Hwangnidan-gil " +
      "and Donggung & Wolji still pending (owner: to be supplied locally).";
  }

  // ── 16. resync the (non-rendered) page_sections mirror ───────────────────
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

  // ── 16b. terminology unification. Some locales shipped a non-official name
  //     for a POI (e.g. zh 庆州国立博物馆 vs the official 国立庆州博物馆). New copy
  //     uses the official form, so untouched legacy fields would leave two
  //     names for one place on the same page. Locales that need it declare the
  //     pairs; applied document-wide AFTER the mirror resync so both agree.
  if (Array.isArray(c.terminologyFixes) && c.terminologyFixes.length) {
    let blob = JSON.stringify(doc);
    for (const [from, to] of c.terminologyFixes) {
      if (!from || !to) throw new Error(`[${loc}] terminologyFixes entry must be [from, to]`);
      blob = blob.split(from).join(to);
    }
    doc = JSON.parse(blob);
  }

  // ── 17. safety net: no stale duration claim may survive anywhere, including
  //     the page_sections mirror and FAQ answers. "10.5"/"10,5" was the old
  //     day length and it is now wrong on every surface that still says it.
  // `_publication` is the change log — it is SUPPOSED to say what the old
  // numbers were, and it never renders. Everything else is guest-facing.
  const { _publication, ...guestFacing } = doc;
  const serialized = JSON.stringify(guestFacing);
  for (const stale of ["10.5", "10,5", "18:50"]) {
    if (serialized.includes(stale)) {
      const idx = serialized.indexOf(stale);
      throw new Error(
        `[${loc}] stale day-length claim "${stale}" survived — the day now ends ≈19:50. Context: …${serialized.slice(Math.max(0, idx - 120), idx + 80)}…`,
      );
    }
  }

  // ── 18. safety net: presentation markup that the renderer does not read.
  //     Found by eyeballing the real page — tsc and every test were green.
  //     `**bold**` is turned into emphasis by exactly one component,
  //     `_shared/TourStopDetailDrawer.tsx`, and it only ever sees itineraryStops
  //     fields. Anywhere else the guest reads the asterisks. Control: the other
  //     product bundles use `**` too, but only in those fields, so they render
  //     zero literal asterisks; this one had put it in nine more fields.
  //     🔴 is this repo's internal "important" marker — no other bundle carries
  //     one, and it has no business on a guest's screen.
  assertNoUnrenderedMarkup(guestFacing, loc);

  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc} — 8 stops, ${doc.galleryItems.length} gallery items`);
}

/**
 * Fields whose strings reach `TourStopDetailDrawer`, the only renderer in the
 * product page that converts `**x**` into emphasis. `**` is safe here and
 * printed literally everywhere else.
 */
const MARKDOWN_RENDERED_FIELDS = new Set([
  "highlights",
  "description",
  "whyOnRoute",
  "tip", // itineraryStops[].smartNotes.tip — same drawer
]);

function assertNoUnrenderedMarkup(node, loc) {
  const bad = [];
  const walk = (value, keyPath, lastKey) => {
    if (typeof value === "string") {
      if (/[🔴🟠🟡🟢⚠✅❌]/u.test(value)) {
        bad.push(`${keyPath}: internal status emoji in guest copy — ${value.slice(0, 60)}`);
      }
      if (/\*\*[^*]+\*\*/.test(value) && !MARKDOWN_RENDERED_FIELDS.has(lastKey)) {
        bad.push(`${keyPath}: **bold** in a field that renders raw — ${value.slice(0, 60)}`);
      }
      return;
    }
    if (Array.isArray(value)) {
      // An array inherits its parent key: `highlights[]` is still `highlights`.
      value.forEach((v, i) => walk(v, `${keyPath}[${i}]`, lastKey));
      return;
    }
    if (value && typeof value === "object") {
      for (const k of Object.keys(value)) {
        walk(value[k], keyPath ? `${keyPath}.${k}` : k, k);
      }
    }
  };
  walk(node, "", "");
  if (bad.length) {
    throw new Error(
      `[${loc}] ${bad.length} unrendered-markup leak(s) — the guest would see these characters:\n` +
        bad.slice(0, 8).map((b) => `    ${b}`).join("\n") +
        (bad.length > 8 ? `\n    … and ${bad.length - 8} more` : ""),
    );
  }
}

const only = process.argv[2];
for (const loc of LOCALES) {
  if (only && only !== loc) continue;
  transform(loc);
}
console.log("done");
