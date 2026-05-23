#!/usr/bin/env node
// Phase P1 #5 — jeju cruise practicalAccordionItems[id=included] honest rename.
//
// The audit doc flagged that the "What's included" section also contains
// items that are NOT included (lunch own-expense, personal shopping,
// gratuities). The schema actually handles this correctly via
// `variant: "included"` + `includedCount: 5` (renders first 5 as ✓ and
// remaining as ✗), but the section's title + preview don't reflect the
// dual nature, so a customer scanning quickly could miss the ✗ items.
//
// Fix: rename title to be explicit ("Included / Not included") and
// extend preview to mention own-expense items. No structural change —
// the ✓/✗ split rendering is already correct.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const SLUGS = [
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
];

const TITLE = {
  en: "Included / Not included",
  ko: "포함 / 불포함",
  ja: "含まれるもの / 含まれないもの",
  zh: "包含 / 不包含",
  "zh-TW": "包含 / 不包含",
  es: "Incluido / No incluido",
};

const PREVIEW = {
  en: "Guide, vehicle, pickup, admissions — lunch / shopping / tips own expense",
  ko: "가이드, 차량, 픽업, 입장료 — 점심 / 쇼핑 / 팁은 본인 부담",
  ja: "ガイド、車両、送迎、入場料 — 昼食 / 買い物 / チップは自己負担",
  zh: "导游、车辆、接送、门票 — 午餐 / 购物 / 小费自理",
  "zh-TW": "導覽、車輛、接送、門票 — 午餐 / 購物 / 小費自理",
  es: "Guía, vehículo, recogida, entradas — almuerzo / compras / propinas por cuenta del cliente",
};

console.log(`\n=== P1 #5 cruise included honest rewrite ===\n`);
let updated = 0;
for (const slug of SLUGS) {
  for (const locale of ["en", "ko", "ja", "zh", "zh-TW", "es"]) {
    const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
    if (!fs.existsSync(fp)) continue;
    const tour = JSON.parse(fs.readFileSync(fp, "utf8"));
    const item = (tour.practicalAccordionItems || []).find((x) => x?.id === "included");
    if (!item) {
      console.log(`[${slug}.${locale}] no included item, skipping`);
      continue;
    }
    const newTitle = TITLE[locale];
    const newPreview = PREVIEW[locale];
    if (item.title === newTitle && item.preview === newPreview) {
      console.log(`[${slug}.${locale}] already honest, skipping`);
      continue;
    }
    item.title = newTitle;
    item.preview = newPreview;
    // Pin includedCount explicitly so future content additions don't silently
    // shift the ✓/✗ boundary; current data has exactly 5 included items.
    if (item.variant === "included" && item.includedCount == null) {
      item.includedCount = 5;
    }
    fs.writeFileSync(fp, JSON.stringify(tour, null, 2) + "\n", "utf8");
    updated++;
    console.log(`[${slug}.${locale}] title + preview updated (includedCount pinned to 5)`);
  }
}
console.log(`\n=== Summary: ${updated} file(s) updated ===\n`);
