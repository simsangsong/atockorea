#!/usr/bin/env node
/**
 * Second pass on the three Busan cruise shore-excursion SKUs: the course itself.
 * (owner instruction 2026-08-04 — "match the existing products to the listing 100%")
 *
 * The first pass (`align-busan-cruise-2026-08.mjs`) did price / duration / pickup /
 * capacity. This one does what it explicitly deferred:
 *
 *   S1  Both join tiers run the listing's 9 stops, in order, as discrete stops:
 *         Haedong Yonggungsa -> UN Memorial -> lunch (own expense) -> Jagalchi ->
 *         BIFF Square -> Gukje Market -> Gamcheon -> Songdo Cloud Trails ->
 *         Songdo Sky Park (cable car chosen on site) -> Yongdusan Park
 *       - the bus tour had Songdo as ONE stop; the listing splits it in two
 *       - the small-group SKU had Jagalchi+BIFF+Gukje merged into one stop and
 *         made Songdo/Yongdusan conditional ("if time allows"). Both are gone.
 *   S2  Inclusions / exclusions rewritten to the listing's bullets.
 *   S3  Surcharge / cancellation / age / cruise-only policy accordion.
 *
 * And the contradictions the re-time exposed:
 *
 *   - The bus tour claimed "8 hours" on the card while its own timeline ran
 *     08:30 -> 19:15, i.e. nearly 11. The whole day is re-timed onto a real
 *     8-hour spine (09:00 pickup -> 17:00 drop-off).
 *   - Its pickup stop asserted a single terminal ("Busan Port International
 *     Cruise Terminal ... Yeongdo-side"), which the first pass had already
 *     de-ranked everywhere else. Rewritten to the two co-equal terminals.
 *   - Its pickup text said "returning to terminal by 17:30" while the return
 *     stop said 19:30. Both replaced.
 *   - 5 stop `description` fields on the bus tour were still English in ko / ja /
 *     zh / zh-TW / es. This pass replaces the ones it touches (pickup, return,
 *     Songdo->2 new stops) and supplies native BIFF / Gukje text for the
 *     non-English locales. See --report for what is left.
 *
 * Idempotent: re-running produces no further diff. `--dry-run` writes nothing.
 * `--report` prints the leftover-defect scan without writing.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DRY = process.argv.includes("--dry-run");
const REPORT_ONLY = process.argv.includes("--report");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const JOIN_BUS = "busan-cruise-shore-excursion-bus-tour";
const SMALL = "busan-small-group-sightseeing-tour-cruise-passengers";
const PRIVATE = "busan-private-car-charter-cruise-shore";

const bundlePath = (slug, locale) =>
  `components/product-tour-static/${slug}/${slug}.${locale}.json`;

const content = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`scripts/busan-cruise-course-content/${l}.json`, "utf8"))]),
);

/**
 * The 8-hour spine. 09:00 pickup -> 17:00 drop-off, which is what the listing
 * sells. Dwell times are sized to fit it; the previous timeline did not.
 */
const SPINE = [
  { key: "pickup", time: "09:00", kind: "window", mins: 15 },
  { key: "yonggungsa", time: "09:45", mins: 50 },
  { key: "un", time: "11:05", mins: 30 },
  { key: "lunch", time: "11:50", mins: 40 },
  { key: "jagalchi", time: "12:45", mins: 30 },
  { key: "biff", time: "13:15", mins: 20 },
  { key: "gukje", time: "13:35", mins: 25 },
  { key: "gamcheon", time: "14:20", mins: 45 },
  { key: "cloud_trails", time: "15:25", mins: 20 },
  { key: "sky_park", time: "15:45", mins: 25 },
  { key: "yongdusan", time: "16:25", mins: 20 },
  { key: "return", time: "17:00", kind: "drive", mins: 15 },
];

const DUR = {
  en: { plain: (n) => `${n} min`, window: (n) => `${n} min window`, drive: (n) => `${n} min drive` },
  ko: { plain: (n) => `${n}분`, window: (n) => `${n}분 대기 시간`, drive: (n) => `차로 ${n}분` },
  ja: { plain: (n) => `${n}分`, window: (n) => `${n}分の受付時間`, drive: (n) => `車で${n}分` },
  zh: { plain: (n) => `${n} 分钟`, window: (n) => `${n} 分钟窗口期`, drive: (n) => `车程${n}分钟` },
  "zh-TW": { plain: (n) => `${n} 分鐘`, window: (n) => `${n} 分鐘時段`, drive: (n) => `車程 ${n} 分鐘` },
  es: { plain: (n) => `${n} min`, window: (n) => `Ventana de ${n} min`, drive: (n) => `${n} min en vehículo` },
};

/**
 * Our own vehicle, described inside stops donated from the coach product to the
 * 12-seat van product. Deliberately narrow: "tour-bus crowds" means OTHER
 * operators' buses and must NOT be rewritten, so `bus` on its own is never
 * touched — only the phrases that name the vehicle the guest is riding in.
 */
const VAN_RULES = {
  en: [
    [/this bus[- ]tour/gi, "this small-group tour"],
    [/\bCoach\b/g, "Van"],
    [/\bcoach\b/g, "van"],
  ],
  ko: [
    [/이 버스 투어/g, "이 소그룹 투어"],
    [/코치 버스 하차/g, "밴 하차"],
    [/대형 버스 접근 가능/g, "밴 접근 가능"],
    [/버스 하차/g, "밴 하차"],
    [/버스 승차/g, "밴 승차"],
  ],
  ja: [
    [/このバスツアー/g, "この少人数ツアー"],
    [/大型バス/g, "バン"],
    [/バス降車/g, "バン降車"],
    [/バスから降車/g, "バンから降車"],
  ],
  zh: [
    [/本巴士行程|这趟巴士行程/g, "本小团行程"],
    [/大型巴士/g, "面包车"],
    [/巴士下车/g, "面包车下车"],
  ],
  "zh-TW": [
    [/本巴士行程|這趟巴士行程/g, "本小團行程"],
    [/大型巴士/g, "廂型車"],
    [/巴士下車/g, "廂型車下車"],
  ],
  es: [
    [/esta excursión en autobús/gi, "esta excursión en grupo reducido"],
    [/\bautocar\b/gi, "furgoneta"],
    [/en autobús/gi, "en vehículo"],
  ],
};

