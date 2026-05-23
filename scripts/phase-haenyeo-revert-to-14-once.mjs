#!/usr/bin/env node
// Haenyeo demo timing — ground truth correction.
//
// User confirmed (2026-05-24): the Haenyeo performance at Seongsan is
// CURRENTLY once daily at 14:00 only. External sites (VisitKorea English
// page etc.) carry stale schedule info claiming 13:30 + 15:00 twice daily.
//
// PR #55 incorrectly applied the stale external info across 56 swaps —
// this script reverts all those + also corrects pre-existing "13:30/15:00"
// references that lived in the data before PR #55 (reasoning notes, some
// description body bullets, FAQ answers).
//
// Scope: every "twice daily / 13:30 / 15:00" claim about Haenyeo demos
// gets normalized to "once daily at 14:00" in 6 locales × 7+ slugs.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// Per-locale needle table. EN needles also act as universal — applied to
// ALL locale files since EN source-citation strings + reasoning notes are
// embedded verbatim across non-EN bundles.
const SWAPS_BY_LOCALE = {
  en: [
    // === Customer-facing highlight reverts (PR #55) ===
    ["**Haenyeo demonstration twice daily at 13:30 and 15:00 (subject to bad-weather cancellation)** at the seaside cove — UNESCO Intangible 2016",
     "**Haenyeo demonstration once daily at 14:00 (subject to bad-weather cancellation)** at the seaside cove — UNESCO Intangible 2016"],
    ["**Haenyeo demonstration twice daily at 13:30 and 15:00 (subject to bad-weather cancellation)** at south coast cove",
     "**Haenyeo demonstration once daily at 14:00 (subject to bad-weather cancellation)** at south coast cove"],
    ["**haenyeo demonstrations run twice daily at 13:30 and 15:00 (2 shows/day) and may be canceled in bad weather** at the seaside cove, subject to weather and local operation.",
     "**haenyeo demonstrations run once daily at 14:00 (1 show/day) and may be canceled in bad weather** at the seaside cove, subject to weather and local operation."],
    ["Optional haenyeo viewing at base (13:30 / 15:00 shows; may be canceled in bad weather) — ~10 min",
     "Optional haenyeo viewing at base (14:00 show; may be canceled in bad weather) — ~10 min"],
    // === Pre-existing EN variants (existed BEFORE PR #55, also wrong) ===
    ["**Haenyeo demonstrations daily 13:30 + 15:00** at the seaside cove — UNESCO Intangible 2016",
     "**Haenyeo demonstration once daily at 14:00** at the seaside cove — UNESCO Intangible 2016"],
    // === Reasoning notes (already had 13:30/15:00 pre-PR-#55) ===
    ["Seongsan haenyeo demonstrations at 13:30/15:00 = UNESCO ICH living display",
     "Seongsan haenyeo demonstration at 14:00 (1 show/day) = UNESCO ICH living display"],
    ["Seongsan haenyeo demonstrations 13:30/15:00 are live UNESCO ICH performance",
     "Seongsan haenyeo demonstration at 14:00 (1 show/day) is the live UNESCO ICH performance"],
    ["Pre-tour note on haenyeo demonstration schedule (13:30 and 15:00 at Seongsan) so you know which timing to target.",
     "Pre-tour note on haenyeo demonstration schedule (14:00 at Seongsan) so you know which timing to target."],
  ],
  ko: [
    // === Customer-facing highlight reverts ===
    ["**해녀 시연은 매일 13:30과 15:00 2회 운영되며, 기상 악화 시 취소될 수 있습니다** (해변 포구에서 진행, 날씨 및 현지 운영 상황에 따라 변동)",
     "**해녀 시연은 매일 14:00 1회 운영되며, 기상 악화 시 취소될 수 있습니다** (해변 포구에서 진행, 날씨 및 현지 운영 상황에 따라 변동)"],
    ["**해녀 시연 매일 2회 13:30 / 15:00 진행 (악천후 시 취소 가능)** 남쪽 해안 작은 만에서",
     "**해녀 시연 매일 1회 14:00 진행 (악천후 시 취소 가능)** 남쪽 해안 작은 만에서"],
    ["선택: 기슭 해녀 시연 관람 (13:30 / 15:00 시연, 기상 악화 시 취소 가능) — 약 10분",
     "선택: 기슭 해녀 시연 관람 (14:00 시연, 기상 악화 시 취소 가능) — 약 10분"],
    ["해안 포구에서 **매일 13:30과 15:00 2회 해녀 시연 (악천후 시 취소)** — 2016년 유네스코 무형문화유산 등재",
     "해안 포구에서 **매일 14:00 1회 해녀 시연 (악천후 시 취소)** — 2016년 유네스코 무형문화유산 등재"],
    ["기슭 해녀 시연 선택 관람 (13:30 / 15:00 공연; 악천후 시 취소 가능) — 약 10분",
     "기슭 해녀 시연 선택 관람 (14:00 공연; 악천후 시 취소 가능) — 약 10분"],
    // === Pre-existing KO variants ===
    ["**해녀 시연 매일 13:30 + 15:00** 바위 해안에서 — 2016년 유네스코 무형문화유산",
     "**해녀 시연 매일 14:00 1회** 바위 해안에서 — 2016년 유네스코 무형문화유산"],
  ],
  ja: [
    // === Customer-facing highlight reverts ===
    ["**海女（ヘニョ）の実演は毎日13:30と15:00の2回開催（悪天候時は中止の場合あり）**、海岸の入り江にて。天候および現地の運営状況により変更となる場合があります。",
     "**海女（ヘニョ）の実演は毎日14:00に1回開催（悪天候時は中止の場合あり）**、海岸の入り江にて。天候および現地の運営状況により変更となる場合があります。"],
    ["**海女による実演は毎日13:30と15:00の2回（悪天候の場合は中止）**、南岸の入り江にて開催",
     "**海女による実演は毎日14:00に1回（悪天候の場合は中止）**、南岸の入り江にて開催"],
    ["麓での海女（ヘニョ）パフォーマンス観覧（13:30 / 15:00 公演、悪天候時は中止の場合あり） — 約10分",
     "麓での海女（ヘニョ）パフォーマンス観覧（14:00公演、悪天候時は中止の場合あり） — 約10分"],
    ["オプション：麓での海女実演見学（1日2回 13:30 / 15:00、悪天候時は中止の可能性あり）——約10分",
     "オプション：麓での海女実演見学（1日1回14:00、悪天候時は中止の可能性あり）——約10分"],
    ["麓での海女実演見学（1日2回 13:30 / 15:00、悪天候時は中止の可能性あり）オプション — 約10分",
     "麓での海女実演見学（1日1回14:00、悪天候時は中止の可能性あり）オプション — 約10分"],
    ["入り江にて**海女の実演は毎日13:30と15:00の2回（悪天候時は中止あり）** — 2016年ユネスコ無形文化遺産",
     "入り江にて**海女の実演は毎日14:00に1回（悪天候時は中止あり）** — 2016年ユネスコ無形文化遺産"],
    ["麓での海女実演観覧（任意）（13:30 / 15:00 開始；悪天候時は中止あり） — 約10分",
     "麓での海女実演観覧（任意）（14:00開始；悪天候時は中止あり） — 約10分"],
    // === Pre-existing JA variants ===
    ["**海女実演は毎日13:30と15:00**、海辺の入り江にて — 2016年ユネスコ無形文化遺産",
     "**海女実演は毎日14:00に1回**、海辺の入り江にて — 2016年ユネスコ無形文化遺産"],
  ],
  zh: [
    ["**海女表演每天13:30和15:00各举行一场（每日2场），恶劣天气可能取消**，地点在海边小湾，视天气及当地运营情况而定。",
     "**海女表演每天14:00举行一场（每日1场），恶劣天气可能取消**，地点在海边小湾，视天气及当地运营情况而定。"],
    ["**海女表演每日13:30和15:00各举行一次（恶劣天气可能取消）**，地点位于南海岸小海湾",
     "**海女表演每日14:00举行一次（恶劣天气可能取消）**，地点位于南海岸小海湾"],
    ["可选：在山脚观看海女表演（13:30 / 15:00 场次；恶劣天气可能取消）— 约10分钟",
     "可选：在山脚观看海女表演（14:00场次；恶劣天气可能取消）— 约10分钟"],
    ["海边小湾**每日13:30和15:00各举行一次海女表演（恶劣天气可能取消）** — 2016年列入联合国教科文组织非物质文化遗产",
     "海边小湾**每日14:00举行一次海女表演（恶劣天气可能取消）** — 2016年列入联合国教科文组织非物质文化遗产"],
    ["可选：山脚观看海女表演（13:30 / 15:00 场次；恶劣天气可能取消）— 约10分钟",
     "可选：山脚观看海女表演（14:00场次；恶劣天气可能取消）— 约10分钟"],
    // === Pre-existing ZH variants ===
    ["**海女表演每日13:30及15:00**在海边礁石湾举行 — 2016年UNESCO非物质文化遗产",
     "**海女表演每日14:00**在海边礁石湾举行 — 2016年UNESCO非物质文化遗产"],
    ["**海女表演每日13:30及15:00** 在海滨小湾举行 — 2016年联合国教科文组织非物质文化遗产",
     "**海女表演每日14:00** 在海滨小湾举行 — 2016年联合国教科文组织非物质文化遗产"],
    ["**每日13:30 + 15:00海女表演** — UNESCO非物质文化遗产2016年",
     "**每日14:00海女表演** — UNESCO非物质文化遗产2016年"],
    ["（通常每天13:30和15:00，视天气而定）",
     "（通常每天14:00，视天气而定）"],
  ],
  "zh-TW": [
    ["**海女表演每日13:30和15:00各舉行一場（每日2場），惡劣天氣可能取消**，地點在海濱小灣，視天氣及當地運營情況而定。",
     "**海女表演每日14:00舉行一場（每日1場），惡劣天氣可能取消**，地點在海濱小灣，視天氣及當地運營情況而定。"],
    ["**海女表演每日兩場，13:30和15:00舉行（惡劣天氣可能取消）**，地點位於南岸海灣",
     "**海女表演每日一場，14:00舉行（惡劣天氣可能取消）**，地點位於南岸海灣"],
    ["可選：在底部觀看海女表演（13:30 / 15:00 場次；惡劣天氣可能取消）— 約10分鐘",
     "可選：在底部觀看海女表演（14:00場次；惡劣天氣可能取消）— 約10分鐘"],
    ["海邊石灣每日13:30和15:00舉行**海女表演兩場（惡劣天氣時可能取消）** — 2016年列入UNESCO非物質文化遺產",
     "海邊石灣每日14:00舉行**海女表演一場（惡劣天氣時可能取消）** — 2016年列入UNESCO非物質文化遺產"],
    ["山腳可選觀看海女表演（13:30 / 15:00 場次；惡劣天氣時可能取消） — 約10分鐘",
     "山腳可選觀看海女表演（14:00場次；惡劣天氣時可能取消） — 約10分鐘"],
    // === Pre-existing ZH-TW variants ===
    ["**海女表演每日13:30及15:00**於海濱礁灣舉行——2016年聯合國教科文組織非物質文化遺產",
     "**海女表演每日14:00**於海濱礁灣舉行——2016年聯合國教科文組織非物質文化遺產"],
    ["**海女表演每日 13:30 及 15:00** 於海邊小灣舉行 — 2016年聯合國教科文組織非物質文化遺產",
     "**海女表演每日 14:00** 於海邊小灣舉行 — 2016年聯合國教科文組織非物質文化遺產"],
  ],
  es: [
    ["**Las demostraciones de haenyeo se realizan dos veces al día a las 13:30 y 15:00 (2 espectáculos/día) y pueden cancelarse por mal tiempo** en la cala junto al mar, sujeto a condiciones meteorológicas y operación local.",
     "**Las demostraciones de haenyeo se realizan una vez al día a las 14:00 (1 espectáculo/día) y pueden cancelarse por mal tiempo** en la cala junto al mar, sujeto a condiciones meteorológicas y operación local."],
    ["Observación opcional de haenyeo en la base (espectáculos a las 13:30 y 15:00; pueden cancelarse por mal tiempo) — ~10 min",
     "Observación opcional de haenyeo en la base (espectáculo a las 14:00; puede cancelarse por mal tiempo) — ~10 min"],
    ["**Demostración de haenyeo dos veces al día a las 13:30 y 15:00 (sujeta a cancelación por mal tiempo)** en la cala junto al mar — Patrimonio Inmaterial UNESCO 2016",
     "**Demostración de haenyeo una vez al día a las 14:00 (sujeta a cancelación por mal tiempo)** en la cala junto al mar — Patrimonio Inmaterial UNESCO 2016"],
    ["Observación opcional de haenyeo en la base (espectáculos a las 13:30 y 15:00; pueden cancelarse con mal tiempo) — ~10 min",
     "Observación opcional de haenyeo en la base (espectáculo a las 14:00; puede cancelarse con mal tiempo) — ~10 min"],
    ["Optional haenyeo viewing at base (13:30 / 15:00 shows, 2 funciones/día; puede cancelarse por mal tiempo) — ~10 min",
     "Optional haenyeo viewing at base (14:00, 1 función/día; puede cancelarse por mal tiempo) — ~10 min"],
    ["**Demostración de haenyeo dos veces al día a las 13:30 y 15:00 (sujeta a cancelación por mal tiempo)** en la cala de la costa sur",
     "**Demostración de haenyeo una vez al día a las 14:00 (sujeta a cancelación por mal tiempo)** en la cala de la costa sur"],
  ],
};

