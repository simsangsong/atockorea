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
  applyInclusionsAndPolicy(smallDoc, SMALL, locale);

  const writes = [[joinPath, joinRaw, joinDoc], [smallPath, smallRaw, smallDoc]];

  if (existsSync(privPath)) {
    const privRaw = readFileSync(privPath, "utf8");
    const privDoc = JSON.parse(privRaw);
    applyInclusionsAndPolicy(privDoc, PRIVATE, locale); // S2 + S3 only — the charter's course is its own
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