/** Localised titles of the "what's included" accordion on the private charter. */
const INCLUSION_TITLE = {
  en: /includ/i,
  ko: /포함/,
  ja: /含まれる/,
  zh: /费用包含/,
  "zh-TW": /費用包含/,
  es: /inclu/i,
};

const CHANGES = [];
const note = (slug, locale, what) => CHANGES.push(`${slug} [${locale}] ${what}`);

const clone = (v) => JSON.parse(JSON.stringify(v));

function mapStrings(node, fn) {
  if (typeof node === "string") return fn(node);
  if (Array.isArray(node)) return node.map((v) => mapStrings(v, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = mapStrings(v, fn);
    return out;
  }
  return node;
}

const vanify = (stop, locale) =>
  mapStrings(stop, (s) => {
    let next = s;
    for (const [re, to] of VAN_RULES[locale] ?? []) next = next.replace(re, to);
    return next;
  });

/** Build one of the two Songdo stops from the locale content file. */
function songdoStop(which, c, base) {
  const src = c[which];
  const images =
    which === "songdo_cloud_trails"
      ? ["/images/tours/songdo-beach/songdo-skywalk-v-bridge.webp", "/images/tours/songdo-beach/songdo-beach-sign-couple.webp"]
      : ["/images/tours/songdo-beach/chatgpt-image-2026-5-10-12-32-12.webp", "/images/tours/songdo-beach/songdo-beach-sign-couple.webp"];
  const stop = {
    number: 0,
    time: "",
    duration: "",
    name: c.stopNames[which],
    category: src.category,
    description: src.description,
    highlights: clone(src.highlights),
    timeUsed: clone(src.timeUsed),
    whyOnRoute: src.whyOnRoute,
    smartNotes: clone(src.smartNotes),
    convenience: clone(src.convenience),
    visitBasics: clone(src.visitBasics),
    image: images[0],
    images,
  };
  // Cloud Trails is physically on Songdo Beach, so it keeps that POI link.
  // Sky Park is across the bay on the Amnam headland and has no KB entry —
  // like the lunch and pickup stops, it simply carries no _poi_meta.
  if (which === "songdo_cloud_trails" && base?._poi_meta) stop._poi_meta = clone(base._poi_meta);
  return stop;
}

/** Apply the spine's clock + dwell labels and renumber. */
function applySpine(stops, locale) {
  const fmt = DUR[locale];
  stops.forEach((stop, i) => {
    const s = SPINE[i];
    stop.number = i + 1;
    stop.time = `≈ ${s.time}`;
    stop.duration = s.kind === "window" ? fmt.window(s.mins) : s.kind === "drive" ? fmt.drive(s.mins) : fmt.plain(s.mins);
  });
}

function rebuildFlow(stops, prevFlow) {
  const byName = new Map((prevFlow ?? []).map((f) => [f.name, f]));
  return stops.map((stop, i) => {
    const prior = byName.get(stop.name);
    const base = prior ? clone(prior) : {};
    base.name = stop.name;
    base.type = i === 0 ? "origin" : i === stops.length - 1 ? "return" : base.type ?? (stop.category ? "primary" : "primary");
    if (/lunch|점심|昼食|午餐|almuerzo/i.test(stop.name)) base.type = "meal";
    base.theme = base.theme ?? stop.category ?? "";
    return base;
  });
}

/**
 * Only `highlights`, `description`, `whyOnRoute` and `smartNotes.tip` are run
 * through the emphasis renderer (TourStopDetailDrawer); everywhere else `**x**`
 * prints the asterisks literally. The Yongdusan and Jagalchi stops have carried
 * that leak in `visitBasics` and `smartNotes.photo` since they were written, and
 * donating them to the small-group bundle would have copied it into a file that
 * did not have it. Strip instead of propagate.
 * Enforced by `__tests__/audit/bundleUnrenderedMarkup.test.ts`.
 */
const MARKDOWN_KEYS = new Set(["highlights", "description", "whyOnRoute", "tip"]);

function stripUnrenderedBold(doc, slug, locale) {
  let hits = 0;
  const walk = (value, lastKey) => {
    if (typeof value === "string") {
      if (MARKDOWN_KEYS.has(lastKey)) return value;
      const next = value.replace(/\*\*([^*]+)\*\*/g, "$1");
      if (next !== value) hits += 1;
      return next;
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, lastKey));
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = k === "_poi_meta" ? v : walk(v, k);
      return out;
    }
    return value;
  };
  doc.itineraryStops = walk(doc.itineraryStops, "itineraryStops");
  if (hits) note(slug, locale, `${hits} literal-asterisk field(s) cleaned (would have rendered as **text**)`);
}

/**
 * The "why this route works" panel argued for the OLD timings by name. Items are
 * found by the clock/price figures inside them, which are digits in every locale,
 * rather than by index — the two join bundles do not share an index layout.
 */
function applyRouteLogic(doc, slug, locale) {
  const rl = content[locale].routeLogic;
  const sections = doc.whyTourWorks?.routeLogicSections;
  if (!rl || !Array.isArray(sections)) return;

  const PROBES = [
    [(d) => d.includes("19:15") && (d.includes("19:30") || d.includes("21:00")), "returnGuarantee"],
    [(d) => d.includes("08:30") && d.includes("19:30"), "directPickup"],
    [(d) => d.includes("16:00") && d.includes("17:00"), "gamcheonTiming"],
    [(d) => d.includes("18:30"), "yongdusanTiming"],
    [(d) => d.includes("17,000") && d.includes("12,000"), "cableCarTradeoff"],
    // "…or skip Yongdusan to ride the Songdo cable car, will need our private
    // charter" — the cable car is a stop on this tour now, so that clause sold
    // an upgrade the guest no longer needs.
    [(d) => d.includes("30") && d.includes("90") && /cable ?car|케이블카|ケーブルカー|缆车|纜車|teleférico/i.test(d), "fixedWindows"],
  ];

  let hits = 0;
  for (const section of sections) {
    for (const item of section.items ?? []) {
      const detail = String(item.detail ?? "");
      for (const [probe, key] of PROBES) {
        if (!probe(detail) || !rl[key]) continue;
        if (item.detail !== rl[key]) {
          item.detail = rl[key];
          hits += 1;
        }
        // The stops-count heading sits on whichever section holds the two
        // timing items; the bundles title it "Eight stops in one day".
        if ((key === "gamcheonTiming" || key === "yongdusanTiming") && rl.stopsSectionTitle) {
          if (section.title && section.title !== rl.stopsSectionTitle) {
            section.title = rl.stopsSectionTitle;
            hits += 1;
          }
        }
        break;
      }
    }
  }
  if (hits) note(slug, locale, `${hits} route-logic claim(s) rewritten (golden hour / twilight / eight stops / cable car)`);
}

