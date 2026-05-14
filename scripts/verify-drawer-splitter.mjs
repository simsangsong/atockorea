/**
 * Verification harness for the Phase-1 locale-aware paragraph splitter.
 * Ports the EXACT logic from TourStopDetailDrawer.tsx and runs it against every
 * real tour description (33 tours x 6 locales) to confirm:
 *   1. Walls of text are eliminated in every locale.
 *   2. CONTENT IS NEVER LOST — the concatenated paragraphs must contain exactly
 *      the same non-whitespace characters as the original description.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "components/product-tour-static";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// ─── ported verbatim from TourStopDetailDrawer.tsx ──────────────────────────
const PARA_TARGET_WEIGHT = 280;
const PARA_MAX_SENTENCES = 4;
const PARA_STARTER_MIN_WEIGHT = 140;
const PARA_ORPHAN_MIN_WEIGHT = 80;

const EN_PARA_STARTERS =
  /^(?:The |This |These |Those |That |Total |Adjacent |An? |Beyond |Admission|Hours|Its |With |Within |In |At |On |Of |For |From |Each |Both |Guests?\b|Visitors?\b|When |Where |While |Nearby |Unlike |Despite |After |Before |During |Here |There |Today|Note|Photography|Parking|Entry|Tickets?\b|Plan |Allow |Wear |Bring |\*\*)/;
const ES_PARA_STARTERS =
  /^(?:La |El |Los |Las |Una?\b|Este |Esta |Estos |Estas |Con |En |Para |Por |Desde |Cada |Ambos |Cuando |Donde |Aunque |Después |Antes |Durante |Aquí |Cerca |Además |También |Tenga |Lleve |Reserve |\*\*)/;

function sentenceJoiner(locale) {
  return locale === "ja" || locale === "zh" || locale === "zh-TW" ? "" : " ";
}

function visualWeight(s) {
  let w = 0;
  for (const c of s) {
    w += /[　-〿぀-ヿ㐀-鿿가-힯豈-﫿＀-￯]/.test(c) ? 1.8 : 1;
  }
  return w;
}

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

function groupSentences(sentences, locale) {
  if (sentences.length <= 1) return sentences;
  const joiner = sentenceJoiner(locale);
  const starters =
    locale === "es" ? ES_PARA_STARTERS : locale === "en" ? EN_PARA_STARTERS : null;

  const paragraphs = [];
  let buf = [];
  let weight = 0;
  for (const sentence of sentences) {
    if (
      starters &&
      buf.length > 0 &&
      weight >= PARA_STARTER_MIN_WEIGHT &&
      starters.test(sentence)
    ) {
      paragraphs.push(buf.join(joiner));
      buf = [];
      weight = 0;
    }
    buf.push(sentence);
    weight += visualWeight(sentence);
    if (weight >= PARA_TARGET_WEIGHT || buf.length >= PARA_MAX_SENTENCES) {
      paragraphs.push(buf.join(joiner));
      buf = [];
      weight = 0;
    }
  }
  if (buf.length) paragraphs.push(buf.join(joiner));

  if (paragraphs.length >= 2) {
    const last = paragraphs[paragraphs.length - 1];
    if (visualWeight(last) < PARA_ORPHAN_MIN_WEIGHT) {
      paragraphs[paragraphs.length - 2] += joiner + last;
      paragraphs.pop();
    }
  }
  return paragraphs;
}

function splitDescriptionToParagraphs(text, locale) {
  if (!text) return [];
  if (text.includes("\n\n")) {
    return text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  }
  const sentences = tokenizeSentences(text);
  if (sentences.length <= 1) return [text];
  return groupSentences(sentences, locale);
}
// ─── end ported logic ───────────────────────────────────────────────────────

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog")
  .map((d) => d.name);

const agg = {};
for (const l of LOCALES) agg[l] = { desc: 0, paras: 0, singleBlock: 0, wall: 0, contentLoss: 0 };
const lossSamples = [];
let totalDesc = 0;

for (const slug of dirs) {
  for (const loc of LOCALES) {
    const f = join(ROOT, slug, `${slug}.${loc}.json`);
    if (!existsSync(f)) continue;
    const doc = JSON.parse(readFileSync(f, "utf8"));
    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    for (const s of stops) {
      const d = s.description;
      if (typeof d !== "string" || d.trim() === "") continue;
      totalDesc++;
      agg[loc].desc++;
      const paras = splitDescriptionToParagraphs(d, loc);
      agg[loc].paras += paras.length;
      if (paras.length === 1) {
        agg[loc].singleBlock++;
        if (d.length > 400) agg[loc].wall++;
      }
      // CONTENT PRESERVATION: non-whitespace chars must be identical.
      const origCompact = d.replace(/\s+/g, "");
      const splitCompact = paras.join("").replace(/\s+/g, "");
      if (origCompact !== splitCompact) {
        agg[loc].contentLoss++;
        if (lossSamples.length < 8) {
          lossSamples.push({
            slug,
            loc,
            stop: s.number,
            origLen: origCompact.length,
            splitLen: splitCompact.length,
          });
        }
      }
    }
  }
}

console.log("=".repeat(78));
console.log("PHASE-1 SPLITTER VERIFICATION  (new locale-aware logic vs real data)");
console.log("=".repeat(78));
console.log("Baseline single-block counts (pre-change audit): en14 ko62 ja200 zh200 zh-TW200 es87\n");
console.log("locale  desc  avg¶/desc  single-block  wall(>400ch)  CONTENT-LOSS");
for (const loc of LOCALES) {
  const a = agg[loc];
  console.log(
    `  ${loc.padEnd(6)}${String(a.desc).padStart(4)}` +
      `${(a.paras / a.desc).toFixed(2).padStart(11)}` +
      `${String(a.singleBlock).padStart(14)}` +
      `${String(a.wall).padStart(14)}` +
      `${String(a.contentLoss).padStart(14)}`,
  );
}
const totalLoss = LOCALES.reduce((n, l) => n + agg[l].contentLoss, 0);
const totalWall = LOCALES.reduce((n, l) => n + agg[l].wall, 0);
console.log("\n" + "-".repeat(78));
console.log(`TOTAL descriptions: ${totalDesc}`);
console.log(`TOTAL walls-of-text remaining: ${totalWall}   (was 561)`);
console.log(`TOTAL CONTENT-LOSS failures: ${totalLoss}   <<< MUST BE 0`);
if (lossSamples.length) {
  console.log("\nContent-loss samples:");
  for (const s of lossSamples) console.log(`  ${s.slug} [${s.loc}] stop#${s.stop}  orig=${s.origLen} split=${s.splitLen}`);
}
console.log(totalLoss === 0 ? "\n✅ CONTENT PRESERVED — zero data loss in render path." : "\n❌ CONTENT LOSS DETECTED");
