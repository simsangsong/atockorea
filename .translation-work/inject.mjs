#!/usr/bin/env node
// Usage: node .translation-work/inject.mjs <slug> <locale>
// Reads:
//   components/product-tour-static/<slug>/<slug>.en.json (structure source)
//   .translation-work/translations/<slug>.<locale>.json (translated string map)
// Writes:
//   components/product-tour-static/<slug>/<slug>.<locale>.json — full file, structure mirrors EN, strings replaced with translations.
// Strings not present in the translation map are copied verbatim from EN (URLs, IDs, identifiers, etc.).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [, , slug, locale] = process.argv;
if (!slug || !locale) { console.error('Usage: node inject.mjs <slug> <locale>'); process.exit(2); }

const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
const transPath = `.translation-work/translations/${slug}.${locale}.json`;
const outPath = `components/product-tour-static/${slug}/${slug}.${locale}.json`;

if (!existsSync(transPath)) {
  console.error(`Translation map missing: ${transPath}`);
  process.exit(1);
}

const en = JSON.parse(readFileSync(enPath, 'utf-8'));
const trans = JSON.parse(readFileSync(transPath, 'utf-8'));

// Validate the translation map: every key should be a path, every value a string.
for (const [k, v] of Object.entries(trans)) {
  if (typeof v !== 'string') {
    console.error(`Invalid translation value at "${k}": expected string, got ${typeof v}`);
    process.exit(1);
  }
}

// Walk EN; at each leaf path, replace the value if the trans map has a translation for it.
function transform(node, path) {
  if (node === null || node === undefined) return node;
  const t = typeof node;
  if (t === 'string') {
    if (Object.prototype.hasOwnProperty.call(trans, path)) {
      return trans[path];
    }
    return node;
  }
  if (t === 'number' || t === 'boolean') return node;
  if (Array.isArray(node)) {
    return node.map((v, i) => transform(v, `${path}[${i}]`));
  }
  const out = {};
  for (const k of Object.keys(node)) {
    out[k] = transform(node[k], path ? `${path}.${k}` : k);
  }
  return out;
}

let result = transform(en, '');

// Force locale field
result = { ...result, locale };

writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');

// Sanity: count how many translations were applied vs available
let applied = 0;
function countApplied(node, path) {
  if (typeof node === 'string') {
    if (Object.prototype.hasOwnProperty.call(trans, path)) applied++;
    return;
  }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v, i) => countApplied(v, `${path}[${i}]`)); return; }
  for (const k of Object.keys(node)) countApplied(node[k], path ? `${path}.${k}` : k);
}
countApplied(en, '');

const total = Object.keys(trans).length;
const missing = Object.keys(trans).filter(k => {
  // Walk EN to check the path exists
  const parts = k.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = en;
  for (const p of parts) {
    if (cur == null) return true;
    cur = cur[p];
  }
  return cur === undefined;
});

if (missing.length) {
  console.error(`WARN: ${missing.length} translation paths not found in EN (extra keys?). First 5: ${missing.slice(0, 5).join(', ')}`);
}

console.log(`Injected ${slug}.${locale} — ${applied}/${total} translations applied → ${outPath}`);
