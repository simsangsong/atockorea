#!/usr/bin/env node
// Side-by-side EN→target comparison of LONG content for hand inspection.
// Focuses on itinerary stops, FAQ, hero tagline, descriptions.

import { readFileSync, existsSync } from 'node:fs';

const SLUG = process.argv[2] || 'pocheon-sanjeong-lake-herb-island-art-valley';
const LOCALES = ['ko', 'ja', 'zh', 'zh-TW', 'es'];

const enPath = `components/product-tour-static/${SLUG}/${SLUG}.en.json`;
const en = JSON.parse(readFileSync(enPath, 'utf-8'));
const tgts = {};
for (const loc of LOCALES) {
  const p = `components/product-tour-static/${SLUG}/${SLUG}.${loc}.json`;
  if (existsSync(p)) tgts[loc] = JSON.parse(readFileSync(p, 'utf-8'));
}

function get(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}

const PATHS = [
  'hero.tagline',
  'catalog_card.shortCardDescription',
  'price.priceNote',
  'itineraryStops[0].whyOnRoute',
  'itineraryStops[0].howTimeIsUsed',
  'itineraryStops[1].whyOnRoute',
  'itineraryStops[2].whyOnRoute',
  'faq[0].question',
  'faq[0].answer',
  'faq[1].answer',
];

console.log(`SLUG: ${SLUG}\n`);
for (const path of PATHS) {
  const enVal = get(en, path);
  if (enVal == null) { console.log(`(skipped — EN.${path} missing)\n`); continue; }
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`PATH: ${path}`);
  console.log(`EN: ${enVal}`);
  for (const loc of LOCALES) {
    const v = get(tgts[loc], path);
    console.log(`${loc.padEnd(5)}: ${v ?? '(missing)'}`);
  }
  console.log('');
}
