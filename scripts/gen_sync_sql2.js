const fs = require('fs');
const path = require('path');
const base = 'components/product-tour-static';

const pairs = process.argv.slice(2).map(a => a.split(':'));
const outDir = process.argv.includes('--outdir') ? process.argv[process.argv.indexOf('--outdir') + 1] : 'C:/Users/sangsong/atockorea/.sync_tmp';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const [slug, loc] of pairs) {
  const fp = path.join(base, slug, `${slug}.${loc}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const stopsJson = JSON.stringify(data.itineraryStops || []);
  // Escape single quotes for SQL literal
  const escaped = stopsJson.replace(/'/g, "''");
  const sql = `UPDATE tour_product_pages SET detail_payload = jsonb_set(detail_payload, '{itineraryStops}', (SELECT jsonb_agg(elem ORDER BY (elem->>'number')::int) FROM jsonb_array_elements('${escaped}'::jsonb) AS elem)) WHERE slug = '${slug}' AND locale = '${loc}';`;
  const shortSlug = slug.replace(/-/g, '_').substring(0, 30);
  const outFile = path.join(outDir, `sync_${shortSlug}_${loc}.sql`);
  fs.writeFileSync(outFile, sql, 'utf8');
  console.log(`${outFile} (${sql.length} chars, ${(data.itineraryStops || []).length} stops)`);
}
