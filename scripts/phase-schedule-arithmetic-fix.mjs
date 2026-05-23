#!/usr/bin/env node
// Schedule arithmetic precision fix.
//
// Two minor schedule inconsistencies flagged by the audit:
//
// (1) seoul-seoraksan-nami-island-morning-calm-day-tour
//     Seoraksan itineraryStop says 180 min (3 hours) starting at ≈10:00 → ends ≈13:00.
//     Lunch references say "around 12:30 en route from Seoraksan to Nami" —
//     impossible if Seoraksan ends at 13:00. Fix: shift lunch refs to 13:30.
//     Drive math: Seoraksan 13:00 → 30-min restaurant stop → 1h drive → Nami 14:30 ✓.
//
// (2) jeju-cherry-blossom-tour-east-route
//     Ilchul Land Gardens ends 16:15 → Seongsan Ilchulbong starts 16:15.
//     Zero-minute drive gap, but Ilchul→Seongsan is ~15 min by car.
//     Fix: push Seongsan start from 16:15 to 16:30.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const SWAPS = [];

// ════════════════ (1) Seoul-Seoraksan-Nami lunch 12:30 → 13:30 ════════════════
// EN
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "en",
  needle: "Light snacks if you start without breakfast — first food stop is around 12:00-12:30 en route to Nami.",
  replacement: "Light snacks if you start without breakfast — first food stop is around 13:00-13:30 en route to Nami.",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "en",
  needle: "Lunch is taken en route from Seoraksan to Nami, around 12:30…",
  replacement: "Lunch is taken en route from Seoraksan to Nami, around 13:30…",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "en",
  needle: "Lunch is taken en route from Seoraksan to Nami, around 12:30 at a local restaurant in the Inje-Chuncheon corridor.",
  replacement: "Lunch is taken en route from Seoraksan to Nami, around 13:30 at a local restaurant in the Inje-Chuncheon corridor.",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "en",
  needle: "The coach stops at a local Gangwon-do restaurant en route from Seoraksan to Nami around 12:30.",
  replacement: "The coach stops at a local Gangwon-do restaurant en route from Seoraksan to Nami around 13:30.",
});

// KO
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "ko",
  needle: "아침 식사 없이 출발하시는 분은 가벼운 간식을 챙겨오세요 — 첫 번째 식사 장소는 남이섬으로 이동 중 12:00~12:30경입니다.",
  replacement: "아침 식사 없이 출발하시는 분은 가벼운 간식을 챙겨오세요 — 첫 번째 식사 장소는 남이섬으로 이동 중 13:00~13:30경입니다.",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "ko",
  needle: "버스는 설악산에서 남이섬으로 이동하는 도중 12:30경 강원도 현지 식당에 정차합니다.",
  replacement: "버스는 설악산에서 남이섬으로 이동하는 도중 13:30경 강원도 현지 식당에 정차합니다.",
});

// JA
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "ja",
  needle: "朝食なしで出発される場合は軽食をご持参ください。最初の食事休憩は南怡島への途中、12:00〜12:30頃です。",
  replacement: "朝食なしで出発される場合は軽食をご持参ください。最初の食事休憩は南怡島への途中、13:00〜13:30頃です。",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "ja",
  needle: "昼食は雪岳山からナミ島への移動途中、12:30頃に…",
  replacement: "昼食は雪岳山からナミ島への移動途中、13:30頃に…",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "ja",
  needle: "昼食は雪岳山からナミ島への移動途中、12:30頃にインジェ〜春川（チュンチョン）回廊沿いの地元レストランでお取りいただきます。",
  replacement: "昼食は雪岳山からナミ島への移動途中、13:30頃にインジェ〜春川（チュンチョン）回廊沿いの地元レストランでお取りいただきます。",
});

// ZH
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh",
  needle: "若未用早餐便出发，请自备轻便零食——首次用餐停靠约在前往南怡岛途中的12:00至12:30。",
  replacement: "若未用早餐便出发，请自备轻便零食——首次用餐停靠约在前往南怡岛途中的13:00至13:30。",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh",
  needle: "午餐安排在从雪岳山前往南怡岛的途中，约12:30用餐……",
  replacement: "午餐安排在从雪岳山前往南怡岛的途中，约13:30用餐……",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh",
  needle: "午餐安排在从雪岳山前往南怡岛的途中，约12:30，在麟蹄—春川沿线的当地餐厅用餐。",
  replacement: "午餐安排在从雪岳山前往南怡岛的途中，约13:30，在麟蹄—春川沿线的当地餐厅用餐。",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh",
  needle: "大巴约12:30在从雪岳山前往南怡岛途中的一家江原道本地餐厅停靠。",
  replacement: "大巴约13:30在从雪岳山前往南怡岛途中的一家江原道本地餐厅停靠。",
});

