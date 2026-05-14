const path = require('path');
const fs = require('fs');
const base = path.join(__dirname, '..', 'components', 'product-tour-static');
const locales = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'];

const tours = [
  'jeju-grand-highlights-loop',
  'jeju-eastern-unesco-spots-day-tour',
  'jeju-west-south-full-day-authentic-tour',
  'jeju-southern-top-unesco-spots-tour',
  'jeju-winter-southwest-tangerine-snow-camellia-tour',
  'jeju-hydrangea-festival-tour-east-route',
  'jeju-hydrangea-festival-tour-southwest-route',
  'jeju-cherry-blossom-tour-east-route',
  'jeju-cruise-shore-excursion-bus-tour',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-top-attractions-day-tour',
  'busan-small-group-sightseeing-tour-cruise-passengers',
  'busan-gyeongju-unesco-legacy-tour-national-museum',
  'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju',
  'busan-spring-cherry-blossom-gyeongju-highlights-day-tour',
  'from-busan-gyeongju-ancient-capital-day-tour',
  'seoul-suwon-hwaseong-folk-village-starfield-library',
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
  'seoul-suwon-hwaseong-waujeongsa-starfield',
  'seoul-seoraksan-national-park-sokcho-beach-day-trip',
  'from-incheon-seoul-day-tour-cruise-guests',
];

const jejuTours = tours.filter(t => t.startsWith('jeju-'));

// Load all pickup data
const data = {};
for (const slug of tours) {
  for (const locale of locales) {
    const jsonPath = path.join(base, slug, `${slug}.${locale}.json`);
    try {
      const f = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (f.pickup_dropoff && f.pickup_dropoff.departure) {
        data[`${slug}-${locale}`] = f.pickup_dropoff;
      }
    } catch (e) {}
  }
}

const outDir = path.join(__dirname, '..', 'scripts');

for (const locale of locales) {
  const validTours = tours.filter(t => data[`${t}-${locale}`]);
  if (validTours.length === 0) continue;

  const allJejuSame =
    jejuTours.every(t => data[`${t}-${locale}`]) &&
    jejuTours.every(t => JSON.stringify(data[`${t}-${locale}`]) === JSON.stringify(data[`${jejuTours[0]}-${locale}`]));

  const caseLines = [];
  const processedTours = new Set();

  if (allJejuSame) {
    const inList = jejuTours.map(t => `'${t}'`).join(', ');
    const val = JSON.stringify(data[`${jejuTours[0]}-${locale}`]).replace(/'/g, "''");
    caseLines.push(`  WHEN p.slug IN (${inList}) THEN '${val}'::jsonb`);
    jejuTours.forEach(t => processedTours.add(t));
  }

  for (const t of validTours) {
    if (processedTours.has(t)) continue;
    const val = JSON.stringify(data[`${t}-${locale}`]).replace(/'/g, "''");
    caseLines.push(`  WHEN p.slug = '${t}' THEN '${val}'::jsonb`);
  }

  const inList = validTours.map(t => `'${t}'`).join(', ');
  const sql =
    `UPDATE tour_product_pages AS p\n` +
    `SET detail_payload = jsonb_set(p.detail_payload, '{pickup_dropoff}', CASE\n` +
    caseLines.join('\n') + '\n' +
    `  ELSE p.detail_payload -> 'pickup_dropoff'\nEND)\n` +
    `WHERE p.locale = '${locale}' AND p.slug IN (${inList});`;

  const outFile = path.join(outDir, `pickup_sql_${locale.replace('-', '_')}.sql`);
  fs.writeFileSync(outFile, sql, 'utf8');
  console.log(`locale=${locale} tours=${validTours.length} bytes=${sql.length} → ${path.basename(outFile)}`);
}

console.log('Done.');
