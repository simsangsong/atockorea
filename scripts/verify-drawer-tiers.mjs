/** Spot-check classifyTerm() tier distribution + the 3 residual single-block walls. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// ─── ported verbatim from TourStopDetailDrawer.tsx ──────────────────────────
const RX_PRICE = /[₩$€¥£]\s?[\d,]|[\d,]+\s?(?:USD|KRW|won|원|円|元)\b/i;
const RX_TIME = /\b\d{1,2}:\d{2}\b/;
const RX_METRIC = /\d[\d.,\s/–-]*\s*(?:m²|km²|km|m|ha|hr|hrs|h|min|mins|%|kg|°C|°F|pyeong|평)\b/i;
const RX_CAUTION =
  /\b(?:closed|prohibited|forbidden|not allowed|no entry|advance (?:booking|permission|reservation)|reservation required|booking required|by reservation only)\b|휴무|금지|불가|입장\s*불가|사전\s*(?:예약|허가|신청)|예약\s*필수|定休|休業|禁止|不可|事前\s*(?:予約|許可|申請)|要予約|立入禁止|休息日|關閉|关闭|謝絕|谢绝|禁止|需\s*提前|cerrado|prohibid[oa]|no se permite|reserva previa|se requiere|solo con reserva/i;

function classifyTerm(inner) {
  const t = inner.trim();
  if (RX_PRICE.test(t)) return "price";
  if (RX_CAUTION.test(t)) return "caution";
  if (RX_TIME.test(t)) return "time";
  if (RX_METRIC.test(t)) return "metric";
  return "keyterm";
}
// ────────────────────────────────────────────────────────────────────────────

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog")
  .map((d) => d.name);

const tally = { price: 0, time: 0, metric: 0, caution: 0, keyterm: 0 };
const samples = { price: [], time: [], metric: [], caution: [], keyterm: [] };

for (const slug of dirs) {
  for (const loc of LOCALES) {
    const f = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(f)) continue;
    const doc = JSON.parse(readFileSync(f, "utf8"));
    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    for (const s of stops) {
      if (typeof s.description !== "string") continue;
      for (const m of s.description.matchAll(/\*\*([^*]+)\*\*/g)) {
        const inner = m[1];
        const tier = classifyTerm(inner);
        tally[tier]++;
        if (samples[tier].length < 12 && Math.random() < 0.04) samples[tier].push(`[${loc}] ${inner.slice(0, 40)}`);
      }
    }
  }
}

console.log("=".repeat(70));
console.log("classifyTerm() TIER DISTRIBUTION across all bold terms in real data");
console.log("=".repeat(70));
const total = Object.values(tally).reduce((a, b) => a + b, 0);
for (const tier of ["price", "time", "metric", "caution", "keyterm"]) {
  console.log(`\n  ${tier.toUpperCase()}  —  ${tally[tier]} (${((tally[tier] / total) * 100).toFixed(1)}%)`);
  for (const s of samples[tier]) console.log(`     ${s}`);
}
console.log(`\n  TOTAL bold terms: ${total}`);