/**
 * Remaining pure-number references to the old timeline. Scoped to containers that
 * describe OUR schedule — never `visitBasics`, `highlights`, `convenience` or
 * `smartNotes`, which hold opening hours. Gukje's are literally "09:30-19:30",
 * and a doc-wide sweep would rewrite them into nonsense.
 */
const CLOCK_MAP = [
  ["08:25", "08:50"],
  ["08:30", "09:00"],
  ["11:15", "11:05"],
  ["12:30", "11:50"],
  ["19:15", "16:45"],
  ["19:30", "17:00"],
];
const CLOCK_CONTAINERS = [
  "whyTourWorks", "practicalAccordionItems", "bookingTrustItems",
  "bookingSupportSteps", "staticQuestions", "seo", "pickup_dropoff",
  // Not rendered, but it is copied into detail_payload and into the recommender's
  // full_document, and it still said "Return-by-19:15 ... 8 signature stops".
  "matching_metadata",
];

/**
 * The course grew from 8 sights to 9. The count is spelled a dozen ways across
 * the six locales — and the two join bundles do not even agree with each other
 * ("8개 정류장" on the coach, "8개 코스" on the van).
 */
const STOP_COUNT_PHRASES = [
  [/\b8 signature stops\b/g, "9 signature stops"],
  [/\b(eight) signature stops\b/gi, "nine signature stops"],
  [/\b8 stops\b/g, "9 stops"],
  [/\bSame eight stops\b/g, "Same nine stops"],
  [/\b8 paradas\b/g, "9 paradas"],
  [/8\s*개\s*(코스|정류장|스팟)/g, "9개 $1"],
  [/여덟\s*(개\s*)?(코스|정류장)/g, "아홉 $1$2"],
  [/8\s*(スポット|か所|箇所|カ所)/g, "9$1"],
  [/8\s*个\s*(景点|站|停靠点)/g, "9个$1"],
  [/8\s*個\s*(景點|站|停靠點)/g, "9個$1"],
];

function applyClockMap(doc, slug, locale) {
  let hits = 0;

  // The cable-car FAQ said the Songdo stop was too short to ride and that guests
  // who wanted to should book the private charter instead. Sky Park is now a stop
  // on this very tour, so that answer had become false — and no clock swap fixes
  // a claim like that.
  const faq = content[locale].cableCarFaq;
  const q = (doc.staticQuestions ?? []).find((x) => String(x.id ?? "") === "cable-car");
  if (faq && q && (q.question !== faq.question || q.answer !== faq.answer)) {
    q.question = faq.question;
    q.answer = faq.answer;
    note(slug, locale, "cable-car FAQ rewritten — it denied the ride the course now includes");
  }
  const swap = (s) => {
    let next = s;
    // Gukje Market's opening hours are literally "09:30-19:30". A blind
    // 19:30 -> 17:00 would close the market two and a half hours early in every
    // locale, and nothing downstream would notice.
    const quotesGukjeHours = /0?9:30\s*[–~-]\s*19:30/.test(next);
    for (const [from, to] of CLOCK_MAP) {
      if (from === "19:30" && quotesGukjeHours) continue;
      next = next.split(from).join(to);
    }
    if (next !== s) hits += 1;
    return next;
  };
  for (const key of CLOCK_CONTAINERS) {
    if (doc[key] == null) continue;
    doc[key] = mapStrings(doc[key], swap);
  }
  for (const stop of doc.itineraryStops ?? []) {
    if (typeof stop.whyOnRoute === "string") stop.whyOnRoute = swap(stop.whyOnRoute);
  }
  if (doc.matching_profile?.return_time_band && doc.matching_profile.return_time_band !== "16:30-17:00") {
    doc.matching_profile.return_time_band = "16:30-17:00";
    hits += 1;
  }
  if (hits) note(slug, locale, `${hits} stale clock reference(s) re-timed to the 8-hour spine`);
}

/**
 * Each product quoted its OWN price inside prose — the cross-sell FAQs and the
 * card blurbs. Those figures predate the listing alignment, so the page could
 * show US$58.79 in the booking box and "$49 per person" three paragraphs down.
 * Scoped per slug to that product's own stale figure; market-range statements
 * about private charters ("$300–$500 per group") are left alone on purpose.
 */
const SELF_PRICE_MAP = {
  // $79 on the coach bundle is always the SMALL-GROUP tier it compares itself to.
  [JOIN_BUS]: [[/\$\s?49\b/g, "$58.79"], [/\$\s?79\b/g, "$68.95"]],
  [SMALL]: [[/\$\s?58\.50\b/g, "$68.95"], [/\$\s?(79|84|85)\b/g, "$68.95"], [/₩58[.,]50\s?(美元|美金)?/g, "US$68.95"]],
  [PRIVATE]: [[/\$\s?364\b/g, "$456.99"], [/\$\s?359\b/g, "$456.99"]],
};

