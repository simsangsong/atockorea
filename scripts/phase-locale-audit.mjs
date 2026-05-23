/**
 * Locale propagation discovery — scan all 5 non-EN locale bundles
 * (ko / ja / zh / zh-TW / es) for known-bad patterns that the EN
 * Phase 1a–7 + Z sweeps retired. Output a per-locale offender map
 * so we can decide which patterns need locale-specific scripts vs
 * which were EN-only artifacts to begin with.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "components", "product-tour-static");
const LOCALES = ["ko", "ja", "zh", "zh-TW", "es"];

const SLUGS = readdirSync(ROOT).filter((s) =>
  existsSync(join(ROOT, s, `${s}.en.json`)),
);

// Universal needles (numbers / names / encoding — should be 0 in EVERY locale)
const UNIVERSAL = [
  ["4.9/5 across", "review-aggregate (Phase 1a)"],
  ["4.9/5 rating across", "review-aggregate (Phase 1a)"],
  ["4.8/5 (", "review-aggregate (Phase 1a)"],
  ["4.8/5 rating across", "review-aggregate (Phase 1a)"],
  ["Love Korea Tours", "third-party operator leak (Phase 1a)"],
  ["220m Gamaksan", "DMZ over-claim 220→150 (Phase 7)"],
  ["220 meters", "DMZ over-claim 220→150 (Phase 7)"],
  ["220米", "DMZ over-claim 220→150 (Phase 7, zh)"],
  ["220公尺", "DMZ over-claim 220→150 (Phase 7, zh-TW)"],
  ["220메", "DMZ over-claim 220→150 (Phase 7, ko)"],
  ["220m", "DMZ over-claim possible 220→150 (Phase 7)"],
  ["3 km loop", "Sanjeong trail length 3→4 (Phase 5b)"],
  ["3km loop", "Sanjeong trail length 3→4 (Phase 5b)"],
  ["3 km 環", "Sanjeong trail (zh)"],
  ["3 km 원형", "Sanjeong trail (ko)"],
  ["600 traditional houses", "Bukchon 600→900 (Phase 5b)"],
  ["600 hanok", "Bukchon 600→900 (Phase 5b)"],
  ["600채", "Bukchon 600→900 (Phase 5b, ko)"],
  ["600 軒", "Bukchon (Phase 5b, ja)"],
  ["600 间", "Bukchon (Phase 5b, zh)"],
  ["600 棟", "Bukchon (Phase 5b, zh-TW)"],
  ["world's largest seated bronze", "UNESCO over-claim (Phase 4a)"],
  ["world's oldest Seon", "Sinheungsa over-claim (Phase 4a)"],
  ["only UNESCO Biosphere", "Seoraksan over-claim (Phase 4a)"],
  ["Silla Gold Crowns: Power", "stale exhibition (Phase 7)"],
  ["? photo", "encoding mojibake (Phase 7)"],
  ["Ocean Suites Jeju Hotel", "non-cruise pickup OK; cruise leak (Phase 2a)"], // cruise-only context
];

// Guide first-name leaks — regex with word boundary, but \b doesn't work
// against CJK so do plain substring sweep on each name.
const NAME_NEEDLES = ["Steven", "Chloe", "Jina", "Hays", "Sunny"];

const CRUISE_SLUGS = SLUGS.filter(
  (s) =>
    s.includes("cruise-shore-excursion") ||
    s.endsWith("-cruise-shore-excursion-bus-tour") ||
    s.endsWith("-cruise-shore-excursion-small-group-tour"),
);

const offendersByLocale = {};
const offendersByNeedle = {};

for (const locale of LOCALES) {
  const list = [];
  for (const slug of SLUGS) {
    const path = join(ROOT, slug, `${slug}.${locale}.json`);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");

    for (const [needle, reason] of UNIVERSAL) {
      if (raw.includes(needle)) {
        // Ocean Suites is OK on non-cruise tours
        if (needle === "Ocean Suites Jeju Hotel" && !CRUISE_SLUGS.includes(slug)) continue;
        list.push({ slug, needle, reason });
        offendersByNeedle[needle] = (offendersByNeedle[needle] || 0) + 1;
      }
    }
    for (const name of NAME_NEEDLES) {
      const re = new RegExp(`(^|[^A-Za-z])${name}([^A-Za-z]|$)`);
      if (re.test(raw)) {
        list.push({ slug, needle: name, reason: "guide first-name leak" });
        offendersByNeedle[name] = (offendersByNeedle[name] || 0) + 1;
      }
    }
  }
  offendersByLocale[locale] = list;
  console.log(`\n=== ${locale}: ${list.length} offender${list.length !== 1 ? "s" : ""} ===`);
  if (list.length > 0) {
    const grouped = {};
    for (const o of list) {
      grouped[o.needle] = (grouped[o.needle] || 0) + 1;
    }
    for (const [n, c] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c}× "${n}"`);
    }
  }
}

console.log("\n=== Cross-locale needle ranking ===");
for (const [n, c] of Object.entries(offendersByNeedle).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}× "${n}"`);
}
