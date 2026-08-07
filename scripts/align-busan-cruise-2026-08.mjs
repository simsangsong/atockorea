#!/usr/bin/env node
/**
 * Align the three Busan cruise shore-excursion SKUs with their channel listings.
 * (owner instruction 2026-08-04)
 *
 * What this pass changes, across 3 slugs x 6 locales:
 *   1. price      -> exact to the cent, no invented strike-through
 *   2. duration   -> 8 hours (was 9h on the two join products)
 *   3. pickup     -> the two Busan cruise terminals stated as CO-EQUAL.
 *                    There is no default terminal: which one you use depends on
 *                    where the ship berths. Our copy used to rank them
 *                    ("primary" / "alternate" / "secondary for smaller ships"),
 *                    which reads as a default that does not exist.
 *   4. capacity   -> small-group SKU max 12 guests (registry said 8, prose said ~10)
 *
 * NOT in this pass (tracked in docs/busan-shore-excursion-tenant-onboarding-2026-08-04.md):
 *   - 9-stop course alignment on the small-group SKU
 *   - inclusions/exclusions bullet rewrite
 *   - surcharge / cancellation / age policy prose
 *
 * Idempotent: re-running produces no further diff.
 *
 * Run: node scripts/align-busan-cruise-2026-08.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry-run");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const SLUGS = {
  join: "busan-cruise-shore-excursion-bus-tour",
  small: "busan-small-group-sightseeing-tour-cruise-passengers",
  private: "busan-private-car-charter-cruise-shore",
};

/**
 * Exact listing prices, to the cent.
 *
 * 🔴 The private charter is NOT a single-number product. It is sold on a
 * duration x party-size rate card (`pricingTiers`), which the product page has
 * always rendered and which the owner confirmed on 2026-08-07 is the price.
 * Putting the listing's US$456.99 here made the catalogue quote a figure the
 * page never showed and the booking never honoured. Its list price is now the
 * cheapest cell on that card, and checkout resolves the exact cell the guest
 * picked — see lib/tour-product/charterRateCard.ts.
 */
/**
 * 🔴 The private charter is NOT listed here, on purpose.
 *
 * It is not a single-number product: it sells off a duration x party-size rate
 * card, and since 2026-08-07 the checkout charges the exact cell the guest
 * picked (lib/tour-product/charterRateCard.ts). Its headline is therefore
 * derived from that card, and the card is owned by whoever is repricing the
 * charter — as of this writing a parallel session was moving it to a flat $269.
 *
 * This script used to hardcode 169 for it. Leaving that in means the next person
 * to run this file silently reverts their reprice — exactly the way the terminal
 * note below used to drag back the i18n track's retranslations. A hardcoded
 * price in a re-runnable script is a landmine with a delay on it.
 */
const PRICE = {
  [SLUGS.join]: 58.79,
  [SLUGS.small]: 68.95,
};

/**
 * Pre-discount price, shown struck through beside the sale price.
 *
 * Owner 2026-08-07: show it. The listing itself never prints the "before"
 * figure — it prints a **30% off** badge next to each join tier (recorded in the
 * competitor analysis, commit e10b63fe: "US$58.79 (30% off 배지)" and
 * "US$68.95 (30% off)"). So the before-price is arithmetic on the listing's own
 * badge, not a number anyone invented here, and it round-trips to the cent:
 *
 *     98.50 x 0.7 = 68.95   exactly
 *     83.99 x 0.7 = 58.793  -> 58.79
 *
 * 🔴 The private charter gets NO strike-through. Its price is our own rate card
 * (cheapest cell $169), not a discounted listing price, so there is no "before"
 * to strike — inventing one would be the thing we refused to do all along.
 */
const LISTING_DISCOUNT_PERCENT = 30;
const ORIGINAL = {
  [SLUGS.join]: 83.99,
  [SLUGS.small]: 98.5,
};

/** "8 hours" per locale, plus the digit forms used inside prose duration strings. */
const DURATION = {
  en: "8 hours",
  ko: "8시간",
  ja: "8時間",
  zh: "8小时",
  "zh-TW": "8小時",
  es: "8 horas",
};

/**
 * Replaces the ranking note on each terminal. Same sentence for both terminals —
 * that is the point: neither is the default.
 */
