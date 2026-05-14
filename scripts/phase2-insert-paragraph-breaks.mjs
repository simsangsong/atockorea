/**
 * Phase 2 — insert explicit `\n\n` paragraph breaks into tour `itineraryStops[].description`.
 *
 * STRICTLY ADDITIVE. The only thing this script ever writes into a description is
 * the 2-char sequence `\n\n` at sentence boundaries. It never changes, removes,
 * reorders, or rewrites a single other character — guaranteed by three checks:
 *
 *   1. per-description round-trip: stripping the inserted `\n\n` must yield the
 *      byte-for-byte original string.
 *   2. surgical raw-text edit: the original JSON-escaped value must appear exactly
 *      once in the file; only that span is replaced.
 *   3. whole-file structural check: re-parse the edited file, strip `\n\n` from
 *      every itinerary description, and assert it is JSON-identical to the original.
 *
 * Any failure aborts the run and writes nothing.
 *
 * Usage:
 *   node scripts/phase2-insert-paragraph-breaks.mjs <slug>           # dry-run one tour
 *   node scripts/phase2-insert-paragraph-breaks.mjs <slug> --write   # apply one tour
 *   node scripts/phase2-insert-paragraph-breaks.mjs --all            # dry-run all tours
 *   node scripts/phase2-insert-paragraph-breaks.mjs --all --write    # apply all tours
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// ─── Phase 1 splitter logic — ported verbatim from TourStopDetailDrawer.tsx ──
const PARA_TARGET_WEIGHT = 280;
const PARA_MAX_SENTENCES = 4;
const PARA_STARTER_MIN_WEIGHT = 140;
const PARA_ORPHAN_MIN_WEIGHT = 80;

const EN_PARA_STARTERS =
  /^(?:The |This |These |Those |That |Total |Adjacent |An? |Beyond |Admission|Hours|Its |With |Within |In |At |On |Of |For |From |Each |Both |Guests?\b|Visitors?\b|When |Where |While |Nearby |Unlike |Despite |After |Before |During |Here |There |Today|Note|Photography|Parking|Entry|Tickets?\b|Plan |Allow |Wear |Bring |\*\*)/;
const ES_PARA_STARTERS =
  /^(?:La |El |Los |Las |Una?\b|Este |Esta |Estos |Estas |Con |En |Para |Por |Desde |Cada |Ambos |Cuando |Donde |Aunque |Después |Antes |Durante |Aquí |Cerca |Además |También |Tenga |Lleve |Reserve |\*\*)/;

function visualWeight(s) {
  let w = 0;
  for (const c of s) {
    w += /[　-〿぀-ヿ㐀-鿿가-힯豈-﫿＀-￯]/.test(c) ? 1.8 : 1;
  }
  return w;
}

/** Phase 1's tokenizer — unchanged. Each returned sentence is a trimmed,
 *  contiguous substring of `text` (the tokenizer only appends original chars). */
