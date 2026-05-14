// sync_from_db.mjs - Pull itineraryStops from Supabase DB → update JSON file
// Usage: node scripts/sync_from_db.mjs slug locale [slug2 locale2 ...]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load env
const envContent = readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error('Usage: node scripts/sync_from_db.mjs slug locale [slug2 locale2 ...]');
  process.exit(1);
}

const pairs = [];
for (let i = 0; i < args.length; i += 2) {
  pairs.push([args[i], args[i + 1]]);
}

const base = 'components/product-tour-static';

for (const [slug, locale] of pairs) {
  const fp = join(base, slug, `${slug}.${locale}.json`);
  if (!existsSync(fp)) {
    console.error(`File not found: ${fp}`);
    continue;
  }

  // Get DB itineraryStops
  const { data, error } = await supabase
    .from('tour_product_pages')
    .select('detail_payload')
    .eq('slug', slug)
    .eq('locale', locale)
    .single();

  if (error) {
    console.error(`FETCH ERROR ${slug}/${locale}: ${error.message}`);
    continue;
  }

  const dbStops = data.detail_payload?.itineraryStops || [];
  const dbAvg = dbStops.length ? Math.round(dbStops.reduce((a, s) => a + (s.description || '').length, 0) / dbStops.length) : 0;

  // Read current file
  const fileData = JSON.parse(readFileSync(fp, 'utf8'));
  const fileStops = fileData.itineraryStops || [];
  const fileAvg = fileStops.length ? Math.round(fileStops.reduce((a, s) => a + (s.description || '').length, 0) / fileStops.length) : 0;

  // Update file with DB stops
  fileData.itineraryStops = dbStops;
  writeFileSync(fp, JSON.stringify(fileData, null, 2), 'utf8');
  console.log(`DB→FILE ${slug}/${locale}: ${dbStops.length} stops, db_avg=${dbAvg} (was file_avg=${fileAvg})`);
}