function applyStaleFigures(doc, slug, locale) {
  let hits = 0;
  const swap = (s) => {
    let next = s;
    for (const [re, to] of STOP_COUNT_PHRASES) next = next.replace(re, to);
    for (const [re, to] of SELF_PRICE_MAP[slug] ?? []) next = next.replace(re, to);
    if (next !== s) hits += 1;
    return next;
  };
  for (const [k, v] of Object.entries(doc)) {
    if (k === "page_sections" || k === "_publication") continue;
    doc[k] = mapStrings(v, swap);
  }
  if (hits) note(slug, locale, `${hits} stale figure(s) fixed (old stop count / this product's old price)`);
}

/**
 * R1 — the small-group bundle still talked about Taejongdae everywhere except its
 * stop list: SEO, keywords, card blurb, route logic, the walking and accessibility
 * accordions, five FAQs (one of them titled "Should we take the Danubi Train at
 * Taejongdae?"), the weather note, seasonal notes, and every gallery caption in
 * the five non-English locales. The tour has not gone there since the course was
 * revised, and now that the stops are right the leftovers read as a second,
 * contradictory itinerary.
 *
 * Course-dependent prose is DONATED from the coach bundle — the two join tiers
 * run the identical course, and the coach copy is already clean in all six
 * locales. Only genuinely small-group-specific fields are hand-written.
 *
 * ⚠ The private charter's ~52 Taejongdae mentions are NOT a defect: it really
 * does stop there. Nothing here touches that bundle.
 */
const DONATE_ACCORDION = { walking: "walking" }; // donor id -> small-group id
const DONATE_FAQ = {
  walking: "walking",
  kids: "family",
  seniors: "seniors",
  rain: "weather",
  "cable-car": "q-taejongdae-train", // renamed below — it named a place we skip
};

/** Which POI a gallery image is actually of, from its path. */
function placeKeyForImage(src) {
  const s = String(src || "");
  if (/haedong-yonggungsa/.test(s)) return "haedong_yonggungsa";
  if (/un-memorial-cemetery/.test(s)) return "un_memorial_cemetery";
  if (/jagalchi/.test(s)) return "jagalchi_market";
  if (/gukje/.test(s)) return "gukje_market";
  if (/biff/.test(s)) return "biff_square";
  if (/gamcheon/.test(s)) return "gamcheon_culture_village";
  if (/songdo/.test(s)) return "songdo_beach";
  if (/busan-tower|yongdusan/.test(s)) return "yongdusan_park";
  if (/taejongdae/.test(s)) return "taejongdae";
  return null;
}

/**
 * Captions are DERIVED from the photo, never carried over. The non-English
 * bundles had the UN Memorial photos captioned "Taejongdae coastal cliffs" and
 * the temple photos captioned "UN Memorial Cemetery" — the same one-place shift
 * that hit the stop names, and equally invisible in source.
 */
function rebuildGalleryCaptions(doc, slug, locale) {
  const items = doc.galleryItems;
  if (!Array.isArray(items)) return;
  const nameFor = new Map();
  for (const stop of doc.itineraryStops ?? []) {
    const k = stop._poi_meta?.poi_key;
    if (k && !nameFor.has(k)) nameFor.set(k, stop.name);
  }
  const seen = new Map();
  const kept = [];
  let fixed = 0;
  let dropped = 0;
  for (const item of items) {
    const key = placeKeyForImage(item.src);
    const name = key && nameFor.get(key);
    if (!name) {
      // A photo of somewhere this tour no longer goes has no caption that could
      // be true. Drop it rather than relabel it as a place it does not show.
      dropped += 1;
      continue;
    }
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const next = { ...item, location: name, caption: `${name} — photo ${n}`, alt: `${name} — gallery image ${n}` };
    if (JSON.stringify(next) !== JSON.stringify(item)) fixed += 1;
    kept.push(next);
  }
  if (fixed || dropped) {
    doc.galleryItems = kept;
    note(slug, locale, `gallery: ${fixed} caption(s) re-derived from the photo, ${dropped} off-route photo(s) dropped`);
  }
}

/** Anchors feed the recommender; derive them from the course, not from memory. */
function rebuildMatchingAnchors(doc, slug, locale) {
  const mp = doc.matching_profile;
  if (!mp) return;
  const keys = (doc.itineraryStops ?? [])
    .map((s) => s._poi_meta?.poi_key)
    .filter((k) => k && !String(k).startsWith("OPS_"));
  const unique = [...new Set(keys)];
  let touched = false;
  if (Array.isArray(mp.poi_tags) && JSON.stringify(mp.poi_tags) !== JSON.stringify(unique)) {
    mp.poi_tags = unique;
    touched = true;
  }
  if (Array.isArray(mp.anchor_poi_keys)) {
    const anchors = unique.slice(0, Math.max(mp.anchor_poi_keys.length, 5));
    if (JSON.stringify(mp.anchor_poi_keys) !== JSON.stringify(anchors)) {
      mp.anchor_poi_keys = anchors;
      touched = true;
    }
  }
  if (touched) note(slug, locale, "matching anchors re-derived from the course (they still listed taejongdae)");
}

