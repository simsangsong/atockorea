#!/usr/bin/env node
// Phase 5b — verify-then-fix surgical needle-and-replace.
//
// External facts verified 2026-05-23 via VisitKorea, Wikipedia/MBC, official sources:
//   1. Camellia Hill (Jeju) adult admission ₩12,000 (VisitKorea official) — data had ₩10,000
//   2. Garden of Morning Calm = 20 thematic gardens (VisitKorea official) — data had 22 in one ES file
//   3. "Jewel in the Palace" / Daejanggeum (2003-04) aired on MBC with peak rating ~57.1%
//      — data claimed "50M viewers" (factually impossible; Korea population ~52M)
//
// All swaps preserve surrounding text per `feedback_data_preservation` additive-only rule
// (just changes the inaccurate fact, never deletes surrounding copy).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

function readBundle(slug, locale) {
  const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
  return { fp, obj: JSON.parse(fs.readFileSync(fp, "utf8")) };
}
function writeBundle(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function deepReplaceString(node, replacer) {
  if (typeof node === "string") return replacer(node);
  if (Array.isArray(node)) return node.map((v) => deepReplaceString(v, replacer));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = deepReplaceString(v, replacer);
    return out;
  }
  return node;
}

// =====================================================================
// SWAP TABLES
// =====================================================================

const SWAPS = [];

// --- Jewel in the Palace: 50M viewers → peak ~57% rating on MBC ---
// Slug: seoul-suwon-hwaseong-folk-village-starfield-library — all 6 locales
// Slug: seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library — ja/zh/zh-TW/es (bodies)

const JEWEL = {
  // Bullet items + body refs
  en: [
    ["(2003, 50M viewers)", "(2003, peak ~57% rating on MBC)"],
    ["(50M viewers)", "(peak ~57% rating on MBC)"],
  ],
  ko: [
    ["(2003년, 시청자 5천만 명)", "(2003년 MBC, 최고 시청률 ~57%)"],
    ["대장금(시청자 5천만 명),", "대장금(MBC 최고 시청률 ~57%),"],
  ],
  ja: [
    ["（2003年、視聴者5,000万人）のロケ地", "（2003年 MBC、最高視聴率 約57%）のロケ地"],
    ["「宮廷女官チャングムの誓い」（視聴者5,000万人）", "「宮廷女官チャングムの誓い」（MBC、最高視聴率 約57%）"],
    // description body refs
    ["大長今、2003年）**のロケ地 — 国内視聴者5,000万人を誇る朝鮮時代を代表する名作で", "大長今、2003年）**のロケ地 — MBC で最高視聴率 約57% を記録した朝鮮時代を代表する名作で"],
    ["全54話・国内視聴者5,000万人）", "全54話、MBC 最高視聴率 約57%）"],
    // gwangmyeong slug
    ["大장금、2003年）**のロケ地としても知られ、国内視聴者5,000万人を誇る朝鮮時代の名作ドラマです。", "大장금、2003年）**のロケ地としても知られ、MBC で最高視聴率 約57% を記録した朝鮮時代の名作ドラマです。"],
    ["대장금、2003年）**のロケ地としても知られ、国内視聴者5,000万人を誇る朝鮮時代の名作ドラマです。", "대장금、2003年）**のロケ地としても知られ、MBC で最高視聴率 約57% を記録した朝鮮時代の名作ドラマです。"],
  ],
  zh: [
    ["（2003年，收视人数达5000万）", "（2003年 MBC，最高收视率约57%）"],
    ["《大长今》（5000万观众）", "《大长今》（MBC，最高收视率约57%）"],
    // description body refs
    ["《大长今》（2003年）**的拍摄地 — 这部具有代表性的朝鲜时代史剧在韩国创下5,000万观众的收视纪录 — 使其成为韩国史剧拍摄最频繁的取景地之一。", "《大长今》（2003年）**的拍摄地 — 这部具有代表性的朝鲜时代史剧在 MBC 创下约57%的最高收视率 — 使其成为韩国史剧拍摄最频繁的取景地之一。"],
    ["《大长今》（2003-04年，共54集，国内观众达5000万）", "《大长今》（2003-04 年 MBC，共54集，最高收视率约57%）"],
    // gwangmyeong slug
    ["这部脍炙人口的朝鲜题材剧集在韩国国内吸引了5,000万观众。", "这部脍炙人口的朝鲜题材剧集在 MBC 创下约57%的最高收视率。"],
  ],
  "zh-TW": [
    ["（2003年，收視觀眾達5,000萬）", "（2003年 MBC，最高收視率約57%）"],
    ["《大長今》（5,000 萬觀眾）", "《大長今》（MBC，最高收視率約57%）"],
    // description body refs
    ["《大長今》（2003年）**的拍攝地點——這部朝鮮時代的經典巨作在韓國累積了5,000萬名觀眾——使其成為韓國最具代表性的宮廷劇取景地之一。", "《大長今》（2003年）**的拍攝地點——這部朝鮮時代的經典巨作在 MBC 創下約 57% 的最高收視率——使其成為韓國最具代表性的宮廷劇取景地之一。"],
    ["《大長今》（2003至04年，共54集，國內收視人次達5,000萬）", "《大長今》（2003 至 04 年 MBC，共 54 集，最高收視率約 57%）"],
    // gwangmyeong slug
    ["該劇是朝鮮歷史劇的經典之作，國內觀眾累計達5,000萬人次。", "該劇是朝鮮歷史劇的經典之作，於 MBC 創下約 57% 的最高收視率。"],
  ],
  es: [
    ["(2003, 50 millones de espectadores)", "(2003 en MBC, índice máximo ~57%)"],
    ["La joya en el palacio (50 millones de espectadores),", "La joya en el palacio (MBC, índice máximo ~57%),"],
    // description body refs
    ["el icónico éxito de la era Joseon con 50 millones de espectadores nacionales — convirtiéndolo en u", "el icónico éxito de la era Joseon con un índice máximo de ~57% en MBC — convirtiéndolo en u"],
    ["'La joya en el palacio / Daejanggeum' (2003-04, 50 millones de espectadores nacionales en 54 episodios)", "'La joya en el palacio / Daejanggeum' (2003-04 en MBC, índice máximo ~57% en 54 episodios)"],
    // gwangmyeong slug
    ["el icónico éxito de la era Joseon con 50 millones de espectadores en el mercado doméstico.", "el icónico éxito de la era Joseon con un índice máximo de ~57% en MBC."],
  ],
};

