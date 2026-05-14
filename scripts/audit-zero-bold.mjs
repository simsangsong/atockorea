/** Phase 2B audit — find itineraryStops descriptions with zero **bold** markers,
 *  split by length so we can tell genuine "needs emphasis" copy from short
 *  transit blurbs that legitimately need none. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog")
  .map((d) => d.name);

const long = []; // zero-bold AND > 400 chars — real 2B targets
const short = []; // zero-bold but short — transit blurbs, leave alone
const perLocale = {};
for (const l of LOCALES) perLocale[l] = { zeroBoldLong: 0, zeroBoldShort: 0 };

for (const slug of dirs) {
  for (const loc of LOCALES) {
    const f = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(f)) continue;
    const doc = JSON.parse(readFileSync(f, "utf8"));
    for (const stop of doc.itineraryStops ?? []) {
      const d = stop.description;
      if (typeof d !== "string" || d.trim() === "") continue;
      const boldCount = (d.match(/\*\*[^*]+\*\*/g) || []).length;
      if (boldCount > 0) continue;
      const clean = d.replace(/\n\n/g, " ");
      const entry = { slug, loc, num: stop.number, name: stop.name, len: clean.length, preview: clean.slice(0, 110) };
      if (clean.length > 400) {
        long.push(entry);
        perLocale[loc].zeroBoldLong += 1;
      } else {
        short.push(entry);
        perLocale[loc].zeroBoldShort += 1;
      }
    }
  }
}

console.log("=".repeat(80));
console.log("PHASE 2B AUDIT — zero-bold itinerary descriptions");
console.log("=".repeat(80));
console.log("\nPer locale:  zeroBold-LONG(>400ch, needs emphasis)  /  zeroBold-SHORT(transit, skip)");
for (const l of LOCALES) {
  console.log(`  ${l.padEnd(6)} long=${String(perLocale[l].zeroBoldLong).padStart(3)}   short=${perLocale[l].zeroBoldShort}`);
}
console.log(`\n  TOTAL long (real 2B targets): ${long.length}`);
console.log(`  TOTAL short (leave alone):    ${short.length}`);

console.log("\n" + "-".repeat(80));
console.log("LONG zero-bold descriptions — grouped by tour:");
const byTour = {};
for (const e of long) (byTour[e.slug] ||= []).push(e);
for (const slug of Object.keys(byTour)) {
  const entries = byTour[slug];
  const locs = [...new Set(entries.map((e) => e.loc))].join(",");
  const stopNums = [...new Set(entries.map((e) => e.num))].sort((a, b) => a - b).join(",");
  console.log(`\n  ${slug}`);
  console.log(`    stops #${stopNums}  ·  locales: ${locs}  ·  ${entries.length} descriptions`);
  // one sample per unique stop number
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.num)) continue;
    seen.add(e.num);
    console.log(`    #${e.num} "${(e.name || "").slice(0, 34)}" (${e.len}ch) [${e.loc}] ${e.preview}…`);
  }
}
