#!/usr/bin/env node
// Phase locale-residual sweep — close remaining EN-only or temporally-stale leaks.
//
// Fixes identified by phase-locale-residual-audit.mjs (2026-05-23):
//   1. Bukchon "≈600 hanoks" → "≈900 hanoks" (EN only, 2 instances in
//      from-incheon-seoul-day-tour-cruise-guests.en.json L992 + L2045).
//      All non-EN locales already say 900 (handled by earlier loc-B PR).
//   2. Silla Gold Crowns "Power and Prestige" special exhibition
//      ran Oct 28 - Dec 14, 2025 (APEC commemoration). Today is May 2026,
//      so the exhibition is past. 3 instances per locale × 6 locales = 18
//      surgical past-tense rewrites in
//      busan-gyeongju-unesco-legacy-tour-national-museum/*.json
//
// Per `feedback_data_preservation` — surgical, no information loss; only
// verb tenses shift from "current/until" to "concluded" + a closing
// sentence noting the Cheonmachong crown remains the permanent centerpiece.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const SWAPS = [];

// =====================================================================
// Bukchon 600 hanoks → 900 hanoks (EN only)
// =====================================================================
SWAPS.push({
  slug: "from-incheon-seoul-day-tour-cruise-guests",
  locale: "en",
  needle: "Most of the ≈600 hanoks in Bukchon",
  replacement: "Most of the ≈900 hanoks in Bukchon",
  label: "Bukchon-600→900",
});

// =====================================================================
// Silla Gold Crowns past-tense rewrite — 6 locales × 3 needles
// =====================================================================
const SILLA_SLUG = "busan-gyeongju-unesco-legacy-tour-national-museum";

// EN
SWAPS.push({
  slug: SILLA_SLUG, locale: "en", label: "Silla-GC-tense-1",
  needle: "**'Silla Gold Crowns' exhibition through Dec 14, 2025** — all 6 crowns reunited for the first time in 104 years (commemorating Gyeongju APEC 2025)",
  replacement: "**'Silla Gold Crowns' special exhibition (Oct 28 – Dec 14, 2025, concluded)** — briefly reunited all 6 crowns for the first time in 104 years (commemorated Gyeongju APEC 2025)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "en", label: "Silla-GC-tense-2",
  needle: "**Oct 28 - Dec 14, 2025 special exhibition reunited 6 Silla gold crowns for the first time in 104 years** (APEC Summit commemoration)",
  replacement: "**The Oct 28 – Dec 14, 2025 special exhibition briefly reunited 6 Silla gold crowns for the first time in 104 years** (APEC Summit commemoration; concluded Dec 14, 2025; today the Cheonmachong gold crown remains the permanent Silla Hall centerpiece)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "en", label: "Silla-GC-tense-3",
  needle: "The current major exhibition (running through Dec 14, 2025 to commemorate the **2025 Gyeongju APEC Summit**) is **'Silla Gold Crowns: Power and Prestige' — reuniting all 6 Silla gold crowns for the first time in 104 years**.",
  replacement: "The **2025 Gyeongju APEC Summit** commemorative special exhibition **'Silla Gold Crowns: Power and Prestige'** briefly reunited all 6 Silla gold crowns for the first time in 104 years (Oct 28 – Dec 14, 2025, concluded); today the Cheonmachong gold crown remains the permanent Silla Hall centerpiece.",
});

// KO
SWAPS.push({
  slug: SILLA_SLUG, locale: "ko", label: "Silla-GC-tense-1",
  needle: "**'신라 금관' 특별전 (2025년 12월 14일까지)** — 104년 만에 금관 6점 한자리에 집결 (경주 APEC 2025 기념)",
  replacement: "**'신라 금관' 특별전 (2025년 10월 28일~12월 14일, 종료)** — 104년 만에 금관 6점 한자리 집결 (경주 APEC 2025 기념)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "ko", label: "Silla-GC-tense-2",
  needle: "**2025년 10월 28일~12월 14일 특별전: 104년 만에 신라 금관 6점 한자리에** (APEC 정상회의 기념)",
  replacement: "**2025년 10월 28일~12월 14일 특별전, 104년 만에 신라 금관 6점 한자리 재결합** (APEC 정상회의 기념, 2025년 12월 14일 종료; 현재 천마총 금관은 상설 신라역사관의 중심 전시품으로 자리합니다)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "ko", label: "Silla-GC-tense-3",
  needle: "현재 특별전(**2025 경주 APEC 정상회의** 기념, 2025년 12월 14일까지)은 **'신라 금관: 권력과 위엄' — 104년 만에 신라 금관 6점 한자리 재결합**입니다.",
  replacement: "**2025 경주 APEC 정상회의** 기념 특별전 **'신라 금관: 권력과 위엄'** — 104년 만에 신라 금관 6점 한자리 재결합 (2025년 10월 28일~12월 14일, 종료); 현재 천마총 금관은 상설 신라역사관의 중심 전시품으로 자리합니다.",
});

