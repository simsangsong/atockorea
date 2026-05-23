#!/usr/bin/env node
// Phase loc-C — key-parity fix across ja/zh/zh-TW/es (+ 13 ko gaps).
//
// 1. Reads each non-EN locale file.
// 2. Deletes orphan keys (present in locale but absent in en.json).
// 3. For each missing path in the translation table, writes the per-locale
//    translated value via property-path mutation.
// 4. JSON round-trips per file before write.
// 5. Per-file delta counter.

import fs from "node:fs";
import path from "node:path";
import T, { ORPHANS_TO_DELETE } from "./i18n-loc-c-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MSG_DIR = path.join(ROOT, "messages");

function read(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(MSG_DIR, `${locale}.json`), "utf8")
  );
}
function write(locale, obj) {
  fs.writeFileSync(
    path.join(MSG_DIR, `${locale}.json`),
    JSON.stringify(obj, null, 2) + "\n",
    "utf8"
  );
}

function setPath(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      // overwrite if leaf-string (e.g. mypage.dashboard was "ダッシュボード") or array
      cur[k] = {};
    }
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(obj, dotPath) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") return false;
    cur = cur[parts[i]];
  }
  const leaf = parts[parts.length - 1];
  if (leaf in cur) {
    delete cur[leaf];
    return true;
  }
  return false;
}

function flatten(o, p = "", out = new Map()) {
  if (o == null || typeof o !== "object") {
    out.set(p, o);
    return out;
  }
  if (Array.isArray(o)) {
    o.forEach((v, i) => flatten(v, `${p}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(o)) flatten(v, p ? `${p}.${k}` : k, out);
  return out;
}

const en = read("en");
const enKeys = new Set(flatten(en).keys());

const LOCALES = ["ko", "ja", "zh", "zh-TW", "es"];

console.log(`\n=== Phase loc-C key-parity fix ===\n`);

const summary = [];

for (const locale of LOCALES) {
  const obj = read(locale);
  const beforeKeys = new Set(flatten(obj).keys());
  const beforeSize = beforeKeys.size;

  // 1) Delete orphans
  const orphans = ORPHANS_TO_DELETE[locale] || [];
  let deleted = 0;
  for (const path of orphans) {
    if (deletePath(obj, path)) deleted++;
  }

  // 2) Apply missing translations
  const missing = [...enKeys].filter((k) => !beforeKeys.has(k));
  let added = 0;
  const skipped = [];
  for (const dotPath of missing) {
    const entry = T[dotPath];
    if (!entry) {
      skipped.push(dotPath);
      continue;
    }
    const val = entry[locale];
    if (val == null) {
      skipped.push(dotPath);
      continue;
    }
    setPath(obj, dotPath, val);
    added++;
  }

  // 3) Verify JSON round-trip
  const roundTripped = JSON.parse(JSON.stringify(obj));
  const afterKeys = new Set(flatten(roundTripped).keys());

  // 4) Write
  write(locale, roundTripped);

  const delta = afterKeys.size - beforeSize;
  summary.push({
    locale,
    before: beforeSize,
    after: afterKeys.size,
    delta,
    deleted,
    added,
    skipped,
  });

  console.log(
    `[${locale}]  ${beforeSize} → ${afterKeys.size}  (Δ${delta > 0 ? "+" : ""}${delta})  added=${added}  deleted=${deleted}  skipped=${skipped.length}`
  );
  if (skipped.length > 0) {
    console.log(`  ⚠ missing translation table entries:`);
    for (const k of skipped.slice(0, 10)) console.log(`    - ${k}`);
    if (skipped.length > 10) console.log(`    (+${skipped.length - 10} more)`);
  }
}

console.log(`\n=== Done ===`);
console.log(`Run \`node scripts/i18n-key-parity-audit.mjs\` to verify 0 missing.`);

const anyMissing = summary.some((s) => s.skipped.length > 0);
process.exit(anyMissing ? 1 : 0);