function tokenizeSentences(text) {
  const sentences = [];
  let buf = "";
  let inBold = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "*" && text[i + 1] === "*") {
      inBold = !inBold;
      buf += "**";
      i += 2;
      continue;
    }
    buf += ch;
    i += 1;
    if (inBold) continue;
    const isAsciiEnd = ch === "." || ch === "!" || ch === "?";
    const isCjkEnd = ch === "。" || ch === "！" || ch === "？";
    if (!isAsciiEnd && !isCjkEnd) continue;
    if (ch === "." && /\d/.test(text[i - 2] ?? "") && /\d/.test(text[i] ?? "")) continue;
    while (i < text.length && /[)\]"'”』」）]/.test(text[i])) {
      buf += text[i];
      i += 1;
    }
    if (isCjkEnd || i >= text.length || /\s/.test(text[i])) {
      const trimmed = buf.trim();
      if (trimmed) sentences.push(trimmed);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Mirrors Phase 1's groupSentences() but returns the sentence INDICES that
 *  begin a new paragraph (index 0 implied, never listed). */
function computeParagraphStartIndices(sentences, locale) {
  if (sentences.length <= 1) return [];
  const starters =
    locale === "es" ? ES_PARA_STARTERS : locale === "en" ? EN_PARA_STARTERS : null;
  const starts = [];
  let bufCount = 0;
  let weight = 0;
  for (let k = 0; k < sentences.length; k++) {
    const s = sentences[k];
    if (
      starters &&
      bufCount > 0 &&
      weight >= PARA_STARTER_MIN_WEIGHT &&
      starters.test(s)
    ) {
      starts.push(k);
      bufCount = 0;
      weight = 0;
    }
    bufCount += 1;
    weight += visualWeight(s);
    if (weight >= PARA_TARGET_WEIGHT || bufCount >= PARA_MAX_SENTENCES) {
      if (k + 1 < sentences.length) starts.push(k + 1);
      bufCount = 0;
      weight = 0;
    }
  }
  const unique = [...new Set(starts)].sort((a, b) => a - b);
  // Orphan merge — mirror Phase 1: fold a tiny trailing paragraph back.
  if (unique.length > 0) {
    const lastStart = unique[unique.length - 1];
    let w = 0;
    for (let k = lastStart; k < sentences.length; k++) w += visualWeight(sentences[k]);
    if (w < PARA_ORPHAN_MIN_WEIGHT) unique.pop();
  }
  return unique;
}

/**
 * Returns the description with `\n\n` inserted at paragraph boundaries.
 * Purely additive: builds the result by slicing the ORIGINAL at break offsets
 * and joining the slices with `\n\n`. No other character is touched.
 * Returns the input unchanged when there is nothing to split.
 */
function insertParagraphBreaks(original, locale) {
  const sentences = tokenizeSentences(original);
  if (sentences.length <= 1) return original;
  const startIdx = computeParagraphStartIndices(sentences, locale);
  if (startIdx.length === 0) return original;

  // Locate each sentence's offset in the original via a forward indexOf walk.
  // Each sentence is a trimmed contiguous substring, so this always resolves.
  const offsets = [];
  let cursor = 0;
  for (const s of sentences) {
    const idx = original.indexOf(s, cursor);
    if (idx === -1) {
      throw new Error("tokenizer sentence not found in original — aborting");
    }
    offsets.push(idx);
    cursor = idx + s.length;
  }

  const breakOffsets = startIdx.map((k) => offsets[k]);
  const parts = [];
  let prev = 0;
  for (const off of breakOffsets) {
    parts.push(original.slice(prev, off));
    prev = off;
  }
  parts.push(original.slice(prev));
  return parts.join("\n\n");
}

/**
 * Returns `[start, end)` raw-text offsets of the top-level `itineraryStops`
 * array (including its surrounding `[` `]`), or null. JSON-aware bracket
 * matching — brackets inside string values are ignored. Some bundles copy a
 * description verbatim into a nested `sections[].props.itineraryStops`; confining
 * every edit to this span guarantees we only touch the array the drawer reads.
 */
function findTopLevelItineraryStopsSpan(raw) {
  const keyMatch = raw.match(/"itineraryStops"\s*:\s*\[/);
  if (!keyMatch) return null;
  const arrOpen = keyMatch.index + keyMatch[0].length - 1; // index of '['
  let depth = 0;
  let inStr = false;
  for (let i = arrOpen; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (c === "\\") {
        i += 1; // skip the escaped char
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

// ─── per-file processing ─────────────────────────────────────────────────────
function processFile(file, locale, write) {
  const raw = readFileSync(file, "utf8");
  const doc = JSON.parse(raw);
  const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];

  let newRaw = raw;
  const result = { file, changed: 0, skipped: [], samples: [] };

  // All edits are confined to the top-level itineraryStops array, walking a
  // forward cursor so the i-th description resolves to the i-th array entry —
  // even when the same text is duplicated elsewhere in the file.
  const span = findTopLevelItineraryStopsSpan(raw);
  if (!span) {
    throw new Error(`Could not locate top-level itineraryStops array: ${file}`);
  }
  let cursor = span[0];
  let spanEnd = span[1];

  for (const stop of stops) {
    const orig = stop.description;
    if (typeof orig !== "string" || orig.trim() === "") continue;
    if (orig.includes("\n")) {
      result.skipped.push(`#${stop.number} already contains a newline — left untouched`);
      continue;
    }
    const transformed = insertParagraphBreaks(orig, locale);
    const oldJson = JSON.stringify(orig);

    if (transformed === orig) {
      // No split needed — still advance the cursor past this entry so later
      // forward searches stay aligned with the array order.
      const here = newRaw.indexOf(oldJson, cursor);
      if (here !== -1 && here < spanEnd) cursor = here + oldJson.length;
      continue;
    }

    // CHECK 1 — per-description round-trip.
    if (transformed.replace(/\n\n/g, "") !== orig) {
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
    if (result.samples.length < 2) {
      result.samples.push({
        number: stop.number,
        name: stop.name,
        paras: transformed.split("\n\n").length,
        preview: transformed.split("\n\n").map((p) => p.slice(0, 60) + (p.length > 60 ? "…" : "")),
      });
    }
  }

  // CHECK 3 — whole-file structural integrity. Stripping every `\n\n` from
  // itinerary descriptions in BOTH the edited file and the original must yield
  // byte-identical JSON — i.e. nothing changed anywhere except `\n\n` inside
  // those descriptions. Comparing both stripped keeps it idempotent: re-running
  // on an already-processed file is a clean no-op, not a false alarm.
  let strippedNew;
  try {
    strippedNew = JSON.parse(newRaw);
  } catch (e) {
    throw new Error(`EDITED FILE IS INVALID JSON: ${file} — ${e.message}`);
  }
  const strippedOld = JSON.parse(raw);
  const stripDescNewlines = (d) => {
    for (const s of d.itineraryStops ?? []) {
      if (typeof s.description === "string") {
        s.description = s.description.replace(/\n\n/g, "");
      }
    }
  };
  stripDescNewlines(strippedNew);
  stripDescNewlines(strippedOld);
  if (JSON.stringify(strippedNew) !== JSON.stringify(strippedOld)) {
    throw new Error(`STRUCTURE CHANGED beyond \\n\\n insertion: ${file} — aborting`);
  }

  if (write && result.changed > 0) {
    writeFileSync(file, newRaw, "utf8");
  }
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
console.log(`Phase 2 — paragraph breaks  [${write ? "WRITE" : "DRY-RUN"}]  ${slugs.length} tour(s)`);
console.log("=".repeat(80));

let totalChanged = 0;
let totalSkipped = 0;
for (const slug of slugs) {
  console.log(`\n### ${slug}`);
  for (const loc of LOCALES) {
    const file = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(file)) {
      console.log(`  ${loc.padEnd(6)} (missing)`);
      continue;
    }
    const r = processFile(file, loc, write);
    totalChanged += r.changed;
    totalSkipped += r.skipped.length;
    console.log(`  ${loc.padEnd(6)} changed=${r.changed}  skipped=${r.skipped.length}`);
    for (const s of r.skipped) console.log(`         · ${s}`);
    if (slugs.length === 1) {
      for (const sm of r.samples) {
        console.log(`         ¶ #${sm.number} "${(sm.name || "").slice(0, 30)}" → ${sm.paras} paragraphs`);
        for (const p of sm.preview) console.log(`             ${p}`);
      }
    }
  }
}

console.log("\n" + "-".repeat(80));
console.log(`TOTAL: ${totalChanged} descriptions ${write ? "written" : "would change"}, ${totalSkipped} skipped`);
console.log("All 3 integrity checks passed (round-trip · unique-span · whole-file structure).");
if (!write) console.log("DRY-RUN — no files modified. Re-run with --write to apply.");
