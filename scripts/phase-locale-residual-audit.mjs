#!/usr/bin/env node
// Phase locale-residual audit — multi-locale Phase Z.
//
// Scans all 6 locale bundles for known-bad patterns from phases 1a–7
// PLUS recently added Phase 5b / 6 patterns. Reports real offenders
// (excludes context-aware false positives: correction citations,
// unit-area like "220m²", description-body legitimate references).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const SLUGS = fs
  .readdirSync(TOURS_DIR)
  .filter((s) => fs.existsSync(path.join(TOURS_DIR, s, `${s}.en.json`)));

const CRUISE_SLUGS = SLUGS.filter(
  (s) =>
    s.includes("cruise-shore-excursion") ||
    s.endsWith("-cruise-shore-excursion-bus-tour") ||
    s.endsWith("-cruise-shore-excursion-small-group-tour")
);

// Each needle pair: [regex|string, label, optional context-exclude regex].
// If a hit's surrounding text matches the exclude regex, treat as false-positive.
const NEEDLES = [
  // === Universal (any locale) ===
  ["Love Korea Tours", "third-party operator leak"],
  ["? photo", "encoding mojibake (em-dash)"],
  // Silla Gold Crowns exhibition name now appears only in past-tense
  // historical reference (PR #47 rewrite); flag only "running through"/
  // "current major exhibition" style stale claims.
  [/(running through Dec 14, 2025|current major exhibition.*Silla Gold)/i, "stale Silla GC tense claim"],
  ["50M viewers", "Jewel over-claim (Korea pop ~52M)"],
  ["Camellia Hill ₩10,000", "Camellia stale fee"],
  ["Camellia Hill (10,000 KRW)", "Camellia stale fee"],
  ["22 themed gardens", "Morning Calm over-count"],
  ["world's largest seated bronze", "Seoraksan over-claim"],
  ["world's oldest Seon", "Sinheungsa over-claim"],
  ["only UNESCO Biosphere", "Seoraksan over-claim"],
  ["Korea's only walled fortress,", "Hwaseong over-claim trailing-comma form"],

  // === EN-format (English needles often leak into non-EN bundles too) ===
  ["4.9/5 across", "review aggregate"],
  ["4.9/5 rating across", "review aggregate"],
  ["4.8/5 (", "review aggregate"],
  ["4.8/5 rating across", "review aggregate"],
  ["similar local route", "authoring stub"],
  [" tour tour", "duplicated word typo"],
  ["A easy-to-follow", "article typo"],
  ["the our year-round", "doubled-determiner typo"],

  // === DMZ 220m over-claim (with locale variants) ===
  // Exclude false-positives: (a) "220m²" area, (b) correction citations
  // ("일부 운영사 자료에서 220m" / "some operators list 220m / 一部の業者は 220m" etc.)
  [/220\s*m(?!²|2)\b/, "DMZ bridge over-claim 220→150",
    /²|일부 운영사|some operators|some operator sources|operator sources cite|operators cite|fuentes de operadores|operadores citan|algunas fuentes|一部の|some sources|일부 자료|in some sources|마장호수|Majang Lake|Majangho|호수공연장|conflates this bridge|confunde este puente/i],
  [/220\s*meters/, "DMZ bridge over-claim 220→150",
    /correction|note|some sources|operators list|operator sources cite|마장호수|Majang/i],
  [/220\s*米/, "DMZ bridge over-claim 220→150 (zh)",
    /²|一部の業者|一些供应商|有些资料|有些業者|马场湖|馬場湖|호수공연장/i],
  [/220\s*公尺/, "DMZ bridge over-claim 220→150 (zh-TW)",
    /²|有些供應商|有些業者|馬場湖|호수공연장/i],

  // === Bukchon 600→900 ===
  ["600 traditional houses", "Bukchon old count"],
  ["600 hanok", "Bukchon old count"],
  ["600채", "Bukchon old count (ko)"],
  ["600 軒", "Bukchon old count (ja)"],
  ["600 间", "Bukchon old count (zh)"],
  ["600 棟", "Bukchon old count (zh-TW)"],

  // === Sanjeong trail 3→4 km ===
  ["3 km loop", "Sanjeong old length"],
  ["3km loop", "Sanjeong old length"],
];

