#!/usr/bin/env node
// Phase 5b residual — Haenyeo demo time normalization across 6 locales × 6 slugs.
//
// VisitKorea official + multiple secondary sources confirm:
//   Twice daily, 13:30–14:30 and 15:00–16:00 (NOT once at 14:00).
//
// The data carries TWO conflicting representations:
//   - Highlights / timeUsed bullets: "once daily at 14:00" (WRONG)
//   - Internal reasoning notes:      "13:30/15:00" (CORRECT, untouched)
//
// This sweep normalizes the WRONG bullets to match the correct timing
// across all 6 slugs × 6 locales without touching the reasoning notes
// or any other content.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const SLUGS = [
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
  "jeju-cherry-blossom-tour-east-route",
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-grand-highlights-loop",
  "east-signature-nature-core",
];

// Per-locale needle table. Each entry: [needle, replacement].
// EN needles also act as "universal" — applied to ALL locale files since EN
// source-citation strings are embedded in non-EN bundles verbatim.
const SWAPS_BY_LOCALE = {
  en: [
    // canonical highlight pattern (most slugs)
    ["**Haenyeo demonstration once daily at 14:00 (subject to bad-weather cancellation)** at the seaside cove — UNESCO Intangible 2016",
     "**Haenyeo demonstration twice daily at 13:30 and 15:00 (subject to bad-weather cancellation)** at the seaside cove — UNESCO Intangible 2016"],
    // jeju-cherry has a doubled "daily" typo we can clean too
    ["**Haenyeo demonstration once daily at 14:00 (subject to bad-weather cancellation) daily** at south coast cove",
     "**Haenyeo demonstration twice daily at 13:30 and 15:00 (subject to bad-weather cancellation)** at south coast cove"],
    // east-signature longer phrasing
    ["**haenyeo demonstrations run once daily at 14:00 (1 show/day) and may be canceled in bad weather** at the seaside cove, subject to weather and local operation.",
     "**haenyeo demonstrations run twice daily at 13:30 and 15:00 (2 shows/day) and may be canceled in bad weather** at the seaside cove, subject to weather and local operation."],
    // timeUsed bullet (5 slugs share this exact phrase)
    ["Optional haenyeo viewing at base (14:00 show; may be canceled in bad weather) — ~10 min",
     "Optional haenyeo viewing at base (13:30 / 15:00 shows; may be canceled in bad weather) — ~10 min"],
  ],
  ko: [
    // east-signature ko long
    ["**해녀 시연은 매일 14:00 1회 운영되며, 기상 악화 시 취소될 수 있습니다** (해변 포구에서 진행, 날씨 및 현지 운영 상황에 따라 변동)",
     "**해녀 시연은 매일 13:30과 15:00 2회 운영되며, 기상 악화 시 취소될 수 있습니다** (해변 포구에서 진행, 날씨 및 현지 운영 상황에 따라 변동)"],
    // jeju-cherry-east ko
    ["**해녀 시연 매일 1회 14:00 진행 (악천후 시 취소 가능)** 남쪽 해안 작은 만에서",
     "**해녀 시연 매일 2회 13:30 / 15:00 진행 (악천후 시 취소 가능)** 남쪽 해안 작은 만에서"],
    // timeUsed ko
    ["선택: 기슭 해녀 시연 관람 (14:00 시연, 기상 악화 시 취소 가능) — 약 10분",
     "선택: 기슭 해녀 시연 관람 (13:30 / 15:00 시연, 기상 악화 시 취소 가능) — 약 10분"],
    // bus-tour ko highlight
    ["해안 포구에서 **매일 14:00 1회 해녀 시연 (악천후 시 취소)** — 2016년 유네스코 무형문화유산 등재",
     "해안 포구에서 **매일 13:30과 15:00 2회 해녀 시연 (악천후 시 취소)** — 2016년 유네스코 무형문화유산 등재"],
    // bus-tour ko timeUsed
    ["기슭 해녀 시연 선택 관람 (14:00 공연; 악천후 시 취소 가능) — 약 10분",
     "기슭 해녀 시연 선택 관람 (13:30 / 15:00 공연; 악천후 시 취소 가능) — 약 10분"],
  ],
  ja: [
    // east-signature ja long
    ["**海女（ヘニョ）の実演は毎日14:00に1回開催（悪天候時は中止の場合あり）**、海岸の入り江にて。天候および現地の運営状況により変更となる場合があります。",
     "**海女（ヘニョ）の実演は毎日13:30と15:00の2回開催（悪天候時は中止の場合あり）**、海岸の入り江にて。天候および現地の運営状況により変更となる場合があります。"],
    // jeju-cherry-east ja
    ["**海女による実演は毎日14:00に1回（悪天候の場合は中止）**、南岸の入り江にて開催",
     "**海女による実演は毎日13:30と15:00の2回（悪天候の場合は中止）**、南岸の入り江にて開催"],
    // timeUsed ja — east-signature variant
    ["麓での海女（ヘニョ）パフォーマンス観覧（14:00公演、悪天候時は中止の場合あり） — 約10分",
     "麓での海女（ヘニョ）パフォーマンス観覧（13:30 / 15:00 公演、悪天候時は中止の場合あり） — 約10分"],
    // timeUsed ja — generic "1日1回14:00" pattern (multiple slugs)
    ["オプション：麓での海女実演見学（1日1回14:00、悪天候時は中止の可能性あり）——約10分",
     "オプション：麓での海女実演見学（1日2回 13:30 / 15:00、悪天候時は中止の可能性あり）——約10分"],
    ["麓での海女実演見学（1日1回14:00、悪天候時は中止の可能性あり）オプション — 約10分",
     "麓での海女実演見学（1日2回 13:30 / 15:00、悪天候時は中止の可能性あり）オプション — 約10分"],
    // bus-tour ja highlight
    ["入り江にて**海女の実演は毎日14:00に1回（悪天候時は中止あり）** — 2016年ユネスコ無形文化遺産",
     "入り江にて**海女の実演は毎日13:30と15:00の2回（悪天候時は中止あり）** — 2016年ユネスコ無形文化遺産"],
    // bus-tour ja timeUsed
    ["麓での海女実演観覧（任意）（14:00開始；悪天候時は中止あり） — 約10分",
     "麓での海女実演観覧（任意）（13:30 / 15:00 開始；悪天候時は中止あり） — 約10分"],
  ],
  zh: [
    // east-signature zh long
    ["**海女表演每天14:00举行一场（每日1场），恶劣天气可能取消**，地点在海边小湾，视天气及当地运营情况而定。",
     "**海女表演每天13:30和15:00各举行一场（每日2场），恶劣天气可能取消**，地点在海边小湾，视天气及当地运营情况而定。"],
    // jeju-cherry-east zh
    ["**海女表演每日14:00举行一次（恶劣天气可能取消）**，地点位于南海岸小海湾",
     "**海女表演每日13:30和15:00各举行一次（恶劣天气可能取消）**，地点位于南海岸小海湾"],
    // timeUsed zh
    ["可选：在山脚观看海女表演（14:00场次；恶劣天气可能取消）— 约10分钟",
     "可选：在山脚观看海女表演（13:30 / 15:00 场次；恶劣天气可能取消）— 约10分钟"],
    // bus-tour zh highlight
    ["海边小湾**每日14:00举行一次海女表演（恶劣天气可能取消）** — 2016年列入联合国教科文组织非物质文化遗产",
     "海边小湾**每日13:30和15:00各举行一次海女表演（恶劣天气可能取消）** — 2016年列入联合国教科文组织非物质文化遗产"],
    // bus-tour zh timeUsed
    ["可选：山脚观看海女表演（14:00场次；恶劣天气可能取消）— 约10分钟",
     "可选：山脚观看海女表演（13:30 / 15:00 场次；恶劣天气可能取消）— 约10分钟"],
  ],
  "zh-TW": [
    // east-signature zh-TW long
    ["**海女表演每日14:00舉行一場（每日1場），惡劣天氣可能取消**，地點在海濱小灣，視天氣及當地運營情況而定。",
     "**海女表演每日13:30和15:00各舉行一場（每日2場），惡劣天氣可能取消**，地點在海濱小灣，視天氣及當地運營情況而定。"],
    // jeju-cherry-east zh-TW
    ["**海女表演每日一場，14:00舉行（惡劣天氣可能取消）**，地點位於南岸海灣",
     "**海女表演每日兩場，13:30和15:00舉行（惡劣天氣可能取消）**，地點位於南岸海灣"],
    // timeUsed zh-TW
    ["可選：在底部觀看海女表演（14:00場次；惡劣天氣可能取消）— 約10分鐘",
     "可選：在底部觀看海女表演（13:30 / 15:00 場次；惡劣天氣可能取消）— 約10分鐘"],
    // bus-tour zh-TW highlight
    ["海邊石灣每日14:00舉行**海女表演一場（惡劣天氣時可能取消）** — 2016年列入UNESCO非物質文化遺產",
     "海邊石灣每日13:30和15:00舉行**海女表演兩場（惡劣天氣時可能取消）** — 2016年列入UNESCO非物質文化遺產"],
    // bus-tour zh-TW timeUsed
    ["山腳可選觀看海女表演（14:00場次；惡劣天氣時可能取消） — 約10分鐘",
     "山腳可選觀看海女表演（13:30 / 15:00 場次；惡劣天氣時可能取消） — 約10分鐘"],
  ],
  es: [
    // east-signature es long
    ["**Las demostraciones de haenyeo se realizan una vez al día a las 14:00 (1 espectáculo/día) y pueden cancelarse por mal tiempo** en la cala junto al mar, sujeto a condiciones meteorológicas y operación local.",
     "**Las demostraciones de haenyeo se realizan dos veces al día a las 13:30 y 15:00 (2 espectáculos/día) y pueden cancelarse por mal tiempo** en la cala junto al mar, sujeto a condiciones meteorológicas y operación local."],
    // timeUsed es
    ["Observación opcional de haenyeo en la base (espectáculo a las 14:00; puede cancelarse por mal tiempo) — ~10 min",
     "Observación opcional de haenyeo en la base (espectáculos a las 13:30 y 15:00; pueden cancelarse por mal tiempo) — ~10 min"],
    // bus-tour es highlight
    ["**demostración de haenyeo una vez al día a las 14:00 (sujeta a cancelación por mal tiempo)** en la cala junto al mar — Patrimonio Inmaterial UNESCO 2016",
     "**demostración de haenyeo dos veces al día a las 13:30 y 15:00 (sujeta a cancelación por mal tiempo)** en la cala junto al mar — Patrimonio Inmaterial UNESCO 2016"],
    // bus-tour es timeUsed
    ["Opcional: observación de haenyeo en la base (espectáculo a las 14:00; puede cancelarse con mal tiempo) — ~10 min",
     "Opcional: observación de haenyeo en la base (espectáculos a las 13:30 y 15:00; pueden cancelarse con mal tiempo) — ~10 min"],
  ],
};

