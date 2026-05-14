/**
 * Phase 2B applier — wraps hand-picked key terms in `**…**` inside zero-bold
 * itinerary descriptions, driven by `scripts/phase2b-spec.json`.
 *
 * STRICTLY ADDITIVE. The only thing written is the `**` marker around substrings
 * that ALREADY EXIST verbatim in the description. Editorial judgment (which terms)
 * lives in the spec file; this script only applies it safely.
 *
 * Spec shape:
 *   { "<slug>": { "<stopNumber>": { "<locale>": ["exact substring", ...] } } }
 *
 * Safety:
 *   · idempotent — a description that already contains `**` is left untouched.
 *   · every spec term must appear verbatim, exactly once, outside any other term;
 *     a term that is missing or ambiguous is reported and skipped (never guessed).
 *   · per-description round-trip: stripping `**` restores the byte-for-byte original.
 *   · edits confined to the top-level itineraryStops array span.
 *   · whole-file: strip `\n\n` and `**` from itinerary descriptions of edited and
 *     original; assert JSON-identical.
 *
 * Usage:
 *   node scripts/phase2b-apply-bold.mjs              # dry-run everything in the spec
 *   node scripts/phase2b-apply-bold.mjs --write      # apply
 *   node scripts/phase2b-apply-bold.mjs <slug>       # dry-run one tour
 *   node scripts/phase2b-apply-bold.mjs <slug> --write
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const SPEC_PATH = "scripts/phase2b-spec.json";

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

/**
 * Wraps each spec term in `**…**` at its first verbatim, non-overlapping
 * occurrence. Returns { text, applied, problems }.
 */
function applyBoldTerms(original, terms) {
  const ranges = [];
  const problems = [];
  for (const term of terms) {
    if (typeof term !== "string" || term.length === 0) {
      problems.push(`empty term`);
      continue;
    }
    // first occurrence not already overlapping a chosen range
    let from = 0;
    let placed = false;
    while (from <= original.length) {
      const idx = original.indexOf(term, from);
      if (idx === -1) break;
      const end = idx + term.length;
      const overlaps = ranges.some(([s, e]) => idx < e && end > s);
      if (!overlaps) {
        ranges.push([idx, end]);
        placed = true;
        break;
      }
      from = idx + 1;
    }
    if (!placed) {
      problems.push(`term not found (or only overlapping): ${JSON.stringify(term.slice(0, 50))}`);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let text = "";
  let prev = 0;
  for (const [s, e] of ranges) {
    text += original.slice(prev, s) + "**" + original.slice(s, e) + "**";
    prev = e;
  }
  text += original.slice(prev);
  return { text, applied: ranges.length, problems };
}

function processFile(slug, locale, stopSpec, write) {
  const file = join(ROOT, slug, `${slug}.${locale}.json`);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const doc = JSON.parse(raw);
  const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];

  let newRaw = raw;
  const span = findTopLevelItineraryStopsSpan(raw);
  if (!span) throw new Error(`Could not locate top-level itineraryStops array: ${file}`);
  let cursor = span[0];
  let spanEnd = span[1];

  const report = { file, changed: 0, problems: [] };

  for (const stop of stops) {
    const terms = stopSpec[String(stop.number)]?.[locale];
    const orig = stop.description;
    if (typeof orig !== "string") continue;
    const oldJson = JSON.stringify(orig);

    if (!Array.isArray(terms) || terms.length === 0) {
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }
    if (orig.includes("**")) {
      report.problems.push(`#${stop.number} already has ** — left untouched (idempotent skip)`);
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }

    const { text: transformed, applied, problems } = applyBoldTerms(orig, terms);
    for (const p of problems) report.problems.push(`#${stop.number} [${locale}] ${p}`);
    if (transformed === orig) {
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }

    // CHECK 1 — round-trip.
    if (transformed.replace(/\*\*/g, "") !== orig) {
      throw new Error(`ROUND-TRIP FAILED: ${file} stop #${stop.number}`);
    }

    // CHECK 2 — surgical raw edit within the itineraryStops span.
    const newJson = JSON.stringify(transformed);
    const idx = newRaw.indexOf(oldJson, cursor);
    if (idx === -1 || idx >= spanEnd) {
      report.problems.push(`#${stop.number} value not found within itineraryStops span — skipped`);
      continue;
    }
    newRaw = newRaw.slice(0, idx) + newJson + newRaw.slice(idx + oldJson.length);
    spanEnd += newJson.length - oldJson.length;
    cursor = idx + newJson.length;
    report.changed += 1;
    report.lastApplied = { stop: stop.number, applied, terms };
  }

  // CHECK 3 — whole-file integrity.
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

  if (write && report.changed > 0) writeFileSync(file, newRaw, "utf8");
  return report;
}

// ─── main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const write = args.includes("--write");
const slugArg = args.find((a) => !a.startsWith("--"));

if (!existsSync(SPEC_PATH)) {
  console.error(`Spec file not found: ${SPEC_PATH}`);
  process.exit(1);
}
const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const slugs = slugArg ? [slugArg] : Object.keys(spec);

console.log("=".repeat(80));
console.log(`Phase 2B apply  [${write ? "WRITE" : "DRY-RUN"}]  ${slugs.length} tour(s) from spec`);
console.log("=".repeat(80));

let totalChanged = 0;
let totalProblems = 0;
for (const slug of slugs) {
  const stopSpec = spec[slug];
  if (!stopSpec) {
    console.log(`\n### ${slug}  (not in spec — skipped)`);
    continue;
  }
  console.log(`\n### ${slug}`);
  for (const loc of LOCALES) {
    const r = processFile(slug, loc, stopSpec, write);
    if (!r) continue;
    totalChanged += r.changed;
    totalProblems += r.problems.length;
    const flag = r.problems.length ? `  ⚠ ${r.problems.length} problem(s)` : "";
    console.log(`  ${loc.padEnd(6)} bolded=${r.changed}${flag}`);
    for (const p of r.problems) console.log(`         · ${p}`);
  }
}

console.log("\n" + "-".repeat(80));
console.log(`TOTAL: ${totalChanged} descriptions ${write ? "written" : "would change"}, ${totalProblems} problem(s)`);
console.log("Integrity checks passed (round-trip · itineraryStops span · whole-file structure).");
if (totalProblems > 0) console.log("⚠ Resolve problems in the spec (terms must match verbatim) before --write.");
if (!write) console.log("DRY-RUN — no files modified.");
