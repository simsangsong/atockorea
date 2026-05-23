#!/usr/bin/env node
// Phase audit-P0 #1 — canonicalize cruise pickup_dropoff in static JSON.
//
// Audit doc: docs/tour-product-en-post-merge-audit-2026-05-23.md P0 #1
//
// Pre-state (verified 2026-05-23):
//   bus-tour       en / zh-TW / es — pickup_dropoff = cruise terminals ✓
//   bus-tour       ko / ja / zh    — pickup_dropoff = STALE hotel/airport ✗
//   small-group    en              — pickup_dropoff = cruise terminals ✓
//   small-group    ko / ja / zh / zh-TW / es — pickup_dropoff = MISSING ✗
//
// DB (tour_product_pages.detail_payload.pickup_dropoff):
//   All 12 rows (2 slugs × 6 locales) still have STALE hotel/airport data,
//   even for locales whose static JSON has been fixed.
//
// This script:
//   1. Builds canonical cruise-terminal pickup_dropoff per locale (ko/ja/zh
//      hand-translated to match the zh-TW/es style; en stays as-is)
//   2. Writes to static JSON files for the 8 affected slug/locale pairs
//      (3 stale bus-tour locales + 5 missing small-group locales)
//   3. Emits SQL UPDATE statements for all 12 DB rows so a follow-up
//      MCP call can sync them in one batch
//
// The DB cleanup is the audit's actual P0; static cleanup is added to
// prevent future rebuild-from-static from re-introducing the stale data.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const SLUGS = [
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
];
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// =====================================================================
// Per-locale terminal name + note + time + notes phrases
// =====================================================================

const TIME = {
  en: "Confirmed at booking (≈30 min after ship docking)",
  ko: "예약 시 확정 (선박 입항 후 약 30분)",
  ja: "ご予約時に確定（船舶接岸後約30分）",
  zh: "预订时确认（船舶靠港后约30分钟）",
  "zh-TW": "於預訂時確認（船舶靠港後約 30 分鐘）",
  es: "Se confirma al reservar (≈30 min tras el atraque del barco)",
};

const JEJU_NAME = {
  en: "Jeju International Passenger Terminal (제주항 — north Jeju)",
  ko: "제주항 국제 여객 터미널 (제주항 — 제주 북부)",
  ja: "済州港 国際旅客ターミナル（제주항 — 済州北部）",
  zh: "济州港国际客运码头（제주항 — 济州北部）",
  "zh-TW": "濟州國際客運碼頭（제주항 — 濟州北部）",
  es: "Terminal Internacional de Pasajeros de Jeju (제주항 — norte de Jeju)",
};
const JEJU_NAME_RETURN = {
  en: "Jeju International Passenger Terminal (제주항)",
  ko: "제주항 국제 여객 터미널 (제주항)",
  ja: "済州港 国際旅客ターミナル（제주항）",
  zh: "济州港国际客运码头（제주항）",
  "zh-TW": "濟州國際客運碼頭（제주항）",
  es: "Terminal Internacional de Pasajeros de Jeju (제주항)",
};

const GANGJEONG_NAME = {
  en: "Gangjeong Civil-Military Cruise Terminal (강정항 — south Jeju, Seogwipo)",
  ko: "강정 군민 공동 사용 크루즈 터미널 (강정항 — 제주 남부, 서귀포)",
  ja: "江汀港 軍民共用クルーズターミナル（강정항 — 済州南部・西帰浦）",
  zh: "江汀港军民共用邮轮码头（강정항 — 济州南部，西归浦）",
  "zh-TW": "江汀軍民共用郵輪碼頭（강정항 — 濟州南部 · 西歸浦）",
  es: "Terminal Civil-Militar de Cruceros de Gangjeong (강정항 — sur de Jeju, Seogwipo)",
};
const GANGJEONG_NAME_RETURN = {
  en: "Gangjeong Civil-Military Cruise Terminal (강정항)",
  ko: "강정 군민 공동 사용 크루즈 터미널 (강정항)",
  ja: "江汀港 軍民共用クルーズターミナル（강정항）",
  zh: "江汀港军民共用邮轮码头（강정항）",
  "zh-TW": "江汀軍民共用郵輪碼頭（강정항）",
  es: "Terminal Civil-Militar de Cruceros de Gangjeong (강정항)",
};

const PICKUP_NOTE_JEJU = {
  en: "For ships docking at Jeju Port. Meet your guide at the cruise terminal arrival hall — guide holds an AtoC Korea sign with your name.",
  ko: "제주항에 정박하는 선박용. 크루즈 터미널 도착홀에서 가이드를 만나주세요 — 가이드가 손님 성함이 적힌 AtoC Korea 사인을 들고 있습니다.",
  ja: "済州港に停泊する船舶用。クルーズターミナルの到着ホールでガイドにお会いください — ガイドはお名前を記したAtoC Koreaのサインを掲げています。",
  zh: "适用于停泊济州港的邮轮。请于邮轮码头到达大厅与导游会合 — 导游手持写有您姓名的 AtoC Korea 接待牌。",
  "zh-TW": "適用於停泊於濟州港的郵輪。於郵輪碼頭抵達大廳與您的導遊會合 — 導遊將手持寫有您姓名的 AtoC Korea 接待牌。",
  es: "Para barcos que atracan en el Puerto de Jeju. Encuentre a su guía en el vestíbulo de llegadas del terminal de cruceros — el guía sostendrá un cartel de AtoC Korea con su nombre.",
};
const PICKUP_NOTE_GANGJEONG = {
  en: "For ships docking at Gangjeong Port. Meet your guide at the cruise terminal arrival hall — guide holds an AtoC Korea sign with your name.",
  ko: "강정항에 정박하는 선박용. 크루즈 터미널 도착홀에서 가이드를 만나주세요 — 가이드가 손님 성함이 적힌 AtoC Korea 사인을 들고 있습니다.",
  ja: "江汀港に停泊する船舶用。クルーズターミナルの到着ホールでガイドにお会いください — ガイドはお名前を記したAtoC Koreaのサインを掲げています。",
  zh: "适用于停泊江汀港的邮轮。请于邮轮码头到达大厅与导游会合 — 导游手持写有您姓名的 AtoC Korea 接待牌。",
  "zh-TW": "適用於停泊於江汀港的郵輪。於郵輪碼頭抵達大廳與您的導遊會合 — 導遊將手持寫有您姓名的 AtoC Korea 接待牌。",
  es: "Para barcos que atracan en el Puerto de Gangjeong. Encuentre a su guía en el vestíbulo de llegadas del terminal de cruceros — el guía sostendrá un cartel de AtoC Korea con su nombre.",
};

