#!/usr/bin/env node
// Phase P1 typo sweep — closes audit-doc P1 #4 remaining 5 typos
// (docs/tour-product-en-post-merge-audit-2026-05-23.md).
//
// All 5 typos are EN-only (the duplicated words / org name conflation
// only appear in English text), except "Visit Korea Korea Foundation"
// which is an English-language source citation duplicated verbatim
// across all 6 locale files of seoul-dmz.
//
// Surgical pure-needle replacements; no surrounding copy touched.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const SWAPS = [
  // "route route option" — 4 instances across 2 jeju-cruise EN files
  {
    slug: "jeju-cruise-shore-excursion-bus-tour",
    locale: "en",
    needle: "we switch the route route option to match",
    replacement: "we switch the route option to match",
    label: "route-route",
  },
  {
    slug: "jeju-cruise-shore-excursion-small-group-tour",
    locale: "en",
    needle: "we switch the route route option to match",
    replacement: "we switch the route option to match",
    label: "route-route",
  },
  // "schedule schedule" — 1 instance jeju-winter EN
  {
    slug: "jeju-winter-southwest-tangerine-snow-camellia-tour",
    locale: "en",
    needle: "hard day-schedule schedule limit",
    replacement: "hard day-schedule limit",
    label: "schedule-schedule",
  },
  // "small-group group dynamics" — 1 instance seoraksan-sokcho EN
  {
    slug: "seoul-seoraksan-national-park-sokcho-beach-day-trip",
    locale: "en",
    needle: "small-group group dynamics",
    replacement: "small-group dynamics",
    label: "small-group-group",
  },
  // "1100 Road road-closure" — 1 instance southwest-hallasan EN
  {
    slug: "southwest-hallasan-osulloc-aewol",
    locale: "en",
    needle: "any 1100 Road road-closure note",
    replacement: "any 1100 Road closure note",
    label: "1100-Road-road",
  },
];

// "Visit Korea Korea Foundation" — 6 locales seoul-dmz
// "Visit Korea" (KTO brand) + "Korea Foundation" (KF, 한국국제교류재단) —
// these are two distinct orgs accidentally concatenated. The actual
// source for the Gloucester Heroes Bridge dedication is the Korea
// Foundation (KF), which publishes the "Cultural Heritage Bridges Series."
// Drop the leading "Visit Korea " token.
for (const locale of ["en", "ko", "ja", "zh", "zh-TW", "es"]) {
  SWAPS.push({
    slug: "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    locale,
    needle: "Visit Korea Korea Foundation Cultural Heritage Bridges Series",
    replacement: "Korea Foundation Cultural Heritage Bridges Series",
    label: "Visit-Korea-Korea",
  });
}

console.log(`\n=== P1 typo sweep ===\n`);
const byFile = new Map();
for (const s of SWAPS) {
  const fp = path.join(TOURS_DIR, s.slug, `${s.slug}.${s.locale}.json`);
  if (!byFile.has(fp)) byFile.set(fp, []);
  byFile.get(fp).push(s);
}

let total = 0, applied = 0;
const missed = [];

for (const [fp, swaps] of byFile) {
  if (!fs.existsSync(fp)) { console.log("missing:", fp); continue; }
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;
  for (const s of swaps) {
    total++;
    const count = raw.split(s.needle).length - 1;
    if (count === 0) {
      missed.push({ file: path.basename(fp), label: s.label, needle: s.needle.slice(0, 60) });
      continue;
    }
    raw = raw.split(s.needle).join(s.replacement);
    appliedHere += count;
    applied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw);
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${path.basename(fp)}]  ${appliedHere} swap(s)`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Attempted: ${total}`);
console.log(`Applied:   ${applied}`);
console.log(`Missed:    ${missed.length}`);
for (const m of missed) console.log(`  ${m.file} [${m.label}] ${m.needle}...`);
