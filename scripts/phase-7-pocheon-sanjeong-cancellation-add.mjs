#!/usr/bin/env node
// Phase 7 — add cancellation policy section to pocheon-sanjeong tour bundle.
//
// The pocheon-sanjeong-lake-herb-island-art-valley tour was missing the
// canonical "cancellation" accordion item that other tours
// (e.g., seoul-suwon-hwaseong-folk-village-starfield-library) carry.
// This adds the same canonical 2-line policy ("Free cancellation up to
// 24 hours before the tour starts. / Same-day cancellations and no-shows
// are non-refundable.") in all 6 locales, appended after the existing
// `included` item.
//
// Only the TOP-LEVEL `practicalAccordionItems` is updated (the legacy
// `page_sections[7].props.practicalAccordionItems` is not rendered
// per `reference_tour_product_render_source` — don't edit for live).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const SLUG = "pocheon-sanjeong-lake-herb-island-art-valley";

const CANCELLATION_BY_LOCALE = {
  en: {
    id: "cancellation",
    title: "Cancellation",
    preview: "Free cancellation up to 24 hours before the tour starts.",
    content: [
      "Free cancellation up to 24 hours before the tour starts.",
      "Same-day cancellations and no-shows are non-refundable.",
    ],
  },
  ko: {
    id: "cancellation",
    title: "취소 규정",
    preview: "투어 시작 24시간 전까지 무료 취소 가능합니다.",
    content: [
      "투어 시작 24시간 전까지 무료 취소 가능합니다.",
      "당일 취소 및 노쇼(no-show)는 환불되지 않습니다.",
    ],
  },
  ja: {
    id: "cancellation",
    title: "キャンセルについて",
    preview: "ツアー開始の24時間前まで無料キャンセル可能です。",
    content: [
      "ツアー開始の24時間前まで無料キャンセル可能です。",
      "当日のキャンセルおよびノーショー（無断不参加）は返金不可です。",
    ],
  },
  zh: {
    id: "cancellation",
    title: "取消政策",
    preview: "行程开始前24小时内可免费取消。",
    content: [
      "行程开始前24小时内可免费取消。",
      "当日取消及未出现者，费用恕不退还。",
    ],
  },
  "zh-TW": {
    id: "cancellation",
    title: "取消政策",
    preview: "行程開始前24小時以上可免費取消。",
    content: [
      "行程開始前24小時以上可免費取消。",
      "當日取消及未出席者恕不退款。",
    ],
  },
  es: {
    id: "cancellation",
    title: "Cancelación",
    preview: "Cancelación gratuita hasta 24 horas antes del inicio del tour.",
    content: [
      "Cancelación gratuita hasta 24 horas antes del inicio del tour.",
      "Las cancelaciones el mismo día y las no presentaciones no son reembolsables.",
    ],
  },
};

console.log(`\n=== Phase 7 pocheon-sanjeong cancellation add ===\n`);

let added = 0;
for (const [locale, item] of Object.entries(CANCELLATION_BY_LOCALE)) {
  const fp = path.join(TOURS_DIR, SLUG, `${SLUG}.${locale}.json`);
  if (!fs.existsSync(fp)) {
    console.log(`[${locale}] file not found, skipping`);
    continue;
  }
  const tour = JSON.parse(fs.readFileSync(fp, "utf8"));
  const arr = tour.practicalAccordionItems;
  if (!Array.isArray(arr)) {
    console.log(`[${locale}] no practicalAccordionItems array, skipping`);
    continue;
  }
  const existing = arr.findIndex((x) => x && x.id === "cancellation");
  if (existing >= 0) {
    console.log(`[${locale}] cancellation already present at index ${existing}, skipping`);
    continue;
  }
  arr.push(item);
  fs.writeFileSync(fp, JSON.stringify(tour, null, 2) + "\n", "utf8");
  added++;
  console.log(`[${locale}] appended cancellation (now ${arr.length} items: ${arr.map((x) => x.id).join(", ")})`);
}

console.log(`\n=== Summary ===`);
console.log(`Added cancellation item to ${added} locale(s)`);