console.log(`\n=== Haenyeo time sweep ===\n`);
let totalApplied = 0;
let totalAttempted = 0;
const missed = [];

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

for (const slug of SLUGS) {
  for (const locale of LOCALES) {
    const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
    if (!fs.existsSync(fp)) continue;
    let raw = fs.readFileSync(fp, "utf8");
    let appliedHere = 0;
    // Apply this locale's needles + EN's needles (EN source citations are
    // embedded verbatim across all 5 non-EN locale files of these slugs).
    const ownSwaps = SWAPS_BY_LOCALE[locale] || [];
    const enSwaps = locale === "en" ? [] : (SWAPS_BY_LOCALE.en || []);
    for (const [needle, replacement] of [...ownSwaps, ...enSwaps]) {
      totalAttempted++;
      const count = raw.split(needle).length - 1;
      if (count === 0) {
        // Not all slugs use all needles — only count as missed if the locale file
        // contains "14:00" (i.e., a stale timing exists somewhere we didn't catch).
        continue;
      }
      raw = raw.split(needle).join(replacement);
      appliedHere += count;
      totalApplied += count;
    }
    if (appliedHere > 0) {
      JSON.parse(raw);
      fs.writeFileSync(fp, raw, "utf8");
      console.log(`[${slug}.${locale}.json]  ${appliedHere} swap(s)`);
    }
    // After-sweep diagnostic: any residual "14:00" near haenyeo/해녀/海女?
    const residual = raw.match(/(haenyeo|해녀|海女)[\s\S]{0,80}14:00|14:00[\s\S]{0,80}(haenyeo|해녀|海女)/gi);
    if (residual) {
      for (const r of residual) missed.push({ file: `${slug}.${locale}`, ctx: r.slice(0, 120) });
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Applied: ${totalApplied}`);
console.log(`Residual 14:00 near haenyeo: ${missed.length}`);
if (missed.length > 0) {
  for (const m of missed.slice(0, 20)) {
    console.log(`  ${m.file}: ${m.ctx.replace(/\s+/g, " ")}`);
  }
}