const TERMINAL_NOTE = {
  en: "Busan cruise ships berth at either terminal — which one applies to you depends on where your ship docks, and is confirmed at booking. Meet your guide in the arrival hall.",
  ko: "부산 기항 크루즈는 두 터미널 중 어느 쪽에도 접안합니다. 어느 터미널을 이용할지는 배가 접안하는 곳에 따라 정해지며 예약 후 확정됩니다. 도착 홀에서 가이드를 만나시면 됩니다.",
  ja: "釜山に寄港するクルーズ船は、どちらのターミナルにも着岸します。どちらになるかは船の着岸場所によって決まり、ご予約後に確定します。到着ホールでガイドがお待ちしています。",
  zh: "停靠釜山的邮轮两个码头都有可能使用，具体以您船只的靠泊位置为准，预订后确认。请在到达大厅与导游会合。",
  "zh-TW": "停靠釜山的郵輪兩個碼頭都有可能使用，實際以您船隻的靠泊位置為準，預訂後確認。請在抵達大廳與導遊會合。",
  es: "Los cruceros que hacen escala en Busan atracan en cualquiera de las dos terminales; cuál te corresponde depende de dónde atraque tu barco y se confirma al reservar. Reúnete con tu guía en la sala de llegadas.",
};

/** Prose sentences that assert a single/default terminal. Replaced wholesale. */
const SINGLE_TERMINAL_PROSE = {
  en: "Your group meets in the arrival hall of whichever Busan cruise terminal your ship berths at — the Busan International Cruise Terminal (Yeongdo) or the Busan Port International Passenger Terminal (Choryang). The terminal is confirmed at booking.",
  ko: "집합은 배가 접안하는 부산 크루즈 터미널의 도착 홀입니다 — 영도 크루즈터미널 또는 부산항국제여객터미널(초량) 중 한 곳이며, 터미널은 예약 후 확정됩니다.",
  ja: "集合場所は、お客様の船が着岸する釜山のクルーズターミナル到着ホールです — 影島クルーズターミナルまたは釜山港国際旅客ターミナル（草梁）のいずれかで、ご予約後に確定します。",
  zh: "集合地点为您的船只靠泊的釜山邮轮码头到达大厅 — 影岛邮轮码头或釜山港国际旅客码头（草梁），具体码头预订后确认。",
  "zh-TW": "集合地點為您的船隻靠泊的釜山郵輪碼頭抵達大廳 — 影島郵輪碼頭或釜山港國際旅客碼頭（草梁），實際碼頭預訂後確認。",
  es: "El grupo se reúne en la sala de llegadas de la terminal de cruceros de Busan en la que atraque tu barco: la Terminal Internacional de Cruceros de Busan (Yeongdo) o la Terminal Internacional de Pasajeros del Puerto de Busan (Choryang). La terminal se confirma al reservar.",
};

const CHANGES = [];
function note(slug, locale, what) {
  CHANGES.push(`${slug} [${locale}] ${what}`);
}

