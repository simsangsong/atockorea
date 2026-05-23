#!/usr/bin/env node
// i18n key-parity audit
//
// Reads messages/{en,ko,ja,zh,zh-TW,es}.json, flattens to dot-paths,
// and reports per-locale: missing keys vs en.json baseline,
// orphan keys present in non-EN but absent in en.
//
// Grouping: top-level section so we can see which surfaces leak.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MSG_DIR = path.join(ROOT, "messages");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const BASE = "en";

function readLocale(locale) {
  const file = path.join(MSG_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function flatten(obj, prefix = "", out = new Map()) {
  if (obj == null || typeof obj !== "object") {
    out.set(prefix, obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flatten(v, next, out);
  }
  return out;
}

function topSection(dotPath) {
  return dotPath.split(".")[0] ?? "(root)";
}

const flats = Object.fromEntries(
  LOCALES.map((loc) => [loc, flatten(readLocale(loc))])
);

const baseKeys = new Set(flats[BASE].keys());

const report = {};
for (const loc of LOCALES) {
  if (loc === BASE) continue;
  const cur = new Set(flats[loc].keys());
  const missing = [...baseKeys].filter((k) => !cur.has(k));
  const orphan = [...cur].filter((k) => !baseKeys.has(k));
  report[loc] = { missing, orphan, total: cur.size };
}

function groupBySection(keys) {
  const groups = new Map();
  for (const k of keys) {
    const sec = topSection(k);
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec).push(k);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

console.log(`\n=== i18n key-parity audit ===\n`);
console.log(`Baseline: ${BASE}  (${flats[BASE].size} keys)\n`);
for (const loc of LOCALES) {
  if (loc === BASE) {
    console.log(`  ${loc.padEnd(6)} ${flats[loc].size} keys  (baseline)`);
    continue;
  }
  const r = report[loc];
  console.log(
    `  ${loc.padEnd(6)} ${r.total} keys  missing=${r.missing.length}  orphan=${r.orphan.length}`
  );
}

console.log(`\n--- Missing keys per locale (grouped by top-level section) ---`);
for (const loc of LOCALES) {
  if (loc === BASE) continue;
  const r = report[loc];
  if (r.missing.length === 0) {
    console.log(`\n[${loc}]  ✓ 0 missing`);
    continue;
  }
  console.log(`\n[${loc}]  ${r.missing.length} missing`);
  const groups = groupBySection(r.missing);
  for (const [sec, keys] of groups) {
    console.log(`  ${sec.padEnd(28)} ${keys.length}`);
  }
}

console.log(`\n--- Orphan keys (present in non-EN but absent in en) ---`);
for (const loc of LOCALES) {
  if (loc === BASE) continue;
  const r = report[loc];
  if (r.orphan.length === 0) {
    console.log(`\n[${loc}]  ✓ 0 orphan`);
    continue;
  }
  console.log(`\n[${loc}]  ${r.orphan.length} orphan`);
  const groups = groupBySection(r.orphan);
  for (const [sec, keys] of groups) {
    console.log(`  ${sec.padEnd(28)} ${keys.length}`);
    for (const k of keys.slice(0, 10)) console.log(`    - ${k}`);
    if (keys.length > 10) console.log(`    (+${keys.length - 10} more)`);
  }
}

const detailArg = process.argv.find((a) => a.startsWith("--detail="));
if (detailArg) {
  const targetLoc = detailArg.split("=")[1];
  if (!report[targetLoc]) {
    console.error(`\nUnknown locale for --detail: ${targetLoc}`);
    process.exit(2);
  }
  console.log(`\n--- Detailed missing list for [${targetLoc}] ---`);
  for (const k of report[targetLoc].missing) {
    const sample = flats[BASE].get(k);
    const display =
      typeof sample === "string" ? JSON.stringify(sample.slice(0, 80)) : `[${typeof sample}]`;
    console.log(`  ${k}  ← ${display}`);
  }
}

const sumMissing = Object.values(report).reduce(
  (acc, r) => acc + r.missing.length,
  0
);
console.log(`\n=== total missing across non-EN locales: ${sumMissing} ===\n`);

process.exit(sumMissing > 0 ? 1 : 0);
