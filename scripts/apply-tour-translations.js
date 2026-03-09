/**
 * Apply tour translations from a JSON file to a tour (by ID or slug).
 * Merges with existing translations so you can update only some locales.
 *
 * Usage:
 *   node scripts/apply-tour-translations.js <tour_id_or_slug> <path_to_translations.json>
 *
 * Example:
 *   node scripts/apply-tour-translations.js jeju-private-tour ./tour-translations.json
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const tourIdOrSlug = process.argv[2];
const translationsPath = process.argv[3];

if (!tourIdOrSlug || !translationsPath) {
  console.error('Usage: node scripts/apply-tour-translations.js <tour_id_or_slug> <path_to_translations.json>');
  process.exit(1);
}

const absolutePath = path.isAbsolute(translationsPath) ? translationsPath : path.resolve(process.cwd(), translationsPath);
if (!fs.existsSync(absolutePath)) {
  console.error('❌ File not found:', absolutePath);
  process.exit(1);
}

let translationsPayload;
try {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  // Allow file to be either { en: {...}, ko: {...} } or { translations: { en: {...}, ... } }
  translationsPayload = parsed.translations != null ? parsed.translations : parsed;
} catch (e) {
  console.error('❌ Invalid JSON:', e.message);
  process.exit(1);
}

if (typeof translationsPayload !== 'object' || translationsPayload === null) {
  console.error('❌ JSON must be an object with locale keys (en, ko, zh, zh-TW, ja, es)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourIdOrSlug);

  let query = supabase.from('tours').select('id, title, slug, translations');
  if (isUuid) {
    query = query.eq('id', tourIdOrSlug);
  } else {
    query = query.eq('slug', tourIdOrSlug);
  }
  const { data: tour, error: fetchError } = await query.single();

  if (fetchError || !tour) {
    console.error('❌ Tour not found:', tourIdOrSlug);
    process.exit(1);
  }

  const existing = tour.translations || {};
  const merged = { ...existing };
  for (const [locale, value] of Object.entries(translationsPayload)) {
    if (value && typeof value === 'object') {
      merged[locale] = { ...(merged[locale] || {}), ...value };
    }
  }

  const { error: updateError } = await supabase
    .from('tours')
    .update({ translations: merged, updated_at: new Date().toISOString() })
    .eq('id', tour.id);

  if (updateError) {
    console.error('❌ Update failed:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Translations applied for tour:', tour.id, '(' + (tour.slug || tour.title) + ')');
  console.log('   Locales updated:', Object.keys(translationsPayload).join(', '));
}

main();