function alignSmallGroupToCourse(doc, donorDoc, locale) {
  const c = content[locale].smallGroup;
  if (!c) return;
  let donated = 0;

  const byId = (arr, id) => (arr ?? []).find((x) => String(x.id ?? "") === id);
  for (const [donorId, smallId] of Object.entries(DONATE_ACCORDION)) {
    const from = byId(donorDoc.practicalAccordionItems, donorId);
    const to = byId(doc.practicalAccordionItems, smallId);
    if (!from || !to) continue;
    const next = vanify({ ...clone(from), id: to.id, title: to.title }, locale);
    if (JSON.stringify(to) !== JSON.stringify(next)) {
      Object.assign(to, next);
      donated += 1;
    }
  }
  for (const [donorId, smallId] of Object.entries(DONATE_FAQ)) {
    const from = byId(donorDoc.staticQuestions, donorId);
    const to = byId(doc.staticQuestions, smallId);
    if (!from || !to) continue;
    // `q-taejongdae-train` named a stop this tour skips; the cable car replaces it.
    const id = smallId === "q-taejongdae-train" ? "q-cable-car" : to.id;
    const next = vanify({ ...clone(from), id }, locale);
    if (JSON.stringify(to) !== JSON.stringify(next)) {
      Object.assign(to, next);
      if (to.id !== id) to.id = id;
      donated += 1;
    }
  }
  for (const field of ["seasonalVariations", "practicalWeatherStatic"]) {
    if (donorDoc[field] === undefined) continue;
    const next = vanify(clone(donorDoc[field]), locale);
    if (JSON.stringify(doc[field]) !== JSON.stringify(next)) {
      doc[field] = next;
      donated += 1;
    }
  }
  if (donated) note(SMALL, locale, `${donated} course-dependent field(s) donated from the coach bundle`);

  // Small-group-specific copy — hand-written, not donated.
  if (doc.seo) {
    if (doc.seo.metaDescription !== c.seoMetaDescription) {
      doc.seo.metaDescription = c.seoMetaDescription;
      note(SMALL, locale, "seo.metaDescription rewritten (it still led with Taejongdae)");
    }
    if (Array.isArray(doc.seo.primaryKeywords)) {
      const i = doc.seo.primaryKeywords.findIndex((k) => TAEJONGDAE.test(String(k)));
      if (i >= 0) {
        doc.seo.primaryKeywords[i] = c.seoKeyword;
        note(SMALL, locale, "seo keyword targeted a stop we do not visit");
      }
    }
  }
  if (doc.catalog_card && doc.catalog_card.shortCardDescription !== c.cardShortDescription) {
    doc.catalog_card.shortCardDescription = c.cardShortDescription;
    note(SMALL, locale, "card blurb rewritten (Taejongdae, and 'Yongdusan when time allows')");
  }
  const rl = doc.whyTourWorks?.routeLogicSections?.[0]?.items?.[0];
  if (rl && (rl.label !== c.routeLogicLabel || rl.detail !== c.routeLogicDetail)) {
    rl.label = c.routeLogicLabel;
    rl.detail = c.routeLogicDetail;
    note(SMALL, locale, "route-logic claim rewritten ('all five signatures, plus Taejongdae')");
  }
  const trust = (doc.bookingTrustItems ?? []).find((t) => TAEJONGDAE.test(String(t.body ?? "")));
  if (trust) {
    trust.body = c.bookingTrustGroupSize;
    note(SMALL, locale, "group-size trust item rewritten");
  }
  const acc = byId(doc.practicalAccordionItems, "accessibility");
  if (acc) {
    const next = { ...acc, preview: c.accessibilityPreview, content: clone(c.accessibilityContent) };
    if (JSON.stringify(acc) !== JSON.stringify(next)) {
      Object.assign(acc, next);
      note(SMALL, locale, "accessibility accordion rewritten (it said age 8+, the policy says 4+)");
    }
  }
}

/**
 * R2 — the private charter contradicted itself about pickup. Its own
 * `pickup_dropoff.notes` says plainly "pickup is at the cruise terminal, not a
 * hotel. Hotel pickup is not offered on this SKU" — while the SEO description,
 * the Included bullet and the return step all offered hotel/KTX pickup, and the
 * matching profile advertised `cruise_terminal_or_hotel_or_ktx`. The listing is
 * cruise-passengers-only with terminal pickup, so the note is the one that is
 * right. Also: the return step said 90 minutes in `detail` and 60 in
 * `description`, in the same object; and the guide was "English-speaking" where
 * the listing sells English AND Chinese.
 *
 * ⚠ NOT touched — vehicle capacity. The FAQ caps at 7 passengers and tells
 * larger groups to ask for a quote, while `pricingTiers` sells 1–6 / 7–9 / 10–13.
 * Which is true is an operational fact, and it is tangled with the open owner
 * decision about whether those tiers survive at all. Left for the owner.
 */
