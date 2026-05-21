#!/usr/bin/env node
// Audit existing translations vs EN for ALL 16 target tours.
// Reports:
//   - Key structure mismatch (missing/extra keys)
//   - Type mismatches
//   - Suspect untranslated leaks (long English chunks unchanged)
//   - String count divergence
//   - Image URL differences (informational only)

import { readFileSync, existsSync } from 'node:fs';

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

const LOCALES = ['ko', 'ja', 'zh', 'zh-TW', 'es'];

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
    if (node.length === 0) out.push({ path, type: 'array_empty', value: [] });
    node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, out);
}

function leafMap(obj) {
  const arr = [];
  walk(obj, '', arr);
  return new Map(arr.map(l => [l.path, l]));
}

const englishMarker = /\b(the|and|with|from|tour|small group|day tour|cruise|shore|excursion|highlights|itinerary|details|overview|stops|hours|family|private|pickup|drop-off|booking|inclusions|review|pace|coast|wetland|temple|island|mountain|fortress|cave|valley|station|shuttle|guide|festival)\b/i;

let totalMissing = 0, totalExtra = 0, totalTypeMismatch = 0, totalSuspect = 0;
const summary = [];

for (const slug of SLUGS) {
  const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
  if (!existsSync(enPath)) { console.error(`EN missing: ${enPath}`); continue; }
  let en;
  try { en = JSON.parse(readFileSync(enPath, 'utf-8')); }
  catch (e) { console.error(`EN parse error ${slug}: ${e.message}`); continue; }
  const enLeaves = leafMap(en);
  const enKeys = new Set(enLeaves.keys());

  for (const loc of LOCALES) {
    const tgtPath = `components/product-tour-static/${slug}/${slug}.${loc}.json`;
    if (!existsSync(tgtPath)) { summary.push({ slug, loc, status: 'MISSING_FILE' }); continue; }
    let tgt;
    try { tgt = JSON.parse(readFileSync(tgtPath, 'utf-8')); }
    catch (e) { summary.push({ slug, loc, status: `PARSE_ERR: ${e.message}` }); continue; }
    const tgtLeaves = leafMap(tgt);
    const tgtKeys = new Set(tgtLeaves.keys());

    const missing = [...enKeys].filter(k => !tgtKeys.has(k));
    const extra = [...tgtKeys].filter(k => !enKeys.has(k));

    let typeMismatch = 0;
    let suspect = 0;
    for (const [k, e] of enLeaves) {
      const t = tgtLeaves.get(k);
      if (!t) continue;
      if (e.type !== t.type) typeMismatch++;
      if (e.type === 'string' && t.type === 'string') {
        if (e.value && e.value.length > 25 && e.value === t.value && englishMarker.test(t.value)) suspect++;
      }
    }

    totalMissing += missing.length;
    totalExtra += extra.length;
    totalTypeMismatch += typeMismatch;
    totalSuspect += suspect;

    summary.push({
      slug,
      loc,
      enLeafCount: enLeaves.size,
      tgtLeafCount: tgtLeaves.size,
      missing: missing.length,
      extra: extra.length,
      typeMismatch,
      suspectUntranslated: suspect,
      sampleMissing: missing.slice(0, 3),
      sampleExtra: extra.slice(0, 3),
    });
  }
}

// Print compact table
console.log(`\n${'SLUG'.padEnd(58)} ${'LOC'.padEnd(6)} ${'EN_LEAVES'.padStart(9)} ${'TGT_LEAVES'.padStart(10)} ${'MISS'.padStart(5)} ${'EXTRA'.padStart(5)} ${'TYPE'.padStart(4)} ${'SUSP'.padStart(4)}`);
console.log('-'.repeat(110));
for (const s of summary) {
  if (s.status) {
    console.log(`${s.slug.padEnd(58)} ${s.loc.padEnd(6)} ${s.status}`);
    continue;
  }
  console.log(`${s.slug.padEnd(58)} ${s.loc.padEnd(6)} ${String(s.enLeafCount).padStart(9)} ${String(s.tgtLeafCount).padStart(10)} ${String(s.missing).padStart(5)} ${String(s.extra).padStart(5)} ${String(s.typeMismatch).padStart(4)} ${String(s.suspectUntranslated).padStart(4)}`);
}

console.log('\n--- TOTALS ---');
console.log(`Missing keys (target lacks EN key): ${totalMissing}`);
console.log(`Extra keys (target has key not in EN): ${totalExtra}`);
console.log(`Type mismatches: ${totalTypeMismatch}`);
console.log(`Suspect-untranslated long strings: ${totalSuspect}`);
console.log(`Total tour-locale combos audited: ${summary.filter(s => !s.status).length}`);

// Also print top slugs with most extra fields
const byExtra = summary.filter(s => !s.status).sort((a, b) => b.extra - a.extra).slice(0, 5);
console.log('\nTop 5 (slug, locale) with most EXTRA fields (rewriting expected):');
for (const s of byExtra) console.log(`  ${s.slug}.${s.loc}: extra=${s.extra}, missing=${s.missing}, samples=${JSON.stringify(s.sampleExtra)}`);

const byMissing = summary.filter(s => !s.status).sort((a, b) => b.missing - a.missing).slice(0, 5);
console.log('\nTop 5 (slug, locale) with most MISSING fields (omitted content):');
for (const s of byMissing) console.log(`  ${s.slug}.${s.loc}: missing=${s.missing}, samples=${JSON.stringify(s.sampleMissing)}`);
