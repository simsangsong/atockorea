#!/usr/bin/env node
// Audit the 16 EN tour files for content that shouldn't appear in user-facing translated copy.
// Categorizes findings so a cleanup pass can decide rule per category.

import { readFileSync } from 'node:fs';

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

// Categories: each is {name, regex, exclude_paths (regex)}
const CATEGORIES = [
  { name: 'OTA_NAME_IN_VALUE',          re: /\b(GetYourGuide|getyourguide|Klook|KKday|Viator|Expedia|Tripadvisor|Trip\.com|Trazy|Hanatour|Tripmoments|Mindtrip|KoreaTravelEasy|Seoul Pass|MyRealTrip)\b/i },
  { name: 'GETYOURGUIDE_URL',           re: /getyourguide\.com|gyg\b/i },
  { name: 'INTERNAL_JARGON',            re: /\b(atockorea(?!\.[a-z]+)|catalog'?s?\b|cohort|demographic|segment(?:s|ation)?\b|persona\b|moat\b|business case|operator note|strategy|positioning|funnel)\b/i },
  { name: 'SISTER_PRODUCT_REF',         re: /\b(sister product|our\s+[A-Z][\w-]+\s+(tour|route|UNESCO|product))\b/ },
  { name: 'TBD_PLACEHOLDER',            re: /\b(TBD|TBA|TBC|TODO|FIXME|XXX)\b/ },
  { name: 'PRICING_INTERNAL',           re: /(Original price\s+\$?\d|sale price applies|flat\s+\d+%\s+discount|value_for_money|market rate|sister product)/i },
  { name: 'OPERATOR_NAME_LEAK',         re: /\b(operator|vendor|partner)['"]?s?\b\s+(GetYourGuide|name|listing|profile)/i },
  { name: 'SOURCING_NOTE',              re: /\b(verified (?:via|across)|cross-checked|cross-reference|sourced from|sourcing follows|listing snippet|listing data)\b/i },
  { name: 'AUDIT_SUMMARY_FIELD',        re: /\b(audit_summary|reviews_attribution|external_source|sourcing|internal_note|build_note|migration_note)\b/ },
  { name: 'SCHEMA_INTERNAL',            re: /\b(schema_version|priceSource|priceMode|document_kind|productId|product_id|asset_path|endpoint|deprecated|legacy)\b/i },
  { name: 'AI_TONE_OVERUSE',            re: /\b(embark on|immerse yourself|sumérgete|unforgettable|step back in time|hidden gem|must-see|let yourself be enchanted|experience the magic|soul-stirring|once in a lifetime|truly unique|world-class|breathtaking|stunning|spectacular|unforgettable journey|bucket[- ]list|signature experience|curated experience|carefully crafted|perfectly designed|seamless experience|elevate your)\b/i },
  { name: 'CONFIDENTIAL_PARTNER_NAME',  re: /\b(Hanwha Resort|Annecy branch|Lotte|Shilla|Marriott|Hilton|Hyatt|Sheraton)\b/ },
  { name: 'OPERATOR_COMPANY_NAME',      re: /\b(Love Korea Tours?|K-Travel|Cosmojin|JTOUR|Premium Korea Tours?)\b/i },
  { name: 'BRAND_CASING_INCONSISTENT',  re: /\batockorea\b/ }, // lowercase — should be "AtoC Korea"
  { name: 'EM_DASH_ISSUE',              re: /[—]{2,}/ }, // bizarre double em-dashes
];

// Paths whose values are definitely USER-FACING (we care most about these for AI tone, OTA leaks)
const USER_FACING_PATH_PATTERNS = [
  /^seo\./,
  /^catalog_card\./,
  /^hero\./,
  /^subnavItems\[\d+\]\.label$/,
  /^glanceItems\[\d+\]\.(label|valueLabel|description)$/,
  /^itineraryStops\[\d+\]\.(name|description|whyOnRoute|howTimeIsUsed|smartNotes|operatingHours|admission|highlights\[\d+\])/,
  /^faq\[\d+\]\.(question|answer)/,
  /^bookingTrustItems\[\d+\]\./,
  /^page_sections\[\d+\]\.props\./,
  /^reviews\./,
  /^price\./,
  /^headlineLine[12]/,
  /^badges/,
];

// Paths that are internal/metadata — leaks here are still bad but classify separately
const INTERNAL_PATH_PATTERNS = [
  /^audit_summary/,
  /^sourcing/,
  /^reviews_attribution/,
  /^external_source/,
  /^build_note/,
  /^internal/,
  /^_/,
];

function isUserFacing(path) { return USER_FACING_PATH_PATTERNS.some(re => re.test(path)); }
function isInternalField(path) { return INTERNAL_PATH_PATTERNS.some(re => re.test(path)); }

function walk(node, path, cb) {
  if (typeof node === 'string') { cb(path, node); return; }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`, cb)); return; }
  for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, cb);
}

const findings = {};
for (const cat of CATEGORIES) findings[cat.name] = [];

for (const slug of SLUGS) {
  const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
  let en;
  try { en = JSON.parse(readFileSync(enPath, 'utf-8')); }
  catch (e) { console.error(`Skipping ${slug}: ${e.message}`); continue; }

  walk(en, '', (path, value) => {
    for (const cat of CATEGORIES) {
      // SCHEMA_INTERNAL: only flag if the VALUE matches in user-facing paths.
      if (cat.name === 'SCHEMA_INTERNAL') {
        if (!isUserFacing(path)) continue;
      }
      // AUDIT_SUMMARY_FIELD: match by path key name itself rather than value.
      if (cat.name === 'AUDIT_SUMMARY_FIELD') {
        if (cat.re.test(path)) {
          findings[cat.name].push({ slug, path, hit: '(path-name match)', userFacing: false, internal: true, sample: value.slice(0, 120) });
        }
        continue;
      }
      const m = value.match(cat.re);
      if (m) {
        findings[cat.name].push({
          slug, path, hit: m[0], userFacing: isUserFacing(path), internal: isInternalField(path),
          sample: value.slice(0, 120),
        });
      }
    }
  });
}

// Print summary
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(`AUDIT REPORT — 16 EN tour files`);
console.log('═══════════════════════════════════════════════════════════════════════');
for (const cat of CATEGORIES) {
  const list = findings[cat.name];
  if (list.length === 0) { continue; }
  console.log(`\n## [${cat.name}] — ${list.length} hits`);
  // Group by slug, show first 3 per slug
  const bySlug = {};
  for (const f of list) {
    if (!bySlug[f.slug]) bySlug[f.slug] = [];
    bySlug[f.slug].push(f);
  }
  for (const slug of Object.keys(bySlug).sort()) {
    console.log(`  • ${slug} (${bySlug[slug].length})`);
    for (const f of bySlug[slug].slice(0, 3)) {
      const tag = f.userFacing ? '⚠️  USER-FACING' : (f.internal ? '   internal' : '   (other)');
      console.log(`      ${tag} ${f.path}: "${f.sample}${f.sample.length >= 120 ? '...' : ''}"`);
    }
    if (bySlug[slug].length > 3) console.log(`      ... +${bySlug[slug].length - 3} more`);
  }
}

// Quick totals
console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('TOTALS:');
let userFacingTotal = 0, internalTotal = 0;
for (const cat of CATEGORIES) {
  const uf = findings[cat.name].filter(f => f.userFacing).length;
  const it = findings[cat.name].filter(f => f.internal).length;
  console.log(`  ${cat.name.padEnd(28)} total=${String(findings[cat.name].length).padStart(4)}  user-facing=${String(uf).padStart(4)}  internal=${String(it).padStart(4)}`);
  userFacingTotal += uf;
  internalTotal += it;
}
console.log(`\n  GRAND user-facing leaks:  ${userFacingTotal}`);
console.log(`  GRAND internal-field hits: ${internalTotal}`);