function alignPrivateCharter(doc, locale) {
  const c = content[locale].privateCharter;
  if (!c) return;

  if (doc.seo && doc.seo.metaDescription !== c.seoMetaDescription) {
    doc.seo.metaDescription = c.seoMetaDescription;
    note(PRIVATE, locale, "seo.metaDescription offered hotel/KTX pickup this SKU does not do");
  }
  for (const section of doc.whyTourWorks?.routeLogicSections ?? []) {
    for (const item of section.items ?? []) {
      if (!/hotel|호텔|ホテル|酒店|飯店|KTX/i.test(String(item.detail ?? ""))) continue;
      if (item.detail !== c.includedDetail) {
        item.detail = c.includedDetail;
        note(PRIVATE, locale, "Included bullet offered hotel/KTX pickup, and named only an English guide");
      }
    }
  }
  for (const step of doc.bookingSupportSteps ?? []) {
    if (!/hotel|호텔|ホテル|酒店|飯店|KTX/i.test(String(step.detail ?? ""))) continue;
    if (step.detail !== c.returnStepDetail) {
      step.detail = c.returnStepDetail;
      note(PRIVATE, locale, "return step said 90 min in detail and 60 in description, plus hotel/KTX drop-off");
    }
  }
  if (doc.matching_profile?.pickup_base && doc.matching_profile.pickup_base !== "cruise_terminal") {
    doc.matching_profile.pickup_base = "cruise_terminal";
    note(PRIVATE, locale, "matching pickup_base was cruise_terminal_or_hotel_or_ktx");
  }

  // 🔴 The five non-English bundles are an older generation of this product: they
  // carry THREE meeting points (cruise terminal / KTX station / any downtown
  // hotel) and two drop-off points, where English carries only the terminals.
  // A cruise-only SKU was structurally selling hotel pickup — not just claiming
  // it in prose. Drop the points the product does not serve.
  const HOTEL_OR_KTX = /hotel|호텔|ホテル|酒店|飯店|KTX|釜山駅|부산역|釜山站|Estación/i;
  for (const field of ["meeting_points", "dropoff_points"]) {
    const list = doc.pickup_dropoff?.[field];
    if (!Array.isArray(list)) continue;
    const kept = list.filter((p) => !HOTEL_OR_KTX.test(String(p.name ?? "")));
    if (kept.length && kept.length !== list.length) {
      doc.pickup_dropoff[field] = kept;
      note(PRIVATE, locale, `${field}: dropped ${list.length - kept.length} hotel/KTX point(s) this SKU does not serve`);
    }
  }

  // Owner instruction: "픽업은 북항 혹은 영도항 대중이 없어 둘 다 적어야 돼" — both
  // terminals, neither the default. English lists both; the other five listed one
  // cruise terminal plus the KTX/hotel points just removed, which would have left
  // them naming a single terminal. Restore the pair.
  const mps = doc.pickup_dropoff?.meeting_points;
  if (Array.isArray(mps) && mps.length === 1 && c.terminalYeongdo && c.terminalChoryang) {
    const base = mps[0];
    doc.pickup_dropoff.meeting_points = [
      { ...clone(base), name: c.terminalYeongdo },
      { ...clone(base), name: c.terminalChoryang },
    ];
    note(PRIVATE, locale, "meeting points named one terminal only — both are now stated, neither as default");
  }
  for (const dp of doc.pickup_dropoff?.dropoff_points ?? []) {
    if (c.dropoffName && dp.name !== c.dropoffName) {
      dp.name = c.dropoffName;
      note(PRIVATE, locale, "drop-off point now names the terminal you were collected from");
    }
  }

  // Same offer, restated in whichever accordion schema this locale uses: English
  // has {preview, content[]}, the others {icon, details[]}.
  const items = doc.practicalAccordionItems ?? [];
  for (const item of items) {
    for (const key of ["details", "content"]) {
      const arr = item[key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((line, i) => {
        if (typeof line !== "string" || !HOTEL_OR_KTX.test(line)) return;
        const next = /drop|하차|드롭|降車|送回|entrega/i.test(line) ? c.dropoffLine : c.pickupLine;
        if (arr[i] !== next) {
          arr[i] = next;
          note(PRIVATE, locale, `${key} line offered hotel/KTX pickup on a cruise-only charter`);
        }
      });
    }
  }

  // The pickup stop was literally named "…(or hotel/KTX)" outside English.
  const first = doc.itineraryStops?.[0];
  if (first && HOTEL_OR_KTX.test(String(first.name ?? "")) && first.name !== c.pickupStopName) {
    first.name = c.pickupStopName;
    note(PRIVATE, locale, "pickup stop was named after pickup points this SKU does not serve");
  }
}

/** S2 + S3 — inclusions and the policy accordion. */
function applyInclusionsAndPolicy(doc, slug, locale) {
  const c = content[locale];
  const tier = slug === PRIVATE ? "private" : "join";
  const inc = c.inclusions[tier];
  const items = doc.practicalAccordionItems;
  if (!Array.isArray(items)) return;

  // The join bundles key this item `id: "inclusions"` — note "inclus", not
  // "includ", which an earlier version of this matcher got wrong and silently
  // rewrote nothing. The private charter has no ids at all, so it is matched on
  // the localised title instead.
  const incItem =
    items.find((it) => String(it.id ?? "").toLowerCase().includes("inclu")) ??
    items.find((it) => INCLUSION_TITLE[locale].test(String(it.title ?? "")));
  if (!incItem) throw new Error(`${slug} [${locale}]: no inclusions accordion item found`);
  if (incItem) {
    const body = [
      `${c.inclusions.includedLabel}: ${inc.included.join(" · ")}`,
      `${c.inclusions.excludedLabel}: ${inc.excluded.join(" · ")}`,
    ];
    if (JSON.stringify(incItem.content) !== JSON.stringify(body)) {
      incItem.content = body;
      incItem.preview = body[0];
      note(slug, locale, "inclusions/exclusions rewritten to the listing");
    }
  }

  const p = c.policy;
  const existing = items.find((it) => it.id === p.id);
  const built = {
    id: p.id,
    title: tier === "private" ? p.titlePrivate : p.titleJoin,
    preview: tier === "private" ? p.previewPrivate : p.previewJoin,
    content: tier === "private" ? clone(p.contentPrivate) : clone(p.contentJoin),
  };
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(built)) {
      Object.assign(existing, built);
      note(slug, locale, "policy accordion refreshed");
    }
  } else {
    items.push(built);
    note(slug, locale, "policy accordion added (surcharge / cancellation / age / cruise-only)");
  }
}

function applyStopsCount(doc, slug, locale, n) {
  if (doc.catalog_card && doc.catalog_card.stopsCount !== n) {
    doc.catalog_card.stopsCount = n;
    note(slug, locale, `stopsCount -> ${n}`);
  }
}

// ---------------------------------------------------------------------------
// Join bus tour: split Songdo, re-time, fix the stops this pass touches.
// ---------------------------------------------------------------------------
function rebuildJoinBus(doc, locale) {
  const c = content[locale];
  const s = doc.itineraryStops;
  if (s.length === 12) return; // already rebuilt
  if (s.length !== 11) throw new Error(`${JOIN_BUS} [${locale}]: expected 11 stops, found ${s.length}`);

  const songdo = s[8];
  const rebuilt = [
    s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7],
    songdoStop("songdo_cloud_trails", c, songdo),
    songdoStop("songdo_sky_park", c, songdo),
    s[9], s[10],
  ];
  doc.itineraryStops = rebuilt;
  note(JOIN_BUS, locale, "Songdo split into Cloud Trails + Sky Park (11 -> 12 entries, 9 sights)");
}

