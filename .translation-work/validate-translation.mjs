#!/usr/bin/env node
// Usage: node .translation-work/validate-translation.mjs <slug> <locale>
// Exits 0 if valid, 1 if invalid. Prints concise report.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , slug, locale] = process.argv;
if (!slug || !locale) {
  console.error('Usage: node validate-translation.mjs <slug> <locale>');
  process.exit(2);
}

const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
const tgtPath = `components/product-tour-static/${slug}/${slug}.${locale}.json`;

if (!existsSync(enPath)) { console.error(`EN missing: ${enPath}`); process.exit(2); }
if (!existsSync(tgtPath)) { console.error(`Target missing: ${tgtPath}`); process.exit(1); }

let en, tgt;
try { en = JSON.parse(readFileSync(enPath, 'utf-8')); }
catch (e) { console.error(`EN parse error: ${e.message}`); process.exit(2); }
try { tgt = JSON.parse(readFileSync(tgtPath, 'utf-8')); }
catch (e) { console.error(`Target parse error (${locale}): ${e.message}`); process.exit(1); }

// Walk and collect leaf paths + types + values
function walk(node, path, out) {
  if (node === null || node === undefined) {
    out.push({ path, type: 'null', value: null });
    return;
  }
  const t = typeof node;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    out.push({ path, type: t, value: node });
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) out.push({ path, type: 'array', value: [], len: 0 });
    node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  // object
  const keys = Object.keys(node);
  if (keys.length === 0) out.push({ path, type: 'object', value: {}, len: 0 });
  for (const k of keys) walk(node[k], path ? `${path}.${k}` : k, out);
}

const enLeaves = []; walk(en, '', enLeaves);
const tgtLeaves = []; walk(tgt, '', tgtLeaves);

const enMap = new Map(enLeaves.map(l => [l.path, l]));
const tgtMap = new Map(tgtLeaves.map(l => [l.path, l]));

const errors = [];

// Missing/extra paths
for (const p of enMap.keys()) if (!tgtMap.has(p)) errors.push(`MISSING: ${p}`);
for (const p of tgtMap.keys()) if (!enMap.has(p)) errors.push(`EXTRA:   ${p}`);

// Type mismatches
for (const [p, e] of enMap.entries()) {
  const t = tgtMap.get(p);
  if (!t) continue;
  if (e.type !== t.type) errors.push(`TYPE:    ${p} (en=${e.type}, ${locale}=${t.type})`);
}

// locale field check
if (tgt.locale !== locale) errors.push(`LOCALE_FIELD: expected "${locale}", got "${tgt.locale}"`);

// Numeric / boolean values must match exactly
for (const [p, e] of enMap.entries()) {
  const t = tgtMap.get(p);
  if (!t) continue;
  if (e.type === 'number' || e.type === 'boolean' || e.type === 'null') {
    if (e.value !== t.value) errors.push(`VALUE:   ${p} (en=${JSON.stringify(e.value)}, ${locale}=${JSON.stringify(t.value)})`);
  }
}

// String identity-preserve rules
// These string-paths must be byte-identical to EN: URLs, slugs, IDs, image paths, icon names
const PRESERVE_PATTERNS = [
  /\.slug$/,
  /^slug$/,
  /^product_id$/,
  /^document_kind$/,
  /^schema_version$/, // (number anyway)
  /\.priceSource$/,
  /\.ogImage$/,
  /\.imageUrl$/,
  /\.thumbnail$/,
  /\.heroImage$/,
  /\.icon$/,
  /\.id$/,             // subnavItems[].id, etc.
  /\[\d+\]\.id$/,
  /\.currency$/,
  /\.priceMode$/,
];

function shouldPreserveExact(path, value) {
  if (typeof value !== 'string') return false;
  if (PRESERVE_PATTERNS.some(re => re.test(path))) return true;
  if (/^https?:\/\//.test(value)) return true; // any URL
  return false;
}

// Identifier-like values inside arrays like `tags`, etc. — preserve if it looks like an ID
function looksLikeId(s) {
  if (typeof s !== 'string') return false;
  if (s.length === 0) return false;
  // snake_case, kebab-case, lowercase-no-spaces
  return /^[a-z0-9][a-z0-9_-]*$/.test(s);
}

for (const [p, e] of enMap.entries()) {
  const t = tgtMap.get(p);
  if (!t || e.type !== 'string') continue;
  if (shouldPreserveExact(p, e.value)) {
    if (e.value !== t.value) errors.push(`PRESERVE: ${p} (must equal EN, got "${(t.value||'').slice(0,60)}")`);
  } else if (looksLikeId(e.value)) {
    // Identifier-like: target must keep the same identifier
    if (e.value !== t.value) errors.push(`ID_TAG:   ${p} (EN id "${e.value}" must be preserved, got "${(t.value||'').slice(0,60)}")`);
  }
}

// Heuristic: detect untranslated English content
const englishMarker = /\b(the|and|with|from|tour|small group|day tour|cruise|shore|excursion|highlights|itinerary|details|overview|stops|hours|duration|family|private|pickup|drop-off|booking)\b/i;
let suspect = 0;
const suspectSamples = [];
for (const [p, e] of enMap.entries()) {
  const t = tgtMap.get(p);
  if (!t || e.type !== 'string') continue;
  if (shouldPreserveExact(p, e.value) || looksLikeId(e.value)) continue;
  if (e.value.length < 8) continue;
  if (e.value === t.value && englishMarker.test(t.value)) {
    suspect++;
    if (suspectSamples.length < 5) suspectSamples.push(`${p}: "${e.value.slice(0, 80)}"`);
  }
}

const enStrings = enLeaves.filter(l => l.type === 'string').length;
const tgtStrings = tgtLeaves.filter(l => l.type === 'string').length;

if (errors.length) {
  console.error(`FAIL ${slug}.${locale}.json (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const e of errors.slice(0, 30)) console.error(`  ${e}`);
  if (errors.length > 30) console.error(`  ... and ${errors.length - 30} more`);
  if (suspect > 5) {
    console.error(`  WARN: ${suspect} long strings unchanged from EN (possibly untranslated). Samples:`);
    suspectSamples.forEach(s => console.error(`    ${s}`));
  }
  process.exit(1);
}

if (suspect > 10) {
  console.error(`SUSPECT ${slug}.${locale}.json — ${suspect} long strings still match EN exactly. Samples:`);
  suspectSamples.forEach(s => console.error(`  ${s}`));
  console.error(`(${enStrings} strings total in EN, ${tgtStrings} in ${locale})`);
  process.exit(1);
}

console.log(`OK ${slug}.${locale} — ${enStrings} strings, ${enLeaves.length} leaves${suspect ? ` (${suspect} possibly-untranslated, under threshold)` : ''}`);
process.exit(0);
