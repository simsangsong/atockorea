#!/usr/bin/env node
// Phase 0: In-place cleanup of 16 EN tour JSON files.
// Removes OTA names, internal jargon, pricing strategy leaks, sister-product refs.
// seo.* and all non-user-facing metadata paths are skipped.

import { readFileSync, writeFileSync } from 'node:fs';

const SLUGS = [
  'jeju-west-south-full-day-authentic-tour',
  'busan-small-group-sightseeing-tour-cruise-passengers',
  'busan-private-car-charter-cruise-shore',
  'busan-top-attractions-day-tour',
  'incheon-seoul-private-car-shore-excursion-cruise',
  'busan-gyeongju-unesco-legacy-tour-national-museum',
  'from-busan-gyeongju-ancient-capital-day-tour',
  'jeju-hydrangea-festival-tour-east-route',
  'from-incheon-seoul-day-tour-cruise-guests',
  'jeju-eastern-unesco-spots-day-tour',
  'southwest-hallasan-osulloc-aewol',
  'jeju-hydrangea-festival-tour-southwest-route',
  'jeju-cruise-shore-excursion-small-group-tour',
  'jeju-grand-highlights-loop',
  'jeju-island-private-car-charter-tour',
  'pocheon-sanjeong-lake-herb-island-art-valley',
];

// Paths to SKIP entirely (value not modified)
const SKIP_PATH_PREFIXES = [
  'seo.',
  '_publication', 'audit_summary', 'sourcing', 'reviews_attribution',
  'external_source', '_internal', '_score_audit', '_methodology', '_poi_meta',
];
const SKIP_PATH_SUFFIXES = [
  'slug', 'product_id', 'document_kind', 'schema_version', 'locale',
  'priceSource', 'ogImage', 'imageUrl', 'thumbnail', 'heroImage', 'icon',
  'id', 'currency', 'priceMode', 'imagePosition',
];

function shouldSkipPath(path) {
  for (const p of SKIP_PATH_PREFIXES) if (path === p || path.startsWith(p + '.') || path.startsWith(p + '[') || path.includes('.' + p + '.') || path.includes('.' + p + '[')) return true;
  for (const s of SKIP_PATH_SUFFIXES) if (path === s || path.endsWith('.' + s)) return true;
  // URL values and snake/kebab identifiers handled by value check
  return false;
}

