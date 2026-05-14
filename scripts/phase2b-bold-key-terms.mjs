/**
 * Phase 2B — add `**bold**` emphasis to zero-bold itinerary descriptions.
 *
 * STRICTLY ADDITIVE. The only thing this script writes is the 2-char marker
 * `**` wrapped around substrings that ALREADY EXIST verbatim in the description.
 * It never changes, removes, reorders, or rewrites any other character.
 *
 * Targets only descriptions that (a) currently have ZERO `**` markers and
 * (b) are long enough (>400 visible chars) to benefit — short transit blurbs
 * are left alone.
 *
 * Conservative, language-agnostic emphasis patterns:
 *   · currency amounts            ₩8,000   $39   ₩15,000–25,000
 *   · clock times / hour ranges   09:00   09:00–18:00
 *   · proper noun + native script Sanjeong Lake (산정호수)   仏国寺（불국사）
 *   · measurement figures         3 km   922 m   122,100 m²   770 m   18-ton
 *   · capped at 10 per description so emphasis stays meaningful, not noisy.
 *
 * Three integrity checks (same as Phase 2A):
 *   1. per-description round-trip: stripping `**` must yield the byte-for-byte
 *      original (these descriptions had no `**`, so this is exact).
 *   2. edits confined to the top-level itineraryStops array span.
 *   3. whole-file: re-parse, strip `\n\n` AND `**` from itinerary descriptions,
 *      assert JSON-identical to the original with the same stripping.
 *
 * Usage:
 *   node scripts/phase2b-bold-key-terms.mjs <slug>           # dry-run one tour
 *   node scripts/phase2b-bold-key-terms.mjs <slug> --write
 *   node scripts/phase2b-bold-key-terms.mjs --all
 *   node scripts/phase2b-bold-key-terms.mjs --all --write
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const MIN_LEN = 400;
const MAX_BOLD_PER_DESC = 10;

// Emphasis patterns, highest-priority first. Each match is wrapped in `**…**`.
const PATTERNS = [
  // currency amounts, optionally a range
  /[₩$€¥][\d,]+(?:\s?[–—~-]\s?[₩$€¥]?[\d,]+)?/gu,
  // clock times / hour ranges
  /\b\d{1,2}:\d{2}(?:\s?[–—~-]\s?\d{1,2}:\d{2})?\b/gu,
  // proper noun (Title Case run) + a paren that holds ONLY native script
  // (Hangul/Han/Kana) — this is the "English Name (원어)" gloss, not a
  // descriptive aside like "(retro photo zones)".
  /[A-Z][\p{L}'’.\-]*(?:\s+[A-Z][\p{L}'’.\-]*)*\s*[（(][\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}・･\s'’\d.\-]{1,24}[）)]/gu,
  // measurement / quantity figures with a unit
  /\d[\d,. ]*(?:\s?[×x–—-]\s?\d[\d,. ]*)*\s?(?:km²|m²|㎢|km|ha|kg|m|tons?|t\b|%|분|시간|미터|km\/h|時間|分|キロ|メートル|小時|分鐘|小时|公里|公尺|米)\b/gu,
];

function collectMatches(text) {
  const ranges = [];
  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (end > start) ranges.push([start, end]);
      if (m[0].length === 0) rx.lastIndex += 1; // guard against zero-width
    }
  }
  // sort by start, drop overlaps and repeats — only the first occurrence of
  // each distinct term is emphasized so the bolding stays meaningful.
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const kept = [];
  const seenText = new Set();
  let lastEnd = -1;
  for (const [s, e] of ranges) {
    if (s < lastEnd) continue; // overlaps a kept range
    const slice = text.slice(s, e);
    if (!/[\p{L}\p{N}]/u.test(slice)) continue; // skip pure punctuation/space
    const key = slice.trim().toLowerCase();
    if (seenText.has(key)) continue; // already emphasized this exact term
    seenText.add(key);
    kept.push([s, e]);
    lastEnd = e;
    if (kept.length >= MAX_BOLD_PER_DESC) break;
  }
  return kept;
}

/** Wraps the chosen substrings in `**…**`. Purely additive — built by slicing
 *  the original at match boundaries, so no other character can change. */
function boldKeyTerms(original) {
  const ranges = collectMatches(original);
  if (ranges.length === 0) return original;
  let out = "";
  let prev = 0;
  for (const [s, e] of ranges) {
    out += original.slice(prev, s) + "**" + original.slice(s, e) + "**";
    prev = e;
  }
  out += original.slice(prev);
  return out;
}

