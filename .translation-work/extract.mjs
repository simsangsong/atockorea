#!/usr/bin/env node
// Usage: node .translation-work/extract.mjs <slug>
// Reads components/product-tour-static/<slug>/<slug>.en.json
// Writes .translation-work/extracts/<slug>.strings.json — a flat { "path": "english string" } map of TRANSLATABLE strings only.
// Identifiers, URLs, slugs, icon names, etc. are excluded so the inject step copies them verbatim from EN.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const slug = process.argv[2];
if (!slug) { console.error('Usage: node extract.mjs <slug>'); process.exit(2); }

const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
const outPath = `.translation-work/extracts/${slug}.strings.json`;

const en = JSON.parse(readFileSync(enPath, 'utf-8'));

// Path prefixes/patterns to SKIP entirely (internal metadata — not translated)
const SKIP_PATTERNS = [
  /^audit_summary/,
  /^_publication/,
  /^matching_metadata\./,
  /^sourcing/,
  /^reviews_attribution/,
  /^external_source/,
  /\._poi_meta\./,
  /\._score_audit/,
  /\._methodology/,
  /^_internal/,
];

function isSkippedPath(path) {
  return SKIP_PATTERNS.some(re => re.test(path));
}

// Paths whose string value must be preserved exactly (NOT translated)
const PRESERVE_PATTERNS = [
  /^slug$/,
  /\.slug$/,
  /^product_id$/,
  /^document_kind$/,
  /^locale$/,            // we set this manually in inject
  /\.priceSource$/,
  /\.ogImage$/,
  /\.imageUrl$/,
  /\.thumbnail$/,
  /\.heroImage$/,
  /\.icon$/,
  /^icon$/,
  /\.id$/,
  /^id$/,
  /\.currency$/,
  /\.priceMode$/,
  /\.imagePosition$/,    // CSS-like value, e.g. "center 35%"
];

function isPreservedPath(path) {
  return PRESERVE_PATTERNS.some(re => re.test(path));
}

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//.test(s);
}

function isIdentifier(s) {
  // snake_case, kebab-case, all-lowercase no spaces — assume identifier
  if (typeof s !== 'string' || s.length === 0) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(s);
}

const out = {};

function walk(node, path) {
  if (node === null || node === undefined) return;
  if (isSkippedPath(path)) return;
  const t = typeof node;
  if (t === 'string') {
    if (node.length === 0) return;
    if (isPreservedPath(path)) return;
    if (isUrl(node)) return;
    if (isIdentifier(node)) return;
    out[path] = node;
    return;
  }
  if (t === 'number' || t === 'boolean') return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  // object
  for (const k of Object.keys(node)) {
    walk(node[k], path ? `${path}.${k}` : k);
  }
}

walk(en, '');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

const count = Object.keys(out).length;
const totalBytes = Buffer.byteLength(JSON.stringify(out));
console.log(`Extracted ${count} translatable strings (${(totalBytes / 1024).toFixed(1)} KB) → ${outPath}`);