function isUrl(s) { return /^https?:\/\//.test(s); }
function isIdentifier(s) { return /^[a-z0-9][a-z0-9_-]*$/.test(s); }

// OTA source array item exact values to delete (case-insensitive compare)
const OTA_EXACT_TOKENS_LOWER = new Set([
  'trazy', 'klook', 'kkday', 'trip.com', 'trip.com korea',
  'tripadvisor', 'tripmoments', 'mindtrip', 'seoul pass',
  'koreatraveleasy', 'myrealtrip',
]);
const OTA_EXACT_TOKENS = { has: (s) => OTA_EXACT_TOKENS_LOWER.has(s.toLowerCase().trim()) };

const PRICE_NOTE_PATHS = [
  'price.priceNote',
  'sticky_booking_bar.price.priceNote',
];

// Sequential regex replacements
const REPLACEMENTS = [
  [/Price TBD\s*[—\-]\s*confirm small-group rate from GetYourGuide listing/gi, 'Price varies — confirm at booking'],
  [/Original price\s+(?:USD\s*\d+|\$\d+\s*USD?|\$?\d+)\s+on GetYourGuide;?\s*AtoC Korea sale price (?:is a|applies a) flat 10% discount\.?/gi, 'AtoC Korea price.'],
  [/AtoC Korea sale price (?:is a|applies a) flat 10% discount\.?/gi, 'AtoC Korea sale price.'],
  [/;\s*AtoC Korea sale price (?:is a|applies a) flat 10% discount\.?/gi, '.'],
  [/\s*via GetYourGuide or AtoC Korea direct/gi, ' via AtoC Korea'],
  [/\s*via Klook or bluelinepark\.com/gi, ' via the official site'],
  [/\s*\(verified (?:via|across)[^)]*?(?:GetYourGuide|Trazy|Klook|KKday|Trip\.com|Tripadvisor|Tripmoments|Mindtrip|Seoul Pass|KoreaTravelEasy|MyRealTrip)[^)]*?\)/gi, ''],
  [/Tour design follows[^.]*?(?:GetYourGuide|Trazy|Klook|KKday|Trip\.com|Tripadvisor)[^.]*?\.\s*/gi, ''],
  [/(?:operator'?s?|the operator'?s?)\s+GetYourGuide\s+listing/gi, "the operator's listing"],
  [/Aggregate (?:rating|metric)[^.]*operator'?s?\s+GetYourGuide listing[^.]*\./gi, ''],
  [/\s+via (?:Klook|GetYourGuide|KKday|Trazy|Trip\.com|Tripadvisor|Tripmoments|Mindtrip|MyRealTrip)/gi, ''],
  [/\s+on GetYourGuide/gi, ''],
  [/\s+from GetYourGuide listing/gi, ''],
  [/\s+through (?:Klook|GetYourGuide|KKday|Trazy)/gi, ''],
  [/\(Klook \+ Trip\.com confirmed\):?\s*/gi, ''],
  [/\b(?:Trazy|Klook|KKday|Trip\.com(?:\s+Korea)?|Tripadvisor|Tripmoments|Mindtrip|Seoul Pass|KoreaTravelEasy|MyRealTrip)\s*\/\s*[A-Za-z]+/gi, ''],
  // Sister product / cross-reference
  [/Sister product\s*\([^)]*?(?:Southern UNESCO|same operator)[^)]*?\)\s*(?:is\s+\$\d+\s+per\s+person\.?)?/gi, 'A comparable Jeju tour'],
  [/Sister tour\s*\([^)]*\)\s*is approximately\s+\$?\d+\s*per\s*person\.?/gi, 'A comparable tour.'],
  [/our Southern UNESCO tour/gi, 'our Southern UNESCO route'],
  [/\s*[—\-]\s*Love Korea Tours/g, ''],
  [/\bLove Korea Tours\b/g, 'the operator'],
  // Internal jargon
  [/\bthe catalog'?s\s+(strongest|signature|most|premier|best|leading)\b/gi, 'particularly $1'],
  [/\bthe catalog'?s\s+/gi, ''],
  [/\bcatalog-leading\b/gi, 'leading'],
  [/\batockorea'?s\s+([\w-]+(?:-[\w-]+)*)\s+segment(?:s)?\b/gi, 'our $1'],
  [/\bK-drama-fan segment\b/gi, 'fans of Korean dramas'],
  [/\bfirst-time-Jeju option\b/gi, 'first-time Jeju option'],
  [/\bcatalog'?s\s+/gi, ''],
  // Brand casing
  [/\batockorea\b/g, 'AtoC Korea'],

  // === Operator listing references in priceNote / review fields ===
  [/Small-group price not yet confirmed from operator listing\.\s*/gi, 'Price not yet confirmed. '],
  [/Small-group price not yet confirmed from listing snippet\.\s*/gi, 'Price not yet confirmed. '],
  [/Cruise excursion price not yet confirmed from operator listing\.\s*/gi, 'Price not yet confirmed. '],
  [/price not yet confirmed from (?:operator listing|listing snippet)\.?\s*/gi, 'Price not yet confirmed. '],
  [/not yet confirmed from (?:operator listing|listing snippet)/gi, 'not yet confirmed'],
  [/from (?:the )?operator(?:'s)? listing/gi, ''],
  [/from listing snippet/gi, ''],
  [/on the operator(?:'s)? listing/gi, ''],
  [/\s+(?:across|from)\s+(?:\d+)?\s*packages?\.?/gi, '.'],
  [/Comparable [A-Za-z\-\s]+ tours? range \$[\d\-–]+(?:\s+across[^.]*)?\.?/gi, 'Confirm current price at booking.'],
  [/Once confirmed,\s*/gi, ''],
  // Review attribution cleaning
  [/Aggregate rating from the operator(?:'s)? listing\s*[—\-]\s*read individual reviews there\.?/gi, 'Guest ratings from verified bookings.'],
  [/(\d+\.?\d*\s*\/\s*5(?:\s+across\s+\d+\s+reviews)?)\s+on the operator(?:'s)? listing/gi, '$1'],
  // Sister tour references in priceNote
  [/Sister tour\s*\([^)]*\)\s*is approximately\s+\$?\d+\s*per\s*person\.?\s*/gi, ''],
  [/our (?:West\s*&?\s*South\s+Hydrangea|Southern UNESCO|Eastern UNESCO)\s+route/gi, 'a comparable tour'],
  // nature-core and internal descriptor jargon in user-facing content
  [/\bnature-core\s+sister\s+tour\b/gi, 'comparable nature tour'],
  [/\bnature-core\b/gi, 'nature-focused'],
  // Pricing: "Original price NN USD;" without GetYourGuide ref
  [/Original price\s+\d+\s*USD\s*;?\s*AtoC Korea sale price\.?/gi, 'AtoC Korea price.'],
  [/Original price\s+\$?\d+(?:\.\d+)?\s*USD\s*;/gi, 'AtoC Korea price —'],
];

function applyReplacements(s) {
  for (const [re, rep] of REPLACEMENTS) {
    s = s.replace(re, rep);
  }
  // Normalize whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

// Deep walk: modifies arrays in-place, returns modified value for objects/strings
function cleanNode(node, path) {
  if (node === null || node === undefined) return node;
  const t = typeof node;
  if (t === 'number' || t === 'boolean') return node;
  if (t === 'string') {
    if (shouldSkipPath(path)) return node;
    if (isUrl(node) || isIdentifier(node)) return node;
    return applyReplacements(node);
  }
  if (Array.isArray(node)) {
    // Remove pure OTA tokens from arrays (sources fields etc.)
    const cleaned = [];
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      const itemPath = `${path}[${i}]`;
      if (typeof item === 'string' && OTA_EXACT_TOKENS.has(item.trim())) continue;
      cleaned.push(cleanNode(item, itemPath));
    }
    // Splice in-place equivalent: return new array
    return cleaned;
  }
  // object
  const out = {};
  for (const k of Object.keys(node)) {
    const childPath = path ? `${path}.${k}` : k;
    out[k] = cleanNode(node[k], childPath);
  }
  return out;
}

// Post-process: fill empty priceNote fields
function fixEmptyPriceNotes(obj) {
  // Handle top-level price.priceNote and sticky_booking_bar.price.priceNote
  if (obj.price && typeof obj.price.priceNote === 'string' && obj.price.priceNote.trim() === '') {
    obj.price.priceNote = 'Confirm price at booking.';
  }
  if (obj.sticky_booking_bar?.price && typeof obj.sticky_booking_bar.price.priceNote === 'string'
      && obj.sticky_booking_bar.price.priceNote.trim() === '') {
    obj.sticky_booking_bar.price.priceNote = 'Confirm price at booking.';
  }
  // page_sections[*].props.price.priceNote
  if (Array.isArray(obj.page_sections)) {
    for (const sec of obj.page_sections) {
      if (sec?.props?.price && typeof sec.props.price.priceNote === 'string'
          && sec.props.price.priceNote.trim() === '') {
        sec.props.price.priceNote = 'Confirm price at booking.';
      }
    }
  }
}

let totalChanged = 0;
const results = [];

for (const slug of SLUGS) {
  const filePath = `components/product-tour-static/${slug}/${slug}.en.json`;
  let original;
  try {
    original = readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`ERROR reading ${filePath}: ${e.message}`);
    results.push({ slug, status: 'ERROR', error: e.message });
    continue;
  }

  let en;
  try {
    en = JSON.parse(original);
  } catch (e) {
    console.error(`ERROR parsing ${filePath}: ${e.message}`);
    results.push({ slug, status: 'PARSE_ERROR', error: e.message });
    continue;
  }

  const cleaned = cleanNode(en, '');
  fixEmptyPriceNotes(cleaned);

  const newContent = JSON.stringify(cleaned, null, 2);
  // Count changed strings by comparing
  const oldStr = JSON.stringify(en);
  const newStr = JSON.stringify(cleaned);
  const changed = oldStr !== newStr;
  if (changed) totalChanged++;

  writeFileSync(filePath, newContent, 'utf-8');

  // Verify parse
  try {
    JSON.parse(newContent);
    console.log(`✓ ${slug} — ${changed ? 'modified' : 'unchanged'}`);
    results.push({ slug, status: 'OK', changed });
  } catch (e) {
    console.error(`ERROR: ${slug} produced invalid JSON after cleanup: ${e.message}`);
    results.push({ slug, status: 'INVALID_JSON', error: e.message });
  }
}

console.log(`\nPhase 0 cleanup done. Files modified: ${results.filter(r => r.changed).length}/16`);
console.log('Parse errors:', results.filter(r => r.status !== 'OK').map(r => r.slug).join(', ') || 'none');