/** Walk every string in the tree, applying fn(str) -> str|null. */
function mapStrings(node, fn) {
  if (typeof node === "string") return fn(node) ?? node;
  if (Array.isArray(node)) return node.map((v) => mapStrings(v, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = mapStrings(v, fn);
    return out;
  }
  return node;
}

/** Set or clear the struck-through price on one `price`-shaped object. */
function setPriceBlock(price, usd, original) {
  price.amountLabel = String(usd);
  price.salePriceUsd = usd;
  if (original) {
    price.originalPriceUsd = original;
    price.discountPercent = LISTING_DISCOUNT_PERCENT;
  } else {
    delete price.originalPriceUsd;
    delete price.discountPercent;
  }
}

function applyPrice(doc, slug, locale) {
  const usd = PRICE[slug];
  if (usd == null) return; // rate-card product — see the comment on PRICE
  const original = ORIGINAL[slug] ?? null;
  if (doc.price && typeof doc.price === "object") {
    const before = JSON.stringify(doc.price);
    setPriceBlock(doc.price, usd, original);
    if (JSON.stringify(doc.price) !== before) {
      note(slug, locale, original ? `price -> ${usd} (was ${original}, ${LISTING_DISCOUNT_PERCENT}% off)` : `price -> ${usd}`);
    }
  }
  if (doc.sticky_booking_bar && typeof doc.sticky_booking_bar === "object" && doc.sticky_booking_bar.price) {
    setPriceBlock(doc.sticky_booking_bar.price, usd, original);
  }
  // Let the card render the formatted listPriceUsd (currency switcher aware)
  // instead of a hardcoded, now-stale English price sentence.
  if (doc.catalog_card && doc.catalog_card.priceLabel) {
    doc.catalog_card.priceLabel = "";
    note(slug, locale, "priceLabel cleared (card formats listPriceUsd)");
  }
}

function applyDuration(doc, slug, locale) {
  if (slug === SLUGS.private) return; // private charter is already an 8-hour block
  const target = DURATION[locale];
  const nineRe = /\b9\s*(hours|horas)\b|9\s*(시간|時間|小时|小時)/g;
  let hits = 0;
  const swap = (s) => {
    if (!nineRe.test(s)) return null;
    nineRe.lastIndex = 0;
    hits += 1;
    return s.replace(nineRe, (m) => m.replace("9", "8"));
  };
  if (doc.catalog_card) doc.catalog_card.duration = target;
  if (doc.hero?.meta?.duration) doc.hero.meta.duration = swap(doc.hero.meta.duration) ?? doc.hero.meta.duration;
  for (const g of doc.glanceItems ?? []) {
    if (g.icon === "clock") g.value = target;
  }
  if (doc.matching_profile && typeof doc.matching_profile.duration_hours === "number") {
    doc.matching_profile.duration_hours = 8;
  }
  if (doc.matching_profile?.duration_band) doc.matching_profile.duration_band = "8h";
  if (hits) note(slug, locale, `duration 9h -> 8h (${hits} prose strings)`);
}

/** Strip the ranking language from whichever pickup schema this bundle uses. */
function applyTerminals(doc, slug, locale) {
  const pd = doc.pickup_dropoff;
  if (!pd) return;
  const noteText = TERMINAL_NOTE[locale];
  let touched = 0;
  /**
   * 🔴 Only rewrite notes that still RANK the terminals. This used to overwrite
   * unconditionally, which meant every re-run dragged back the i18n track's
   * retranslated notes — a silent clobber of another session's work, and one
   * that reappeared every time anyone ran this script. The job here was always
   * "remove the ranking", not "own this sentence".
   */
  const RANKS = /\bprimary\b|\balternate\b|\bsecondary\b|주\s?터미널|보조\s?터미널|메인 터미널|主要ターミナル|副ターミナル|主要码头|備用|备用|terminal principal|terminal alternativa/i;
  const setNote = (obj, key) => {
    if (!obj || typeof obj !== "object" || typeof obj[key] !== "string") return;
    if (!RANKS.test(obj[key])) return;
    obj[key] = noteText;
    touched += 1;
  };
  // Schema: { primary, alternates[] }
  setNote(pd.primary, "instructions");
  for (const a of pd.alternates ?? []) setNote(a, "instructions");
  // Schema: { departure[], return[] }
  for (const d of pd.departure ?? []) setNote(d, "note");
  for (const r of pd.return ?? []) setNote(r, "note");
  // Schema: { meeting_points[], dropoff_points[] }
  for (const m of pd.meeting_points ?? []) setNote(m, "note");
  for (const d of pd.dropoff_points ?? []) setNote(d, "note");
  if (touched) note(slug, locale, `${touched} terminal note(s) de-ranked`);
}

/**
 * Small-group capacity: registry said 8, prose said ~10 (and one KO string said
 * ~14), a cross-reference FAQ said ~12. The listing says a hard 12, so the
 * hedge ("about", "≈") goes too.
 */
const CAPACITY_PATTERNS = {
  en: [
    [/up to (?:about|≈)?\s*10 passengers/gi, "up to 12 passengers"],
    [/capped at ~?≈?\s*10 passengers/gi, "capped at 12 passengers"],
  ],
  ko: [
    [/최대\s*약?\s*1[04]\s*명/g, "최대 12명"],
    [/약\s*1[04]\s*명까지/g, "12명까지"],
  ],
  ja: [
    [/最大\s*約?\s*10\s*名/g, "最大12名"],
    [/定員は約?\s*10\s*名/g, "定員は12名"],
  ],
  zh: [[/最多\s*约?\s*10\s*名/g, "最多 12 名"], [/约\s*10\s*名乘客/g, "12 名乘客"]],
  "zh-TW": [
    [/最多\s*約?\s*10\s*[名位]/g, "最多 12 名"],
    [/約\s*10\s*[人位]/g, "12 人"],
  ],
  es: [
    [/(?:hasta\s*)?[≈~]?\s*10\s*(personas|pasajeros)/gi, "hasta 12 $1"],
    [/aproximadamente\s*10\s*pasajeros/gi, "12 pasajeros"],
  ],
};

function applyCapacity(doc, slug, locale) {
  if (slug !== SLUGS.small) return;
  let hits = 0;
  const patched = mapStrings(doc, (s) => {
    let next = s;
    for (const [re, to] of CAPACITY_PATTERNS[locale] ?? []) next = next.replace(re, to);
    if (next !== s) hits += 1;
    return next;
  });
  if (hits) {
    for (const k of Object.keys(patched)) doc[k] = patched[k];
    note(slug, locale, `capacity -> 12 (${hits} strings)`);
  }
  if (doc.matching_profile) doc.matching_profile.max_group_size = 12;
}

/** One-line value for a "Pickup" glance chip that named a single terminal. */
const PICKUP_GLANCE = {
  en: "Either Busan cruise terminal — confirmed at booking",
  ko: "부산 크루즈 터미널 2곳 중 접안지 — 예약 시 확정",
  ja: "釜山の2つのクルーズターミナルのいずれか — 予約時に確定",
  zh: "釜山两个邮轮码头之一 — 预订时确认",
  "zh-TW": "釜山兩個郵輪碼頭之一 — 預訂時確認",
  es: "Cualquiera de las dos terminales de crucero — se confirma al reservar",
};

/**
 * The pickup accordion's `preview` and first `content` line asserted a single
 * meeting terminal. Both are replaced with the co-equal statement; the rest of
 * the accordion (disembarkation timing, what to provide at booking, early-pickup
 * surcharge) is left intact.
 */
function applySingleTerminalProse(doc, slug, locale) {
  const replacement = SINGLE_TERMINAL_PROSE[locale];
  let hits = 0;

  for (const item of doc.practicalAccordionItems ?? []) {
    if (String(item.id ?? "").toLowerCase() !== "pickup") continue;
    if (typeof item.preview === "string" && item.preview !== replacement) {
      item.preview = replacement;
      hits += 1;
    }
    if (Array.isArray(item.content) && item.content.length && item.content[0] !== replacement) {
      item.content[0] = replacement;
      hits += 1;
    } else if (typeof item.content === "string" && item.content !== replacement) {
      item.content = replacement;
      hits += 1;
    }
  }

  const glanceValue = PICKUP_GLANCE[locale];
  const pickupLabels = ["pickup", "픽업", "ピックアップ", "接送", "接送地點", "recogida"];
  for (const g of doc.glanceItems ?? []) {
    const label = String(g.label ?? "").toLowerCase();
    if (!pickupLabels.some((l) => label === l.toLowerCase())) continue;
    if (typeof g.value === "string" && g.value !== glanceValue) {
      g.value = glanceValue;
      hits += 1;
    }
  }

  if (hits) note(slug, locale, `${hits} single-terminal field(s) rewritten`);
}

let files = 0;
for (const slug of Object.values(SLUGS)) {
  for (const locale of LOCALES) {
    const path = `components/product-tour-static/${slug}/${slug}.${locale}.json`;
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      console.warn(`  skip (missing): ${path}`);
      continue;
    }
    const doc = JSON.parse(raw);
    applyPrice(doc, slug, locale);
    applyDuration(doc, slug, locale);
    applyTerminals(doc, slug, locale);
    applyCapacity(doc, slug, locale);
    applySingleTerminalProse(doc, slug, locale);
    const out = `${JSON.stringify(doc, null, 2)}\n`;
    if (out !== raw) {
      files += 1;
      if (!DRY) writeFileSync(path, out);
    }
  }
}

console.log(CHANGES.length ? CHANGES.join("\n") : "(no changes)");
console.log(`\n${DRY ? "[dry-run] would rewrite" : "rewrote"} ${files} file(s)`);