console.log(`\n=== Haenyeo revert to 14:00 1회 ===\n`);
let totalApplied = 0;
let totalAttempted = 0;

const allFiles = [];
const productDir = TOURS_DIR;
for (const slug of fs.readdirSync(productDir)) {
  const slugDir = path.join(productDir, slug);
  if (!fs.statSync(slugDir).isDirectory()) continue;
  for (const f of fs.readdirSync(slugDir)) {
    if (f.endsWith(".json")) allFiles.push(path.join(slugDir, f));
  }
}

for (const fp of allFiles) {
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;

  // Determine locale from filename
  const base = path.basename(fp);
  const m = base.match(/\.([a-zA-Z-]+)\.json$/);
  const locale = m ? m[1] : "en";

  const ownSwaps = SWAPS_BY_LOCALE[locale] || [];
  const enSwaps = locale === "en" ? [] : (SWAPS_BY_LOCALE.en || []);

  for (const [needle, replacement] of [...ownSwaps, ...enSwaps]) {
    totalAttempted++;
    const count = raw.split(needle).length - 1;
    if (count === 0) continue;
    raw = raw.split(needle).join(replacement);
    appliedHere += count;
    totalApplied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw);
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${path.relative(TOURS_DIR, fp)}]  ${appliedHere} swap(s)`);
  }
}

console.log(`\nApplied: ${totalApplied} / Attempted: ${totalAttempted}\n`);

// Tight residual check
console.log(`--- Tight residual check (13:30 or 15:00 within 60 chars of haenyeo/해녀/海女) ---`);
let residuals = 0;
for (const fp of allFiles) {
  const t = fs.readFileSync(fp, "utf8");
  const matches = [...t.matchAll(/(haenyeo|해녀|海女)[^"\n]{0,60}(13:30|15:00)|(13:30|15:00)[^"\n]{0,60}(haenyeo|해녀|海女)/gi)];
  for (const m of matches) {
    residuals++;
    console.log(`  ${path.relative(TOURS_DIR, fp)}: ${m[0].replace(/\s+/g, " ").slice(0, 140)}`);
  }
}
console.log(`\n=== Residual count: ${residuals} ===`);
