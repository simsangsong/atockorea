/**
 * Tour-content Phase 3 — re-map operational fields on
 *   - busan-small-group-sightseeing-tour-cruise-passengers
 *   - busan-private-car-charter-cruise-shore
 *
 * Both tours had `itineraryStops` whose narrative (description) was correct
 * but whose operational metadata (_poi_meta, images, visitBasics, smartNotes,
 * highlights, convenience, timeUsed, whyOnRoute) belonged to a different
 * attraction. The fix copies operational fields from `busan-cruise-shore-
 * excursion-bus-tour`'s matching stop into the target stop, while preserving
 * the target's own description / name / time / duration / category / number
 * (memory rule `feedback_data_preservation` — additive-only by default but
 * surgical corrections authorized for this track).
 *
 * Private-charter's [1] Route planning and [4] Return are operational stops,
 * not attractions — their _poi_meta and visitBasics are cleared (no hours /
 * admission semantics apply) and images stripped to avoid leaking the wrong
 * attraction's gallery.
 *
 * Lunch contradiction: `itineraryStops[0].highlights` on busan-small-group
 * advertised "Lunch included" while [3] correctly says "Lunch paid directly".
 * The [0] highlight is rewritten to match the actual policy.
 */

import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

/**
 * Mapping for small-group's attraction stops. Each entry describes a target
 * stop in busan-small-group and the source stop in busan-cruise-bus whose
 * operational fields we replicate. The `note` is for the human reader only.
 */
const SMALL_GROUP_REMAPS = [
  { targetIdx: 1, sourceIdx: 1, note: "Haedong Yonggungsa Temple" },
  { targetIdx: 2, sourceIdx: 2, note: "UN Memorial Cemetery (poi_key was right, images wrong)" },
  { targetIdx: 4, sourceIdx: 4, note: "Jagalchi/BIFF/Gukje — primary = Jagalchi" },
  { targetIdx: 5, sourceIdx: 7, note: "Gamcheon Culture Village" },
  { targetIdx: 6, sourceIdx: 8, note: "Songdo/Yongdusan — primary = Songdo" },
];

/**
 * Operational fields copied from source → target. Everything else
 * (description, name, time, duration, category, number, image — singular
 * note: kept for cards that read the singular `image`) is preserved.
 */
const FIELDS_TO_COPY = [
  "_poi_meta",
  "visitBasics",
  "smartNotes",
  "highlights",
  "convenience",
  "whyOnRoute",
  "images",
  "image",
  "timeUsed",
];

/** Locale-specific lunch-contradiction rewrite, indexed by locale + original phrase needle. */
const LUNCH_FIX = {
  en: {
    needle: "**Lunch included**",
    replacement: "**Lunch break** at a guide-recommended Busan restaurant (own expense, ₩10–15k)",
  },
  ko: {
    needle: "**점심 포함**",
    replacement: "**점심 휴식** — 가이드 추천 식당 (자율 식사, ₩10,000–15,000)",
  },
  ja: {
    needle: "**ランチ込み**",
    replacement: "**ランチ休憩** — ガイド推奨の地元レストラン（各自負担、₩10,000–15,000）",
  },
  zh: {
    needle: "**包括午餐**",
    replacement: "**午餐时间** — 导游推荐的当地餐厅（自费，₩10,000–15,000）",
  },
  "zh-TW": {
    needle: "**包括午餐**",
    replacement: "**午餐時間** — 導遊推薦的當地餐廳（自費，₩10,000–15,000）",
  },
  es: {
    needle: "**Almuerzo incluido**",
    replacement: "**Pausa para almorzar** en un restaurante de Busán recomendado por la guía (gasto propio, ₩10,000–15,000)",
  },
};

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJSON(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function jsonPath(slug, locale) {
  return `${ROOT}/${slug}/${slug}.${locale}.json`;
}

let mutations = 0;

for (const loc of LOCALES) {
  const bus = readJSON(jsonPath("busan-cruise-shore-excursion-bus-tour", loc));
  // ---- busan-small-group ----
  const sgPath = jsonPath("busan-small-group-sightseeing-tour-cruise-passengers", loc);
  const sg = readJSON(sgPath);

  for (const { targetIdx, sourceIdx, note } of SMALL_GROUP_REMAPS) {
    const target = sg.itineraryStops?.[targetIdx];
    const source = bus.itineraryStops?.[sourceIdx];
    if (!target || !source) {
      console.warn(`  ${loc}: small-group [${targetIdx}] ← bus [${sourceIdx}] (${note}) — skipped (missing)`);
      continue;
    }
    for (const field of FIELDS_TO_COPY) {
      if (source[field] !== undefined) {
        target[field] = JSON.parse(JSON.stringify(source[field]));
      } else {
        delete target[field];
      }
    }
    mutations++;
  }

  // ---- lunch-contradiction rewrite on small-group [0] highlights ----
  const fix = LUNCH_FIX[loc];
  const pickup = sg.itineraryStops?.[0];
  if (pickup?.highlights && fix) {
    pickup.highlights = pickup.highlights.map((h) =>
      typeof h === "string" && h.includes(fix.needle) ? h.replace(fix.needle + " at local Busan restaurant", fix.replacement).replace(fix.needle, fix.replacement) : h,
    );
    mutations++;
  }

  writeJSON(sgPath, sg);
  console.log(`  ${loc}: small-group ✅ — 5 attraction remaps + lunch highlight`);

  // ---- busan-private-charter operational stops [1] Route planning, [4] Return ----
  const pcPath = jsonPath("busan-private-car-charter-cruise-shore", loc);
  const pc = readJSON(pcPath);
  for (const idx of [1, 4]) {
    const s = pc.itineraryStops?.[idx];
    if (!s) continue;
    // Operational stop — clear attraction-leaked metadata.
    if (s._poi_meta) {
      const opsKey = idx === 1 ? "OPS_route_planning" : "OPS_busan_cruise_return";
      s._poi_meta = { poi_key: opsKey, kind: "operational" };
    }
    delete s.visitBasics; // no hours/admission semantics for operational stops
    delete s.images; // strip attraction gallery
    delete s.image;
    delete s.smartNotes; // attraction-only
    delete s.convenience; // attraction-only
    mutations++;
  }
  writeJSON(pcPath, pc);
  console.log(`  ${loc}: private-charter ✅ — operational stops [1] [4] cleaned`);
}

console.log(`\ntotal mutations: ${mutations}`);