// JA
SWAPS.push({
  slug: SILLA_SLUG, locale: "ja", label: "Silla-GC-tense-1",
  needle: "**「新羅の金冠」展、2025年12月14日まで開催** — 104年ぶりに6点の金冠が一堂に集結（慶州APEC2025記念）",
  replacement: "**「新羅の金冠」特別展（2025年10月28日〜12月14日、終了）** — 104年ぶりに金冠6点が一堂に集結（慶州APEC2025記念）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "ja", label: "Silla-GC-tense-2",
  needle: "**2025年10月28日〜12月14日の特別展で、新羅の金冠6点が104年ぶりに再集結**（APECサミット記念）",
  replacement: "**2025年10月28日〜12月14日の特別展で、新羅の金冠6点が104年ぶりに再集結**（APECサミット記念、2025年12月14日終了；現在は天馬塚金冠が常設の新羅館を代表する展示品です）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "ja", label: "Silla-GC-tense-3",
  needle: "現在開催中の特別展（**2025慶州APECサミット**を記念し2025年12月14日まで）は**「新羅の金冠——権力と威信」——104年ぶりに新羅の金冠6点すべてを一堂に集結**するものです。",
  replacement: "**2025慶州APECサミット**を記念した特別展**「新羅の金冠——権力と威信」**は104年ぶりに新羅の金冠6点すべてを一堂に集結させました（2025年10月28日〜12月14日、終了）。現在は天馬塚金冠が常設の新羅館を代表する展示品です。",
});

// ZH (simplified)
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh", label: "Silla-GC-tense-1",
  // JSON escapes `\"` in the file; we read raw text so the needle must contain `\\\"`.
  needle: "**\\\"新罗金冠\\\"展览，持续至2025年12月14日**——104年来6顶金冠首度同台（庆州APEC 2025纪念）",
  replacement: "**\\\"新罗金冠\\\"特别展（2025年10月28日至12月14日，已结束）**——104年来6顶金冠首度同台（庆州APEC 2025纪念）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh", label: "Silla-GC-tense-2",
  needle: "**2025年10月28日至12月14日特别展览，104年来首次汇聚6顶新罗金冠**（APEC峰会纪念）",
  replacement: "**2025年10月28日至12月14日特别展览，104年来首次汇聚6顶新罗金冠**（APEC峰会纪念，2025年12月14日已结束；目前天马冢金冠仍为常设新罗馆的核心展品）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh", label: "Silla-GC-tense-3",
  needle: "当前重大特展（展期至**2025年12月14日**，以纪念**2025庆州APEC峰会**）为**《新罗金冠：权力与荣耀》——104年来首次集结全部6顶新罗金冠同台展出**。",
  replacement: "为纪念**2025庆州APEC峰会**举办的特别展**《新罗金冠：权力与荣耀》**——104年来首次集结全部6顶新罗金冠同台展出（2025年10月28日至12月14日，已结束）。目前天马冢金冠仍为常设新罗馆的核心展品。",
});

