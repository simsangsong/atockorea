// Read each tour's EN JSON, extract glanceItems, emit UPDATE SQL for Supabase.
// Skips east-signature-nature-core which already has the new format.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATIC_DIR = 'components/product-tour-static';
const SKIP = new Set(['east-signature-nature-core']);

const slugs = readdirSync(STATIC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'catalog')
  .map((d) => d.name)
  .filter((s) => !SKIP.has(s));

const lines = [];
for (const slug of slugs) {
  const jsonPath = join(STATIC_DIR, slug, `${slug}.en.json`);
  let doc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`SKIP ${slug}: ${e.message}\n`);
    continue;
  }
  const glance = doc.glanceItems;
  if (!Array.isArray(glance) || glance.length === 0) {
    process.stderr.write(`SKIP ${slug}: no glanceItems\n`);
    continue;
  }
  const hasLevel = glance.some((g) => typeof g.level === 'number');
  if (!hasLevel) {
    process.stderr.write(`SKIP ${slug}: no level field in glanceItems\n`);
    continue;
  }
  // pgsql string literal: escape single quotes by doubling
  const json = JSON.stringify(glance).replace(/'/g, "''");
  lines.push(
    `UPDATE tour_product_pages SET detail_payload = jsonb_set(detail_payload, '{glanceItems}', '${json}'::jsonb), updated_at = now() WHERE slug = '${slug}' AND locale = 'en';`,
  );
}

const out = lines.join('\n');
writeFileSync('scripts/.glance-items-supabase-update.sql', out + '\n');
process.stdout.write(`Generated ${lines.length} UPDATE statements → scripts/.glance-items-supabase-update.sql\n`);