const NAME_NEEDLES = ["Steven", "Chloe", "Jina", "Hays", "Sunny"];

const CRUISE_ONLY = [
  ["Ocean Suites Jeju Hotel", "non-cruise pickup OK; cruise leak"],
  ["LOTTE City Hotel Jeju", "non-cruise pickup OK; cruise leak"],
  ["Shilla Duty Free", "non-cruise pickup OK; cruise leak"],
];

function findOffenders(raw, needle, excludeRe) {
  if (typeof needle === "string") {
    if (!raw.includes(needle)) return [];
    const out = [];
    let idx = 0;
    while ((idx = raw.indexOf(needle, idx)) !== -1) {
      const ctx = raw.substring(Math.max(0, idx - 80), Math.min(raw.length, idx + 80));
      if (excludeRe && excludeRe.test(ctx)) {
        idx += needle.length;
        continue;
      }
      out.push({ pos: idx, ctx });
      idx += needle.length;
    }
    return out;
  }
  // regex needle
  const re = new RegExp(needle.source, needle.flags.includes("g") ? needle.flags : needle.flags + "g");
  const out = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    const ctx = raw.substring(Math.max(0, m.index - 80), Math.min(raw.length, m.index + 80));
    if (excludeRe && excludeRe.test(ctx)) continue;
    out.push({ pos: m.index, ctx });
  }
  return out;
}

const reportByLocale = {};
const reportByNeedleLabel = {};

for (const locale of LOCALES) {
  const offenders = [];
  for (const slug of SLUGS) {
    const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, "utf8");

    for (const [needle, label, excludeRe] of NEEDLES) {
      const hits = findOffenders(raw, needle, excludeRe);
      for (const h of hits) {
        offenders.push({ slug, label, needle: String(needle), ctx: h.ctx });
        reportByNeedleLabel[label] = (reportByNeedleLabel[label] || 0) + 1;
      }
    }
    for (const name of NAME_NEEDLES) {
      const re = new RegExp(`(^|[^A-Za-z])${name}([^A-Za-z]|$)`);
      if (re.test(raw)) {
        offenders.push({ slug, label: "guide first-name leak", needle: name });
        reportByNeedleLabel[`guide:${name}`] = (reportByNeedleLabel[`guide:${name}`] || 0) + 1;
      }
    }
    for (const [needle, label] of CRUISE_ONLY) {
      if (!CRUISE_SLUGS.includes(slug)) continue;
      if (raw.includes(needle)) {
        offenders.push({ slug, label, needle, ctx: "cruise-only" });
        reportByNeedleLabel[label] = (reportByNeedleLabel[label] || 0) + 1;
      }
    }
  }
  reportByLocale[locale] = offenders;
}

console.log(`\n=== Phase locale-residual audit ===\n`);
let total = 0;
for (const loc of LOCALES) {
  const n = reportByLocale[loc].length;
  total += n;
  console.log(`${loc.padEnd(6)} ${n} offender${n === 1 ? "" : "s"}`);
}
console.log(`\nTotal: ${total} offenders across all 6 locales\n`);

if (total > 0) {
  console.log(`--- Detail per locale ---`);
  for (const loc of LOCALES) {
    const offenders = reportByLocale[loc];
    if (offenders.length === 0) continue;
    console.log(`\n[${loc}]`);
    for (const o of offenders.slice(0, 20)) {
      console.log(`  ${o.slug}  [${o.label}]  needle="${o.needle}"`);
      if (o.ctx && o.ctx !== "cruise-only") {
        const trimmed = o.ctx.replace(/\s+/g, " ").slice(0, 140);
        console.log(`    ctx: ${trimmed}`);
      }
    }
    if (offenders.length > 20) console.log(`  (+${offenders.length - 20} more)`);
  }

  console.log(`\n--- Needle ranking ---`);
  for (const [k, v] of Object.entries(reportByNeedleLabel).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
}

process.exit(total > 0 ? 1 : 0);
