#!/usr/bin/env node
// Temporal language refresh — "recently" → explicit dates.
//
// Two distinct facts being temporalized:
//   1. Seoraksan National Park entrance fee abolished MAY 2023.
//      Phrasings: "recently abolished", "recent abolition", etc.
//      → harden to "since May 2023" / equivalent in each locale.
//   2. HICO Convention Center hosted 2025 APEC Summit.
//      Phrasings: "recent international milestone".
//      → harden to "2025 international milestone" (the year IS the marker).
//
// Skipped intentionally (state vs time):
//   - "the most recent Jeju coastal NM" — means "newest", still factually true
//   - "less reliable in recent winters" — general temporal context, still accurate
//   - "최근" / "最近的" inside zh meaning "nearest"/"closest" (not temporal)

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const SWAPS = [
  // ═══════ Seoraksan fee — EN ═══════
  ["Park entrance FREE since recent abolition (was 3,500 KRW); cable car still paid",
   "Park entrance FREE since May 2023 (was 3,500 KRW); cable car still paid"],
  ["Park entrance FREE (was 3,500 KRW until recent abolition);",
   "Park entrance FREE (was 3,500 KRW until May 2023 abolition);"],
  ["**Seoraksan National Park entrance — FREE (recently abolished)**.",
   "**Seoraksan National Park entrance — FREE (abolished May 2023)**."],
  ["Seoraksan entrance is FREE (recently abolished).",
   "Seoraksan entrance is FREE (abolished May 2023)."],
  ["**Seoraksan National Park entrance is FREE** (the historical 3,500 KRW fee was recently abolished).",
   "**Seoraksan National Park entrance is FREE** (the historical 3,500 KRW fee was abolished in May 2023)."],
  ["Seoraksan National Park entrance (recently abolished), Naksansa Temple (free since May 2023)",
   "Seoraksan National Park entrance (abolished May 2023), Naksansa Temple (free since May 2023)"],
  ["Seoraksan National Park entrance was recently abolished, Naksansa Temple has been free since May 2023",
   "Seoraksan National Park entrance was abolished in May 2023, Naksansa Temple has been free since May 2023"],
  ["Park entrance — FREE (recently abolished)",
   "Park entrance — FREE (abolished May 2023)"],
  ["(recently abolished)", "(abolished May 2023)"],

  // ═══════ Seoraksan fee — KO ═══════
  ["공원 입장 무료(최근 3,500원 폐지) / 케이블카는 유료 유지",
   "공원 입장 무료(2023년 5월 3,500원 폐지) / 케이블카는 유료 유지"],
  ["공원 입장 무료(최근 3,500원 폐지) / 케이블카 왕복 성인 16,000 / 어린이 12,000원(현장 매표 한정, 사전 예약 불가)",
   "공원 입장 무료(2023년 5월 3,500원 폐지) / 케이블카 왕복 성인 16,000 / 어린이 12,000원(현장 매표 한정, 사전 예약 불가)"],
  ["3,500원의 사찰 입장료가 최근 폐지되면서 무료로 전환되었으며",
   "3,500원의 사찰 입장료가 2023년 5월 폐지되어 무료로 전환되었으며"],
  ["**설악산 국립공원 입장료 — 무료 (최근 폐지됨)**.",
   "**설악산 국립공원 입장료 — 무료 (2023년 5월 폐지)**."],
  ["설악산 입장료는 무료(최근 폐지).",
   "설악산 입장료는 무료(2023년 5월 폐지)."],
  ["기존 3,500원 요금이 최근 폐지됨",
   "기존 3,500원 요금이 2023년 5월 폐지됨"],

  // ═══════ Seoraksan fee — JA ═══════
  ["公園入場料は最近廃止で無料(以前3,500ウォン)、ロープウェイは引き続き有料",
   "公園入場料は2023年5月廃止で無料（以前3,500ウォン）、ロープウェイは引き続き有料"],
  ["3,500ウォンの料金が最近廃止されました",
   "3,500ウォンの料金が2023年5月に廃止されました"],
  ["公園入場無料(以前は3,500ウォン、最近廃止)、ロープウェイ往復 大人16,000 / 子ども12,000ウォン(現地販売のみ、事前予約不可)",
   "公園入場無料（以前は3,500ウォン、2023年5月廃止）、ロープウェイ往復 大人16,000 / 子ども12,000ウォン（現地販売のみ、事前予約不可）"],
  ["**雪岳山（ソラクサン）国立公園入場料 — 無料（最近廃止されました）**。",
   "**雪岳山（ソラクサン）国立公園入場料 — 無料（2023年5月廃止）**。"],
  ["雪嶽山の入場料は無料（最近廃止）。",
   "雪嶽山の入場料は無料（2023年5月廃止）。"],
  ["以前の₩3,500の入場料は最近廃止されました",
   "以前の₩3,500の入場料は2023年5月に廃止されました"],

  // ═══════ Seoraksan fee — ZH ═══════
  ["近年来已废止——现由公共财政拨款维护寺院",
   "已于2023年5月废止 — 现由公共财政拨款维护寺院"],
  ["原3,500韩元费用已于近期取消",
   "原3,500韩元费用已于2023年5月取消"],

  // ═══════ Seoraksan fee — ZH-TW ═══════
  ["3,500 韓元門票已於近期廢除，現由公費維護寺院",
   "3,500 韓元門票已於2023年5月廢除，現由公費維護寺院"],
  ["原₩3,500的入場費已於近期取消",
   "原₩3,500的入場費已於2023年5月取消"],

  // ═══════ Seoraksan fee — ES ═══════
  ["acional Seoraksan — GRATUITA (recientemente abolida)**.",
   "acional Seoraksan — GRATUITA (abolida en mayo de 2023)**."],
  ["Seoraksan — GRATUITA (recientemente abolida)",
   "Seoraksan — GRATUITA (abolida en mayo de 2023)"],
  ["entrada a Seoraksan es GRATUITA (recientemente eliminada).",
   "entrada a Seoraksan es GRATUITA (eliminada en mayo de 2023)."],
  ["histórica tarifa de 3.500 KRW fue abolida recientemente",
   "histórica tarifa de 3.500 KRW fue abolida en mayo de 2023"],

  // ═══════ HICO APEC — EN ═══════
  ["**HICO Convention Center on Bomun Lake hosted the 2025 APEC Summit** — recent international milestone reinforcing Bomun's status as Korea's first comprehensive resort (opened April 6, 1979)",
   "**HICO Convention Center on Bomun Lake hosted the 2025 APEC Summit** — a 2025 international milestone reinforcing Bomun's status as Korea's first comprehensive resort (opened April 6, 1979)"],
  ["**HICO Convention Center on Bomun Lake hosted the 2025 APEC Summit** — recent international milestone reinforcing Bomun's status as Korea's first comprehensive resort",
   "**HICO Convention Center on Bomun Lake hosted the 2025 APEC Summit** — a 2025 international milestone reinforcing Bomun's status as Korea's first comprehensive resort"],

  // ═══════ HICO APEC — KO ═══════
  ["대한민국 최초의 종합 리조트(1979년 4월 6일 개장)로서의 위상을 재확인한 최근의 국제적 이정표",
   "대한민국 최초의 종합 리조트(1979년 4월 6일 개장)로서의 위상을 재확인한 2025년의 국제적 이정표"],

  // ═══════ HICO APEC — JA ═══════
  ["1979年4月6日に開業した韓国初の総合リゾートとしての地位を改めて世界に示した近年の国際的マイルストーン",
   "1979年4月6日に開業した韓国初の総合リゾートとしての地位を改めて世界に示した2025年の国際的マイルストーン"],

  // ═══════ HICO APEC — ZH ═══════
  ["这一近期国际盛事进一步巩固了普门作为韩国首个综合度假村的地位（1979年4月6日开放）",
   "这一2025年国际盛事进一步巩固了普门作为韩国首个综合度假村的地位（1979年4月6日开放）"],

  // ═══════ HICO APEC — ZH-TW ═══════
  ["這一近期國際里程碑，再度彰顯普門作為韓國首座綜合性度假園區的地位（1979年4月6日開幕）",
   "這一2025年國際里程碑，再度彰顯普門作為韓國首座綜合性度假園區的地位（1979年4月6日開幕）"],

  // ═══════ HICO APEC — ES ═══════
  ["**HICO Convention Center on Bomun Lake albergó la Cumbre APEC 2025** — hito internacional reciente que refuerza el estatus de Bomun como el primer complejo turístico integral de Corea (inaugurado el 6 de abril de 1979)",
   "**HICO Convention Center on Bomun Lake albergó la Cumbre APEC 2025** — un hito internacional de 2025 que refuerza el estatus de Bomun como el primer complejo turístico integral de Corea (inaugurado el 6 de abril de 1979)"],
  // Generic ES "hito internacional reciente que refuerza" (busan-plum doesn't say "que refuerza el estatus" — uses "el estatus")
  ["hito internacional reciente que refuerza el estatus de Bomun",
   "hito internacional de 2025 que refuerza el estatus de Bomun"],

  // ═══════ Extra Seoraksan variants (naksansa-temple + national-park-sokcho-beach slugs) ═══════
  // EN
  ["since the recent abolition of the 3,500-KRW fee",
   "since the May 2023 abolition of the 3,500-KRW fee"],
  ["Seoraksan National Park entrance was recently abolished",
   "Seoraksan National Park entrance was abolished in May 2023"],
  // KO
  ["설악산 국립공원 입장료(최근 폐지),",
   "설악산 국립공원 입장료(2023년 5월 폐지),"],
  ["설악산 국립공원 입장료는 최근 폐지되었고",
   "설악산 국립공원 입장료는 2023년 5월 폐지되었고"],
  ["3,500원 요금이 최근 폐지되어",
   "3,500원 요금이 2023년 5월 폐지되어"],
  ["공원 입장료 최근 폐지로 무료(기존 3,500원)",
   "공원 입장료 2023년 5월 폐지로 무료(기존 3,500원)"],
  ["공원 입장료 무료 (최근 폐지 전까지 3,500원)",
   "공원 입장료 무료 (2023년 5월 폐지 전까지 3,500원)"],
  // JA
  ["3,500ウォンの料金が最近廃止され、現在は公費で寺院が維持されている",
   "3,500ウォンの料金が2023年5月に廃止され、現在は公費で寺院が維持されている"],
  ["雪岳山国立公園の入場料（最近廃止）",
   "雪岳山国立公園の入場料（2023年5月廃止）"],
  ["雪岳山国立公園の入場料は最近廃止され",
   "雪岳山国立公園の入場料は2023年5月に廃止され"],
  ["3,500ウォンの入場料が最近廃止され、現在は公共資金で寺院が維持されている",
   "3,500ウォンの入場料が2023年5月に廃止され、現在は公共資金で寺院が維持されている"],
  ["公園入場料無料（最近廃止されるまで3,500ウォン）",
   "公園入場料無料（2023年5月廃止前まで3,500ウォン）"],
  // ZH
  ["雪岳山国家公园入场费已于近期取消",
   "雪岳山国家公园入场费已于2023年5月取消"],
  ["**普门湖畔的HICO会展中心承办了2025年APEC峰会**——这一近期国际里程碑",
   "**普门湖畔的HICO会展中心承办了2025年APEC峰会**——这一2025年国际里程碑"],
  // ZH-TW
  ["公園入場費自近期廢除原代神興寺徵收的3,500韓元門票後",
   "公園入場費自2023年5月廢除原代神興寺徵收的3,500韓元門票後"],
  ["公園入場免費（近期廢除前票價為3,500韓元）",
   "公園入場免費（2023年5月廢除前票價為3,500韓元）"],
  // ES
  ["La entrada al Parque Nacional de Seoraksan (recientemente abolida)",
   "La entrada al Parque Nacional de Seoraksan (abolida en mayo de 2023)"],
  ["La entrada al Parque Nacional Seoraksan fue recientemente abolida",
   "La entrada al Parque Nacional Seoraksan fue abolida en mayo de 2023"],
];