// ---------------------------------------------------------------------------
// Small group: adopt the same 9-stop course, donating the discrete stops from
// the join bundle (same locale) and adapting them from coach to van.
// ---------------------------------------------------------------------------
function rebuildSmall(doc, locale, donorDoc) {
  const c = content[locale];
  const s = doc.itineraryStops;
  if (s.length === 12) return;
  if (s.length !== 8) throw new Error(`${SMALL} [${locale}]: expected 8 stops, found ${s.length}`);

  const d = donorDoc.itineraryStops; // donor is already rebuilt -> 12 entries
  const donate = (i) => vanify(clone(d[i]), locale);

  // 🔴 EVERY sight comes from the donor, including the three this bundle already
  // had. Its non-English stop NAMES did not match its own `_poi_meta.poi_key`:
  // ko/ja/zh/zh-TW/es called stop 2 "유엔기념공원" under poi_key
  // haedong_yonggungsa, stop 3 "태종대" under un_memorial_cemetery, and so on —
  // a whole older course, live, disagreeing with the English page. Keeping the
  // local copies "because they were already translated" reproduced that on the
  // rendered page, and only a real render showed it.
  // Only the three stops with no sight attached stay local: they are generic.
  doc.itineraryStops = [
    s[0], // pickup (own — terminal text, rewritten below)
    donate(1), // Haedong Yonggungsa
    donate(2), // UN Memorial Cemetery
    s[3], // lunch (own — restaurant is not a fixed POI)
    donate(4), // Jagalchi Market
    donate(5), // BIFF Square
    donate(6), // Gukje Market
    donate(7), // Gamcheon Culture Village
    donate(8), // Songdo Cloud Trails
    donate(9), // Songdo Sky Park
    donate(10), // Yongdusan Park
    s[7], // return (own)
  ];
  note(SMALL, locale, "course rebuilt to the listing's 9 stops, all donated (8 -> 12 entries)");
}

/** Fields this pass owns on both join tiers. */
function applySharedCopy(doc, slug, locale) {
  const c = content[locale];
  const s = doc.itineraryStops;

  if (c.pickupDescription && s[0].description !== c.pickupDescription) {
    s[0].description = c.pickupDescription;
    note(slug, locale, "pickup description rewritten (two co-equal terminals, 09:00, 8h)");
  }
  if (c.returnDescription && s[11].description !== c.returnDescription) {
    s[11].description = c.returnDescription;
    note(slug, locale, "return description rewritten (17:00, same terminal)");
  }
  if (c.stopNames.lunch && s[3].name !== c.stopNames.lunch) {
    s[3].name = c.stopNames.lunch;
    note(slug, locale, "lunch stop renamed (own expense)");
  }
  // Native BIFF / Gukje text where the bundle still carried English.
  // `en.json` deliberately has neither key: its English copy is the original
  // and must not be shortened.
  if (c.biffDescription && s[5].description !== c.biffDescription) {
    s[5].description = c.biffDescription;
    note(slug, locale, "BIFF description was English on a non-English page — replaced");
  }
  if (c.gukjeDescription && s[6].description !== c.gukjeDescription) {
    s[6].description = c.gukjeDescription;
    note(slug, locale, "Gukje description was English on a non-English page — replaced");
  }
  // The 8-hour spine makes four timing CLAIMS false, not just four numbers:
  // Gamcheon was sold on "golden hour ~16:00" (now 14:20), Yongdusan on
  // "twilight 18:30" (now 16:25), Jagalchi on landing "between the lunch and
  // dinner crowds" at 14:00 (now 12:45, i.e. inside the lunch crowd), and the
  // pickup text compared the day to "the same eight signature stops as our
  // small-group product" — which is now nine, and the same course. Renumbering
  // would have left golden hour attached to 14:20. These are rewritten.
  const WHY = [
    [0, "pickup"], [4, "jagalchi"], [7, "gamcheon"], [10, "yongdusan"], [11, "return"],
  ];
  for (const [i, key] of WHY) {
    const next = c.stopWhyOnRoute?.[key];
    if (next && s[i].whyOnRoute !== next) {
      s[i].whyOnRoute = next;
      note(slug, locale, `whyOnRoute rewritten for stop ${i + 1} (${key}) — old timing claim no longer true`);
    }
  }
  // 🔴 The small-group lunch stop told five of the six locales that lunch was
  // INCLUDED, at a price ("total USD $58.50") that was never this product's.
  // Only the English said "lunch paid directly". The listing is unambiguous:
  // lunch is at the guest's own expense.
  if (Array.isArray(c.lunchHighlights) && JSON.stringify(s[3].highlights) !== JSON.stringify(c.lunchHighlights)) {
    s[3].highlights = clone(c.lunchHighlights);
    note(slug, locale, "lunch highlights rewritten (some locales claimed lunch was included, at a stale price)");
  }
  if (c.heroStops && doc.hero?.meta?.stops && doc.hero.meta.stops !== c.heroStops) {
    doc.hero.meta.stops = c.heroStops;
    note(slug, locale, `hero stop count -> ${c.heroStops}`);
  }
  if (slug === JOIN_BUS && c.tierComparisonFaq) {
    const q = (doc.staticQuestions ?? []).find((x) => String(x.id ?? "") === "bus-vs-small-group");
    if (q && (q.question !== c.tierComparisonFaq.question || q.answer !== c.tierComparisonFaq.answer)) {
      q.question = c.tierComparisonFaq.question;
      q.answer = c.tierComparisonFaq.answer;
      note(slug, locale, "tier-comparison FAQ rewritten (quoted $49/$79 and eight stops)");
    }
  }
  if (c.gamcheonTip && s[7].smartNotes && s[7].smartNotes.tip !== c.gamcheonTip) {
    s[7].smartNotes.tip = c.gamcheonTip;
    note(slug, locale, "Gamcheon tip no longer claims the tour arrives at golden hour");
  }

  if (Array.isArray(c.routePhases) && JSON.stringify(doc.routePhases) !== JSON.stringify(c.routePhases)) {
    doc.routePhases = clone(c.routePhases);
    note(slug, locale, "routePhases rewritten to the new course");
  }
  if (c.routeShapeIntro && doc.routeShapeIntro) {
    if (doc.routeShapeIntro.subtitle !== c.routeShapeIntro.subtitle) {
      doc.routeShapeIntro.subtitle = c.routeShapeIntro.subtitle;
      note(slug, locale, "routeShapeIntro subtitle re-timed");
    }
  }
  applyRouteLogic(doc, slug, locale);
  applyClockMap(doc, slug, locale);
  applyStaleFigures(doc, slug, locale);
  stripUnrenderedBold(doc, slug, locale);

  // "9 hours" survived the first pass in seo.metaDescription, catalog_card.badges,
  // whyTourWorks.bestFor / lessIdealFor and bookingTrustItems, because that pass
  // matched `9 hours` with whitespace and the live copy says `9-hour`.
  // Safe to sweep the whole doc: `\b9` never matches inside 09:30, 1964 or 19,20.
  let nine = 0;
  const swept = mapStrings(doc, (str) => {
    const next = str
      .replace(/\b9([\s-]*)(hours?|horas?)\b/gi, "8$1$2")
      .replace(/\b9(\s*)(시간|時間|小时|小時)/g, "8$1$2");
    if (next !== str) nine += 1;
    return next;
  });
  if (nine) {
    for (const k of Object.keys(swept)) doc[k] = swept[k];
    note(slug, locale, `${nine} leftover "9 hour" claim(s) -> 8`);
  }

  // NOTE: the sweep above rebuilds the tree, so `doc.itineraryStops` is a NEW
  // array by now and the local `s` is detached. Everything after this point must
  // read `doc.itineraryStops` again — an earlier revision applied the clock spine
  // to the orphaned array and silently left every stop showing its old time.
  applySpine(doc.itineraryStops, locale);
  doc.routeFlowStops = rebuildFlow(doc.itineraryStops, doc.routeFlowStops);
  applyStopsCount(doc, slug, locale, 9);
}

