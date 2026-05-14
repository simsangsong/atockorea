/**
 * One-off audit: attraction-drawer `description` formatting across all tours × locales.
 * Mirrors splitDescriptionToParagraphs() from TourStopDetailDrawer.tsx to find
 * descriptions that collapse into a single un-broken block per locale.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

function splitDescriptionToParagraphs(text) {
  if (!text) return [];
  if (text.includes("\n\n")) {
    return text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  }
  const byStarter = text
    .split(
      /(?<=[\.\!\?])\s+(?=(?:The |This |Total |Adjacent |A[n]? |Beyond |Admission|Hours|Its |With |In |At |On |For |From |Each |Both |Guests?|Visitors?|When |Where |Nearby |Unlike |Despite |After |Before |During |Here |There |\*\*[A-Z]))/g,
    )
    .map((s) => s.trim())
    .filter(Boolean);
  if (byStarter.length > 1) return { method: "starter", parts: byStarter };
  const byBold = text
    .split(/(?<=\.)\s+(?=\*\*|\(\d+\))/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byBold.length > 1) return { method: "bold-led", parts: byBold };
  return { method: "SINGLE-BLOCK", parts: [text] };
}

function boldCount(text) {
  return (text.match(/\*\*[^*]+\*\*/g) || []).length;
}

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog")
  .map((d) => d.name);

const rows = [];
for (const slug of dirs) {
  for (const loc of LOCALES) {
    const f = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(f)) continue;
    let doc;
    try {
      doc = JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      rows.push({ slug, loc, error: String(e).slice(0, 80) });
      continue;
    }
    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    let withDesc = 0;
    let singleBlock = 0;
    let hasExplicitNN = 0;
    let totalBold = 0;
    let zeroBold = 0;
    let longSingleBlock = 0; // single-block AND > 400 chars = definitely a wall of text
    const detail = [];
    for (const s of stops) {
      const d = s.description;
      if (typeof d !== "string" || d.trim() === "") continue;
      withDesc++;
      if (d.includes("\n\n")) hasExplicitNN++;
      const b = boldCount(d);
      totalBold += b;
      if (b === 0) zeroBold++;
      const split = splitDescriptionToParagraphs(d);
      if (split.method === "SINGLE-BLOCK") {
        singleBlock++;
        if (d.length > 400) longSingleBlock++;
        detail.push(`    #${s.number} "${(s.name || "").slice(0, 28)}" len=${d.length} bold=${b} -> SINGLE BLOCK`);
      }
    }
    rows.push({
      slug,
      loc,
      stops: stops.length,
      withDesc,
      singleBlock,
      longSingleBlock,
      hasExplicitNN,
      totalBold,
      zeroBold,
      detail,
    });
  }
}

// Per-tour locale comparison
console.log("=".repeat(90));
console.log("ATTRACTION-DRAWER DESCRIPTION AUDIT");
console.log("=".repeat(90));

const bySlug = {};
for (const r of rows) {
  (bySlug[r.slug] ||= []).push(r);
}

let totSingle = 0;
let totLongSingle = 0;
let totZeroBold = 0;
const localeAgg = {};

for (const slug of Object.keys(bySlug)) {
  console.log(`\n### ${slug}`);
  for (const r of bySlug[slug]) {
    if (r.error) {
      console.log(`  ${r.loc.padEnd(6)} ERROR ${r.error}`);
      continue;
    }
    const flag =
      r.longSingleBlock > 0 ? " <<< WALL-OF-TEXT" : r.singleBlock > 0 ? " <<< under-split" : "";
    console.log(
      `  ${r.loc.padEnd(6)} stops=${String(r.stops).padStart(2)} desc=${String(r.withDesc).padStart(2)}` +
        ` singleBlock=${String(r.singleBlock).padStart(2)} (long=${r.longSingleBlock})` +
        ` explicitNN=${r.hasExplicitNN} bold=${String(r.totalBold).padStart(3)} zeroBold=${r.zeroBold}${flag}`,
    );
    for (const line of r.detail) console.log(line);
    totSingle += r.singleBlock;
    totLongSingle += r.longSingleBlock;
    totZeroBold += r.zeroBold;
    const a = (localeAgg[r.loc] ||= { singleBlock: 0, longSingleBlock: 0, zeroBold: 0, withDesc: 0, explicitNN: 0 });
    a.singleBlock += r.singleBlock;
    a.longSingleBlock += r.longSingleBlock;
    a.zeroBold += r.zeroBold;
    a.withDesc += r.withDesc;
    a.explicitNN += r.hasExplicitNN;
  }
}

console.log("\n" + "=".repeat(90));
console.log("PER-LOCALE TOTALS");
console.log("=".repeat(90));
for (const loc of LOCALES) {
  const a = localeAgg[loc];
  if (!a) continue;
  console.log(
    `  ${loc.padEnd(6)} descriptions=${String(a.withDesc).padStart(3)}` +
      `  single-block=${String(a.singleBlock).padStart(3)}` +
      `  wall-of-text(>400ch)=${String(a.longSingleBlock).padStart(3)}` +
      `  zero-bold=${String(a.zeroBold).padStart(3)}` +
      `  explicit\\n\\n=${a.explicitNN}`,
  );
}
console.log(`\n  GRAND TOTAL: singleBlock=${totSingle} wallOfText=${totLongSingle} zeroBold=${totZeroBold}`);
console.log(`  tours scanned: ${Object.keys(bySlug).length}`);
