#!/usr/bin/env node
/**
 * busan-private-car-charter-cruise-shore — one flat 8-hour rate.
 *
 * Owner instruction 2026-08-07: "기항지 프라이빗은 시간대별로가 아니고 무조건 8시간
 * 38만원으로 고정이 돼야돼, 근사한 달러치로 환산해서 가격 정하고."
 *
 * ₩380,000 ÷ 1,423.48 (live KRW/USD, 2026-08-07) = $266.97 → **$269** per
 * vehicle. 8+ pax is a second vehicle, so 2 × 269 = $538 — the same 1–7 / 8+
 * rule the owner restated for the city charter, and the same shape the Incheon
 * shore charter already sells on (`durations: ["flat"]`, 419 / 838).
 *
 * 🔴 Why the grid was wrong to begin with, not just superseded: every line of
 * copy on this product already described an 8-hour day — the SEO description,
 * the hero meta, the glance row, "the 8-hour service time starts from your
 * confirmed pickup time", "port call too short for a full 8-hour day ashore".
 * Only the rate card offered 5h–9h. Flattening it makes the page agree with
 * itself.
 *
 * "flat" (not "8h") is the duration key on purpose: `formatChargeDuration`
 * renders it as "Flat rate"/"균일가" in each locale, the booking card hides the
 * duration picker when there is one column, and `TourRatesSheet` heads the
 * column "Price". An "8h" key would print a duration toggle with one button.
 *
 * Run: node scripts/busan-private-flat-rate-2026-08.mjs [--check]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "busan-private-car-charter-cruise-shore";
const DIR = path.join(ROOT, "components", "product-tour-static", SLUG);
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

/** ₩380,000 at 1,423.48 KRW/USD = $266.95, rounded to the nearest $5 — the
 *  one conversion rule this batch uses, so any cell can be re-derived. */
export const FLAT_USD = 265;
/** Second vehicle. The tier rule is 1–7 in one car, 8+ in two. */
export const FLAT_USD_TWO_VEHICLES = FLAT_USD * 2;

const PRICING_TIERS = {
  currency: "USD",
  unit: "vehicle",
  durations: ["flat"],
  tiers: [
    { paxLabel: "1–7 pax", paxMin: 1, paxMax: 7, prices: { flat: FLAT_USD } },
    { paxLabel: "8+ pax", paxMin: 8, paxMax: 14, prices: { flat: FLAT_USD_TWO_VEHICLES } },
  ],
};

const PRICE = {
  amountLabel: String(FLAT_USD),
  currency: "USD",
  per: "vehicle",
  salePriceUsd: FLAT_USD,
};

const check = process.argv.includes("--check");
let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${SLUG}.${locale}.json`);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));

  const before = JSON.stringify([doc.price, doc.sticky_booking_bar?.price, doc.pricingTiers]);

  doc.price = { ...doc.price, ...PRICE };
  if (doc.sticky_booking_bar) {
    doc.sticky_booking_bar.price = { ...doc.sticky_booking_bar.price, ...PRICE };
  }
  doc.pricingTiers = PRICING_TIERS;

  const after = JSON.stringify([doc.price, doc.sticky_booking_bar?.price, doc.pricingTiers]);
  if (before === after) {
    console.log(`  ${locale}: already flat`);
    continue;
  }
  changed += 1;
  if (!check) fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`  ${locale}: ${check ? "would rewrite" : "rewritten"} → $${FLAT_USD} flat / $${FLAT_USD_TWO_VEHICLES} for 8+`);
}

console.log(`\n${check ? "would change" : "changed"} ${changed}/${LOCALES.length} locale bundles`);
console.log("DB half: supabase/pending-db-apply/2026-08-07-05-busan-private-flat-8h.sql");
