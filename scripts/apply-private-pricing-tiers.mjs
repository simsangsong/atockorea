/**
 * One-off generator: write engine-derived `pricingTiers` into the static JSON of
 * the vehicle private-charter tour products, so the booking card's existing
 * duration selector (4h–10h) + live price (guest tier × duration) activates and
 * stays consistent with the pricing engine SoT (lib/quote-engine/pricing-policy.ts).
 *
 * Derivation: price(hours, tier) = (ENGLISH_BASE[hours] + paxSurcharge) / 1480,
 * matching pricing-policy.ts ENGLISH_BASE + PAX_TIERS. English guide anchor (the
 * foreign-visitor default); cruise/region/Gangjeong surcharges remain quote-time
 * line items (the card price is an honest "from", precise at the next step).
 *
 * Excluded by design:
 *  - seoul-dmz-private-3rd-tunnel-suspension-bridge — engine track="dmz" is a
 *    FIXED price by pax (no language/duration); the duration×tier matrix would
 *    misprice it. Handled separately.
 *  - seoul-private-nami-morning-calm-petite-france — priced per person, not per
 *    vehicle (user direction: keep per-person).
 *
 * Run: node scripts/apply-private-pricing-tiers.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KRW_PER_USD = 1480;
const ENGLISH_BASE = { 4: 220000, 5: 250000, 6: 280000, 7: 310000, 8: 340000, 9: 370000, 10: 410000 };
const HOURS = [4, 5, 6, 7, 8, 9, 10];
const TIER_DEFS = [
  { paxLabel: "1–6 pax", paxMin: 1, paxMax: 6, surcharge: 0 }, // sedan
  { paxLabel: "7–9 pax", paxMin: 7, paxMax: 9, surcharge: 50000 }, // van
  { paxLabel: "10–13 pax", paxMin: 10, paxMax: 13, surcharge: 150000 }, // solati
];

const usd = (krw) => Math.round(krw / KRW_PER_USD);

const pricingTiers = {
  currency: "USD",
  unit: "vehicle",
  durations: HOURS.map((h) => `${h}h`),
  tiers: TIER_DEFS.map((t) => ({
    paxLabel: t.paxLabel,
    paxMin: t.paxMin,
    paxMax: t.paxMax,
    prices: Object.fromEntries(HOURS.map((h) => [`${h}h`, usd(ENGLISH_BASE[h] + t.surcharge)])),
  })),
};

const SLUGS = [
  "jeju-island-private-car-charter-tour", // add (was missing)
  "seoul-suburbs-private-chartered-car-10hr", // realign
  "busan-private-car-charter-cruise-shore", // realign
  "incheon-seoul-private-car-shore-excursion-cruise", // realign
];
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const ROOT = join(process.cwd(), "components", "product-tour-static");

let changed = 0;
for (const slug of SLUGS) {
  for (const locale of LOCALES) {
    const file = join(ROOT, slug, `${slug}.${locale}.json`);
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      console.warn("SKIP (missing):", file);
      continue;
    }
    const obj = JSON.parse(raw);
    obj.pricingTiers = pricingTiers;
    writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
    changed += 1;
    console.log("wrote", `${slug}.${locale}.json`);
  }
}
console.log(`\nDONE — ${changed} files. durations=${pricingTiers.durations.join("/")}`);
console.log("matrix:", JSON.stringify(pricingTiers.tiers.map((t) => [t.paxLabel, t.prices]), null, 0));
