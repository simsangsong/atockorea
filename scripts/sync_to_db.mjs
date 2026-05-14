// sync_to_db.mjs - Push itineraryStops from JSON file to Supabase DB
// Usage: node scripts/sync_to_db.mjs slug locale [slug2 locale2 ...]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
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
  console.error('Usage: node scripts/sync_to_db.mjs slug locale [slug2 locale2 ...]');
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
  const data = JSON.parse(readFileSync(fp, 'utf8'));
  const stops = data.itineraryStops || [];
  const avgLen = stops.length ? Math.round(stops.reduce((a, s) => a + (s.description || '').length, 0) / stops.length) : 0;

  // First get current DB state
  const { data: current, error: fetchErr } = await supabase
    .from('tour_product_pages')
    .select('detail_payload')
    .eq('slug', slug)
    .eq('locale', locale)
    .single();

  if (fetchErr) {
    console.error(`FETCH ERROR ${slug}/${locale}: ${fetchErr.message}`);
    continue;
  }

  // Merge: update only itineraryStops
  const newPayload = { ...current.detail_payload, itineraryStops: stops };

  const { error: updateErr } = await supabase
    .from('tour_product_pages')
    .update({ detail_payload: newPayload })
    .eq('slug', slug)
    .eq('locale', locale);

  if (updateErr) {
    console.error(`UPDATE ERROR ${slug}/${locale}: ${updateErr.message}`);
  } else {
    console.log(`SYNCED ${slug}/${locale}: ${stops.length} stops, avg_desc=${avgLen}`);
  }
}