const NOTES_BLOCK = {
  en: "Return is to the same cruise terminal your tour started from, with comfortable buffer before sail-away. We have never missed a sail-away — on-time return is the core of the cruise shore-excursion product.",
  ko: "투어 출발 시 사용한 같은 크루즈 터미널로 복귀하며, 출항 전 충분한 여유 시간을 둡니다. 출항을 놓친 적은 단 한 번도 없습니다 — 정시 복귀가 크루즈 쇼어 엑스커션 상품의 핵심입니다.",
  ja: "ツアー出発時と同じクルーズターミナルへ戻り、出航時刻前に十分なバッファを設けます。出航に遅れたことは一度もありません — 定刻復帰がクルーズショアエクスカーション商品の核心です。",
  zh: "返回出发时同一邮轮码头，于离港前预留充裕缓冲时间。我们从未错过任何一次离港 — 准时返港是邮轮岸上行程的核心。",
  "zh-TW": "返程送回您出發的同一個郵輪碼頭，並預留充裕的離港緩衝時間。我們從未錯過任何一次離港 — 準時返港是郵輪岸上行程的核心。",
  es: "El regreso se realiza al mismo terminal de cruceros desde el que comenzó el tour, con un margen cómodo antes del zarpe. Nunca hemos perdido un zarpe — el regreso a tiempo es el núcleo del producto de excursión costera en crucero.",
};

function buildPickupDropoff(locale) {
  return {
    departure: [
      {
        order: 1,
        time: TIME[locale],
        name: JEJU_NAME[locale],
        type: "cruise_terminal",
        note: PICKUP_NOTE_JEJU[locale],
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        time: TIME[locale],
        name: GANGJEONG_NAME[locale],
        type: "cruise_terminal",
        note: PICKUP_NOTE_GANGJEONG[locale],
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    return: [
      {
        order: 1,
        name: JEJU_NAME_RETURN[locale],
        type: "cruise_terminal",
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        name: GANGJEONG_NAME_RETURN[locale],
        type: "cruise_terminal",
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    notes: NOTES_BLOCK[locale],
  };
}

// =====================================================================
// Determine which static JSON files need writing
// =====================================================================

function needsStaticWrite(slug, locale) {
  const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
  if (!fs.existsSync(fp)) return false;
  const t = JSON.parse(fs.readFileSync(fp, "utf8"));
  const pd = t.pickup_dropoff;
  if (!pd) return true; // missing
  const firstDep = pd.departure?.[0];
  if (!firstDep) return true;
  // If the first departure already has a cruise_terminal type, consider it clean
  return firstDep.type !== "cruise_terminal";
}

// =====================================================================
// EXECUTE — static JSON writes
// =====================================================================

console.log(`\n=== Cruise pickup canonicalize ===\n`);

let staticWrites = 0;
const sqlUpdates = [];

for (const slug of SLUGS) {
  for (const locale of LOCALES) {
    const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
    if (!fs.existsSync(fp)) continue;
    const tour = JSON.parse(fs.readFileSync(fp, "utf8"));
    const canonical = buildPickupDropoff(locale);

    if (needsStaticWrite(slug, locale)) {
      tour.pickup_dropoff = canonical;
      fs.writeFileSync(fp, JSON.stringify(tour, null, 2) + "\n", "utf8");
      staticWrites++;
      console.log(`[static] ${slug}.${locale}.json — pickup_dropoff replaced`);
    }

    // Always queue DB update (every row was stale per audit)
    sqlUpdates.push({ slug, locale, canonical });
  }
}

console.log(`\nstatic JSON writes: ${staticWrites}`);
console.log(`DB rows to update: ${sqlUpdates.length}`);

// =====================================================================
// EXECUTE — emit SQL UPDATE batch
// =====================================================================

const sqlPath = path.join(ROOT, "scripts", "phase-cruise-pickup-db-updates.sql");
const sqlLines = [
  "-- Auto-generated by phase-cruise-pickup-canonicalize.mjs (do not edit by hand)",
  "-- Run via mcp__atockorea__execute_sql in batches.",
  "",
];

for (const { slug, locale, canonical } of sqlUpdates) {
  const json = JSON.stringify(canonical).replace(/'/g, "''");
  sqlLines.push(
    `UPDATE public.tour_product_pages SET detail_payload = jsonb_set(detail_payload, '{pickup_dropoff}', '${json}'::jsonb) WHERE slug = '${slug}' AND locale = '${locale}';`
  );
}
fs.writeFileSync(sqlPath, sqlLines.join("\n") + "\n", "utf8");
console.log(`\nWrote SQL batch: ${sqlPath}`);
console.log(`Apply via MCP: mcp__atockorea__execute_sql with the contents.`);