// ---------------------------------------------------------------------------
// Leftover-defect scan. Structured edits only above — nothing is regex-swept
// across the doc, because Gukje's opening hours are literally "09:30-19:30"
// and a blind time sweep would corrupt them.
// ---------------------------------------------------------------------------
const SKIP_ROOTS = new Set(["page_sections", "_publication", "matching_metadata"]);
const STALE_TIME = /\b(08:25|08:30|09:30 ?(?:픽업|출발)|11:15|12:30|14:45|15:10|17:45|18:30|19:15|19:30 ?(?:반납|재승선)|17:30)\b/;
const STALE_HOURS = /\b9[\s-]*(hours?|horas?)\b|9\s*(시간|時間|小时|小時)/i;
const TAEJONGDAE = /taejongdae|태종대|テジョンデ|太宗台|danubi|다누비|ダヌビ|达努比|達努比/i;

function scan(doc) {
  const out = { time: [], hours: [], taejongdae: [] };
  const walk = (v, p) => {
    if (typeof v === "string") {
      if (STALE_TIME.test(v)) out.time.push(`${p} :: ${v.replace(/\n/g, " ").slice(0, 80)}`);
      if (STALE_HOURS.test(v)) out.hours.push(`${p} :: ${v.replace(/\n/g, " ").slice(0, 80)}`);
      if (TAEJONGDAE.test(v)) out.taejongdae.push(`${p} :: ${v.replace(/\n/g, " ").slice(0, 80)}`);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (!p && SKIP_ROOTS.has(k)) continue;
        walk(x, p ? `${p}.${k}` : k);
      }
    }
  };
  walk(doc, "");
  return out;
}

// ---------------------------------------------------------------------------

let files = 0;
const report = [];

for (const locale of LOCALES) {
  const joinPath = bundlePath(JOIN_BUS, locale);
  const smallPath = bundlePath(SMALL, locale);
  const privPath = bundlePath(PRIVATE, locale);
  if (!existsSync(joinPath) || !existsSync(smallPath)) {
    console.warn(`  skip (missing bundle): ${locale}`);
    continue;
  }

  const joinRaw = readFileSync(joinPath, "utf8");
  const smallRaw = readFileSync(smallPath, "utf8");
  const joinDoc = JSON.parse(joinRaw);
  const smallDoc = JSON.parse(smallRaw);

  rebuildJoinBus(joinDoc, locale);
  applySharedCopy(joinDoc, JOIN_BUS, locale);
  applyInclusionsAndPolicy(joinDoc, JOIN_BUS, locale);

  rebuildSmall(smallDoc, locale, joinDoc);
  applySharedCopy(smallDoc, SMALL, locale);
  alignSmallGroupToCourse(smallDoc, joinDoc, locale);
  applyInclusionsAndPolicy(smallDoc, SMALL, locale);

  for (const [doc, slug] of [[joinDoc, JOIN_BUS], [smallDoc, SMALL]]) {
    rebuildGalleryCaptions(doc, slug, locale);
    rebuildMatchingAnchors(doc, slug, locale);
  }

  const writes = [[joinPath, joinRaw, joinDoc], [smallPath, smallRaw, smallDoc]];

  if (existsSync(privPath)) {
    const privRaw = readFileSync(privPath, "utf8");
    const privDoc = JSON.parse(privRaw);
    applyInclusionsAndPolicy(privDoc, PRIVATE, locale); // S2 + S3 only — the charter's course is its own
    alignPrivateCharter(privDoc, locale);
    writes.push([privPath, privRaw, privDoc]);
  }

  for (const [p, raw, doc] of writes) {
    const out = `${JSON.stringify(doc, null, 2)}\n`;
    if (out !== raw) {
      files += 1;
      if (!DRY && !REPORT_ONLY) writeFileSync(p, out);
    }
    const found = scan(doc);
    const slug = p.split("/")[2];
    for (const kind of ["time", "hours", "taejongdae"]) {
      if (found[kind].length) report.push({ slug, locale, kind, hits: found[kind] });
    }
  }
}

if (!REPORT_ONLY) {
  console.log(CHANGES.length ? CHANGES.join("\n") : "(no changes)");
  console.log(`\n${DRY ? "[dry-run] would rewrite" : "rewrote"} ${files} file(s)`);
}

console.log("\n--- leftover scan (guest-visible fields only) ---");
if (!report.length) console.log("clean");
for (const kind of ["hours", "time", "taejongdae"]) {
  const rows = report.filter((r) => r.kind === kind);
  if (!rows.length) continue;
  console.log(`\n[${kind}]`);
  for (const r of rows) {
    console.log(`  ${r.slug.replace("busan-", "").slice(0, 32).padEnd(34)} ${r.locale.padEnd(6)} ${r.hits.length}`);
    if (r.locale === "en") r.hits.slice(0, 10).forEach((h) => console.log(`      ${h}`));
  }
}
