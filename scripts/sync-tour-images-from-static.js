#!/usr/bin/env node
/**
 * Phase 0 emergency sync — copy image paths from static JSON bundles
 * (components/product-tour-static/<slug>/<slug>.ko.json) into the legacy
 * tours table so the admin "이미지" tab stops showing stale Unsplash photos.
 *
 * Source of truth: `<slug>.ko.json` (Korean primary). Extracts:
 *   - catalog_card.thumbnail | catalog_card.heroImage | hero.imageUrl  -> tours.image_url
 *   - galleryItems[].src                                                -> tours.gallery_images (JSONB array of strings)
 *
 * Output: prints SQL on stdout. Pipe / paste / execute via mcp execute_sql.
 *
 * Usage: node scripts/sync-tour-images-from-static.js
 */

const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.atockorea.com').replace(/\/$/, '');
const STATIC_DIR = path.join(__dirname, '..', 'components', 'product-tour-static');
const SKIP_DIRS = new Set(['_shared', 'catalog']);

function normalizeUrl(href) {
  // Keep external absolute URLs as-is; keep site-relative paths relative
  // (admin & customer pages both resolve against their current origin).
  if (!href || typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed; // KEEP relative
  return trimmed;
}

function sqlString(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlJsonb(arr) {
  // JSON stringify then SQL-escape, then cast to JSONB.
  const json = JSON.stringify(arr ?? []);
  return `${sqlString(json)}::jsonb`;
}

const slugs = fs.readdirSync(STATIC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name) && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

const updates = [];
const skipped = [];

for (const slug of slugs) {
  const jsonPath = path.join(STATIC_DIR, slug, `${slug}.ko.json`);
  if (!fs.existsSync(jsonPath)) {
    skipped.push({ slug, reason: 'no .ko.json' });
    continue;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    skipped.push({ slug, reason: `parse error: ${e.message}` });
    continue;
  }

  const cc = payload.catalog_card || {};
  const hero = payload.hero || {};
  const thumbnail =
    normalizeUrl(cc.thumbnail) ||
    normalizeUrl(cc.heroImage) ||
    normalizeUrl(hero.imageUrl);

  const gallery = Array.isArray(payload.galleryItems)
    ? payload.galleryItems
        .map((g) => normalizeUrl(g && g.src))
        .filter(Boolean)
    : [];

  if (!thumbnail && gallery.length === 0) {
    skipped.push({ slug, reason: 'no images found in JSON' });
    continue;
  }

  updates.push({ slug, image_url: thumbnail, gallery });
}

// ---------- Emit SQL ----------
const lines = [];
lines.push('-- Phase 0 image sync: static JSON -> tours table');
lines.push(`-- Generated: ${new Date().toISOString()}`);
lines.push(`-- Updates: ${updates.length} | Skipped: ${skipped.length}`);
lines.push('');
lines.push('BEGIN;');
for (const u of updates) {
  lines.push(
    `UPDATE tours SET image_url = ${sqlString(u.image_url)}, gallery_images = ${sqlJsonb(
      u.gallery,
    )}, updated_at = NOW() WHERE slug = ${sqlString(u.slug)};`,
  );
}
lines.push('COMMIT;');
lines.push('');
for (const s of skipped) {
  lines.push(`-- SKIPPED: ${s.slug} (${s.reason})`);
}

const outPath = path.join(__dirname, 'sync-tour-images-from-static.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

// Also print a brief summary to stderr
process.stderr.write(`Wrote ${updates.length} UPDATE statements to ${outPath}\n`);
if (skipped.length) {
  process.stderr.write(`Skipped ${skipped.length}: ${skipped.map((s) => s.slug).join(', ')}\n`);
}
process.stdout.write(lines.join('\n') + '\n');