// ZH-TW (traditional)
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh-TW", label: "Silla-GC-tense-1",
  needle: "**「新羅金冠」展覽至2025年12月14日**——6頂金冠相隔104年首度齊聚一堂（慶州APEC 2025紀念）",
  replacement: "**「新羅金冠」特展（2025年10月28日至12月14日，已結束）**——6頂金冠相隔104年首度齊聚一堂（慶州APEC 2025紀念）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh-TW", label: "Silla-GC-tense-2",
  needle: "**2025年10月28日至12月14日特展，6頂新羅金冠相隔104年首度重聚**（APEC峰會紀念）",
  replacement: "**2025年10月28日至12月14日特展，6頂新羅金冠相隔104年首度重聚**（APEC峰會紀念，2025年12月14日已結束；目前天馬塚金冠仍為常設新羅館的核心展品）",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "zh-TW", label: "Silla-GC-tense-3",
  needle: "目前的重大特展（展期至2025年12月14日，為紀念**2025年慶州APEC峰會**）為**《新羅金冠：權力與榮耀》——時隔104年首度集結全部6頂新羅金冠同台展出**。",
  replacement: "為紀念**2025年慶州APEC峰會**舉辦的特展**《新羅金冠：權力與榮耀》**——時隔104年首度集結全部6頂新羅金冠同台展出（2025年10月28日至12月14日，已結束）。目前天馬塚金冠仍為常設新羅館的核心展品。",
});

// ES
SWAPS.push({
  slug: SILLA_SLUG, locale: "es", label: "Silla-GC-tense-1",
  needle: "**Exposición 'Coronas de Oro Silla' hasta el 14 de dic. de 2025** — las 6 coronas reunidas por primera vez en 104 años (en conmemoración del APEC Gyeongju 2025)",
  replacement: "**Exposición especial 'Coronas de Oro Silla' (28 oct. – 14 dic. de 2025, concluida)** — las 6 coronas reunidas por primera vez en 104 años (en conmemoración del APEC Gyeongju 2025)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "es", label: "Silla-GC-tense-2",
  needle: "**Exposición especial del 28 oct. al 14 dic. de 2025: 6 coronas de oro Silla reunidas por primera vez en 104 años** (conmemoración de la Cumbre APEC)",
  replacement: "**La exposición especial del 28 oct. al 14 dic. de 2025 reunió las 6 coronas de oro Silla por primera vez en 104 años** (conmemoración de la Cumbre APEC; concluyó el 14 de dic. de 2025; actualmente la Corona de Oro de Cheonmachong sigue siendo la pieza central permanente de la Sala Silla)",
});
SWAPS.push({
  slug: SILLA_SLUG, locale: "es", label: "Silla-GC-tense-3",
  needle: "La exposición principal actual (en vigor hasta el 14 de diciembre de 2025 para conmemorar la **Cumbre APEC de Gyeongju 2025**) es **'Coronas de Oro Silla: Poder y Prestigio' — reuniendo las 6 coronas de oro Silla por primera vez en 104 años**.",
  replacement: "La exposición especial **'Coronas de Oro Silla: Poder y Prestigio'**, conmemorativa de la **Cumbre APEC de Gyeongju 2025**, reunió las 6 coronas de oro Silla por primera vez en 104 años (28 oct. – 14 dic. de 2025, concluida); actualmente la Corona de Oro de Cheonmachong sigue siendo la pieza central permanente de la Sala Silla.",
});

// =====================================================================
// EXECUTE
// =====================================================================

console.log(`\n=== Phase locale-residual sweep ===\n`);

const byFile = new Map();
for (const s of SWAPS) {
  const fp = path.join(TOURS_DIR, s.slug, `${s.slug}.${s.locale}.json`);
  if (!byFile.has(fp)) byFile.set(fp, []);
  byFile.get(fp).push(s);
}

let total = 0;
let applied = 0;
const missed = [];

for (const [fp, swaps] of byFile) {
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;
  for (const s of swaps) {
    total++;
    const count = raw.split(s.needle).length - 1;
    if (count === 0) {
      missed.push({ file: path.basename(fp), label: s.label, needle: s.needle.slice(0, 60) });
      continue;
    }
    raw = raw.split(s.needle).join(s.replacement);
    appliedHere += count;
    applied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw); // round-trip verify
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${path.basename(fp)}]  ${appliedHere} swap(s)`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total swap candidates: ${total}`);
console.log(`Applied: ${applied}`);
console.log(`Missed: ${missed.length}`);
for (const m of missed) console.log(`  ${m.file}  [${m.label}]  ${m.needle}...`);