for (const slug of [
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
]) {
  for (const [loc, pairs] of Object.entries(JEWEL)) {
    for (const [needle, replacement] of pairs) {
      SWAPS.push({ slug, locale: loc, needle, replacement, label: "Jewel-50M→57%" });
    }
  }
}

// --- Camellia Hill admission ₩10,000 → ₩12,000 (ES only, 3 files) ---
SWAPS.push({
  slug: "jeju-winter-southwest-tangerine-snow-camellia-tour",
  locale: "es",
  needle: "Camellia Hill ₩10,000",
  replacement: "Camellia Hill ₩12,000",
  label: "Camellia-10k→12k",
});
SWAPS.push({
  slug: "jeju-hydrangea-festival-tour-southwest-route",
  locale: "es",
  needle: "Camellia Hill (10,000 KRW)",
  replacement: "Camellia Hill (12,000 KRW)",
  label: "Camellia-10k→12k",
});
// The jeju-hydrangea-southwest also has "30,000 KRW" total budget that was based on 10k —
// recompute: 15,000 (Hallim) + 12,000 (Camellia) + 2,000 (Jusangjeolli) + 2,500 (Cheonjeyeon) = 31,500
SWAPS.push({
  slug: "jeju-hydrangea-festival-tour-southwest-route",
  locale: "es",
  needle: "Presupuesta aproximadamente 30,000 KRW por persona para todas las entradas (Jusangjeolli 2,000 + Cheonjeyeon 2,500 completan el total).",
  replacement: "Presupuesta aproximadamente 31,500 KRW por persona para todas las entradas (Jusangjeolli 2,000 + Cheonjeyeon 2,500 completan el total).",
  label: "Camellia-budget-recompute",
});

// --- Garden of Morning Calm 22 → 20 themed gardens (ES only, 1 file) ---
SWAPS.push({
  slug: "seoul-seoraksan-nami-island-morning-calm-day-tour",
  locale: "es",
  needle: "5.000 especies, 22 jardines temáticos",
  replacement: "5.000 especies, 20 jardines temáticos",
  label: "MorningCalm-22→20",
});

// =====================================================================
// EXECUTE
// =====================================================================

console.log(`\n=== Phase 5b — verify-then-fix sweep ===\n`);
const summary = { total: 0, applied: 0, missed: [] };

const byFile = new Map();
for (const swap of SWAPS) {
  const fp = path.join(TOURS_DIR, swap.slug, `${swap.slug}.${swap.locale}.json`);
  if (!byFile.has(fp)) byFile.set(fp, []);
  byFile.get(fp).push(swap);
}

for (const [fp, swaps] of byFile) {
  let raw = fs.readFileSync(fp, "utf8");
  const beforeLen = raw.length;
  let appliedHere = 0;
  for (const s of swaps) {
    summary.total++;
    const count = raw.split(s.needle).length - 1;
    if (count === 0) {
      summary.missed.push({ file: path.basename(fp), label: s.label, needle: s.needle.slice(0, 60) });
      continue;
    }
    raw = raw.split(s.needle).join(s.replacement);
    summary.applied += count;
    appliedHere += count;
  }
  if (appliedHere > 0) {
    // JSON round-trip verify
    const parsed = JSON.parse(raw);
    const reSerialized = JSON.stringify(parsed, null, 2) + "\n";
    fs.writeFileSync(fp, reSerialized, "utf8");
    console.log(`[${path.basename(fp)}]  applied ${appliedHere} swap(s)`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total swap candidates: ${summary.total}`);
console.log(`Applied: ${summary.applied}`);
console.log(`Missed (no needle match): ${summary.missed.length}`);
if (summary.missed.length > 0) {
  console.log(`\nMissed:`);
  for (const m of summary.missed) {
    console.log(`  ${m.file}  [${m.label}]  ${m.needle}...`);
  }
}