function findTopLevelItineraryStopsSpan(raw) {
  const keyMatch = raw.match(/"itineraryStops"\s*:\s*\[/);
  if (!keyMatch) return null;
  const arrOpen = keyMatch.index + keyMatch[0].length - 1;
  let depth = 0;
  let inStr = false;
  for (let i = arrOpen; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (c === "\\") {
        i += 1;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return [arrOpen, i + 1];
    }
  }
  return null;
}

function processFile(file, write) {
  const raw = readFileSync(file, "utf8");
  const doc = JSON.parse(raw);
  const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];

  let newRaw = raw;
  const result = { file, changed: 0, skipped: [], samples: [] };

  const span = findTopLevelItineraryStopsSpan(raw);
  if (!span) throw new Error(`Could not locate top-level itineraryStops array: ${file}`);
  let cursor = span[0];
  let spanEnd = span[1];

  for (const stop of stops) {
    const orig = stop.description;
    if (typeof orig !== "string" || orig.trim() === "") continue;
    const oldJson = JSON.stringify(orig);

    // Only target long, currently-zero-bold descriptions.
    const visibleLen = orig.replace(/\n\n/g, " ").length;
    if (orig.includes("**") || visibleLen <= MIN_LEN) {
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }

    const transformed = boldKeyTerms(orig);
    if (transformed === orig) {
      result.skipped.push(`#${stop.number} no emphasis patterns matched — left as-is`);
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }

    // CHECK 1 — round-trip: stripping `**` must restore the exact original.
    if (transformed.replace(/\*\*/g, "") !== orig) {
      throw new Error(`ROUND-TRIP FAILED: ${file} stop #${stop.number}`);
    }

    // CHECK 2 — surgical raw-text edit within the itineraryStops span.
    const newJson = JSON.stringify(transformed);
    const idx = newRaw.indexOf(oldJson, cursor);
    if (idx === -1 || idx >= spanEnd) {
      result.skipped.push(`#${stop.number} value not found within itineraryStops span — skipped`);
      continue;
    }
    newRaw = newRaw.slice(0, idx) + newJson + newRaw.slice(idx + oldJson.length);
    spanEnd += newJson.length - oldJson.length;
    cursor = idx + newJson.length;
    result.changed += 1;

    const boldCount = (transformed.match(/\*\*[^*]+\*\*/g) || []).length;
    result.samples.push({
      number: stop.number,
      name: stop.name,
      boldCount,
      terms: (transformed.match(/\*\*([^*]+)\*\*/g) || []).map((t) => t.slice(2, -2)),
    });
  }

  // CHECK 3 — whole-file integrity: strip `\n\n` AND `**` from itinerary
  // descriptions in both edited and original; they must be JSON-identical.
  let strippedNew;
  try {
    strippedNew = JSON.parse(newRaw);
  } catch (e) {
    throw new Error(`EDITED FILE IS INVALID JSON: ${file} — ${e.message}`);
  }
  const strippedOld = JSON.parse(raw);
  const strip = (d) => {
    for (const s of d.itineraryStops ?? []) {
      if (typeof s.description === "string") {
        s.description = s.description.replace(/\n\n/g, "").replace(/\*\*/g, "");
      }
    }
  };
  strip(strippedNew);
  strip(strippedOld);
  if (JSON.stringify(strippedNew) !== JSON.stringify(strippedOld)) {
    throw new Error(`STRUCTURE CHANGED beyond ** insertion: ${file} — aborting`);
  }

  if (write && result.changed > 0) writeFileSync(file, newRaw, "utf8");
  return result;
}

// ─── main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const write = args.includes("--write");
const all = args.includes("--all");
const slugArg = args.find((a) => !a.startsWith("--"));

let slugs;
if (all) {
  slugs = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog")
    .map((d) => d.name);
} else if (slugArg) {
  slugs = [slugArg];
} else {
  console.error("Provide a <slug> or --all");
  process.exit(1);
}

console.log("=".repeat(80));
console.log(`Phase 2B — bold key terms  [${write ? "WRITE" : "DRY-RUN"}]  ${slugs.length} tour(s)`);
console.log("=".repeat(80));

let totalChanged = 0;
for (const slug of slugs) {
  let tourChanged = 0;
  const lines = [];
  for (const loc of LOCALES) {
    const file = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(file)) continue;
    const r = processFile(file, write);
    tourChanged += r.changed;
    totalChanged += r.changed;
    if (r.changed > 0 || r.skipped.length > 0) {
      lines.push(`  ${loc.padEnd(6)} bolded=${r.changed}  skipped=${r.skipped.length}`);
      if (slugs.length === 1) {
        for (const sm of r.samples) {
          lines.push(`    #${sm.number} "${(sm.name || "").slice(0, 32)}" → ${sm.boldCount} terms:`);
          lines.push(`       ${sm.terms.map((t) => "「" + t + "」").join("  ")}`);
        }
        for (const s of r.skipped) lines.push(`       · ${s}`);
      }
    }
  }
  if (tourChanged > 0 || lines.length > 0) {
    console.log(`\n### ${slug}`);
    for (const l of lines) console.log(l);
  }
}

console.log("\n" + "-".repeat(80));
console.log(`TOTAL: ${totalChanged} descriptions ${write ? "written" : "would change"}`);
console.log("Integrity checks passed (round-trip · itineraryStops span · whole-file structure).");
if (!write) console.log("DRY-RUN — no files modified.");