// ZH-TW
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh-TW",
  needle: "若未食用早餐即出發，請自備輕食小點——前往南怡島途中的首個用餐站約在12:00至12:30。",
  replacement: "若未食用早餐即出發，請自備輕食小點——前往南怡島途中的首個用餐站約在13:00至13:30。",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh-TW",
  needle: "午餐約於12:30在從雪嶽山前往南怡島的途中用餐……",
  replacement: "午餐約於13:30在從雪嶽山前往南怡島的途中用餐……",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh-TW",
  needle: "午餐約於12:30在從雪嶽山前往南怡島的途中，於麟蹄—春川走廊沿線的當地餐廳用餐。",
  replacement: "午餐約於13:30在從雪嶽山前往南怡島的途中，於麟蹄—春川走廊沿線的當地餐廳用餐。",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "zh-TW",
  needle: "約12:30從雪嶽山前往南怡島途中，巴士將停靠一家江原道當地餐廳。",
  replacement: "約13:30從雪嶽山前往南怡島途中，巴士將停靠一家江原道當地餐廳。",
});

// ES
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "es",
  needle: "Aperitivos ligeros si comienza sin desayunar — la primera parada para comer es aproximadamente a las 12:00-12:30 de camino a Nami.",
  replacement: "Aperitivos ligeros si comienza sin desayunar — la primera parada para comer es aproximadamente a las 13:00-13:30 de camino a Nami.",
});
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour", locale: "es",
  needle: "El almuerzo se realiza en ruta desde Seoraksan hasta Nami, aproximadamente a las 12:30…",
  replacement: "El almuerzo se realiza en ruta desde Seoraksan hasta Nami, aproximadamente a las 13:30…",
});

// ════════════════ (2) Jeju-cherry-east Seongsan 16:15 → 16:30 ════════════════
// This requires direct itineraryStops mutation since it's a structured field.
// Handled via separate object-walk in the EXECUTE block below.

console.log(`\n=== Schedule arithmetic fix ===\n`);
const byFile = new Map();
for (const s of SWAPS) {
  const fp = path.join(TOURS_DIR, s.slug, `${s.slug}.${s.locale}.json`);
  if (!byFile.has(fp)) byFile.set(fp, []);
  byFile.get(fp).push(s);
}

let total = 0, applied = 0;
const missed = [];
for (const [fp, swaps] of byFile) {
  if (!fs.existsSync(fp)) { console.log("missing:", fp); continue; }
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;
  for (const s of swaps) {
    total++;
    const count = raw.split(s.needle).length - 1;
    if (count === 0) {
      missed.push({ file: path.basename(fp), needle: s.needle.slice(0, 60) });
      continue;
    }
    raw = raw.split(s.needle).join(s.replacement);
    appliedHere += count;
    applied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw);
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${path.basename(fp)}]  ${appliedHere} swap(s)`);
  }
}

console.log(`\n--- jeju-cherry Seongsan 16:15 → 16:30 (itineraryStops field) ---`);
const jejuCherrySlug = "jeju-cherry-blossom-tour-east-route";
let stopFixCount = 0;
for (const locale of ["en", "ko", "ja", "zh", "zh-TW", "es"]) {
  const fp = path.join(TOURS_DIR, jejuCherrySlug, `${jejuCherrySlug}.${locale}.json`);
  if (!fs.existsSync(fp)) continue;
  const tour = JSON.parse(fs.readFileSync(fp, "utf8"));
  let changed = false;
  function walkStops(node) {
    if (Array.isArray(node)) {
      for (const v of node) walkStops(v);
      return;
    }
    if (node && typeof node === "object") {
      // Seongsan Ilchulbong stop with time 16:15 → 16:30
      const nameStr = node.name || node.title || "";
      if ((nameStr.includes("Seongsan Ilchulbong") || nameStr.includes("성산일출봉") || nameStr.includes("城山日出峰") || nameStr.includes("Seongsan")) && node.time === "16:15") {
        node.time = "16:30";
        changed = true;
      }
      for (const v of Object.values(node)) walkStops(v);
    }
  }
  walkStops(tour);
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(tour, null, 2) + "\n", "utf8");
    stopFixCount++;
    console.log(`[${jejuCherrySlug}.${locale}.json] Seongsan time 16:15 → 16:30`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Lunch-time swaps: ${applied}/${total}`);
console.log(`Seongsan time fix: ${stopFixCount} locale file(s)`);
if (missed.length > 0) {
  console.log(`\nMissed needles:`);
  for (const m of missed) console.log(`  ${m.file}: ${m.needle}...`);
}