console.log(`\n=== Temporal language refresh ===\n`);
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".json")) files.push(p);
  }
}
walk(TOURS_DIR);

let totalApplied = 0;
let touched = 0;
for (const fp of files) {
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;
  for (const [needle, replacement] of SWAPS) {
    const count = raw.split(needle).length - 1;
    if (count === 0) continue;
    raw = raw.split(needle).join(replacement);
    appliedHere += count;
    totalApplied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw);
    fs.writeFileSync(fp, raw, "utf8");
    touched++;
    console.log(`[${path.relative(TOURS_DIR, fp)}]  ${appliedHere} swap(s)`);
  }
}

console.log(`\n=== ${touched} files / ${totalApplied} swaps ===\n`);

// Residual scan
console.log(`--- Residual scan ---`);
let residuals = 0;
for (const fp of files) {
  const t = fs.readFileSync(fp, "utf8");
  for (const m of t.matchAll(/(recently abolished|recent abolition|최근 폐지|最近廃止|近期取消|近期廢除|recientemente abolid|recientemente elimi|abolida recientemente|recent international milestone|최근의 국제적|近年の国際的|近期国际|近期國際|hito internacional reciente)/g)) {
    residuals++;
    console.log(`  ${path.relative(TOURS_DIR, fp)}: ${m[0]}`);
  }
}
console.log(`\nResidual count: ${residuals}`);
