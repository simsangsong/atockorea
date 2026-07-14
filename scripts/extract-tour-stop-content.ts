/**
 * T4.1 — extract a tour's itinerary-stop content into a per-spot, per-locale
 * bundle that tour_guide_spots.content (D-5) can consume.
 *
 * Source of truth: tour_product_pages.detail_payload.itineraryStops (the same
 * flat payload the /tour-product/[slug] page renders), one row per locale.
 * Output: data/tour-stop-content/{slug}.json —
 *   { slug, locales, stops: [{ number, name, content: { [locale]: <verbatim stop> } }] }
 *
 * Lossless by design (AC): each locale's stop object is copied verbatim, so
 * nothing the drawer can render is dropped. The companion seeding script /
 * admin editor (T4.2/T4.6) decides what to attach to which geofence spot.
 *
 * Run: node --env-file=.env.local --import tsx scripts/extract-tour-stop-content.ts --slug=<slug>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

interface StopLike {
  number?: number;
  name?: string;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  const slug = slugArg?.slice('--slug='.length);
  if (!slug) {
    console.error('Usage: ... scripts/extract-tour-stop-content.ts --slug=<tour-product slug>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required (.env.local)');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from('tour_product_pages')
    .select('locale, detail_payload')
    .eq('slug', slug);
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error(`No tour_product_pages rows for slug "${slug}"`);

  // number → locale → verbatim stop object.
  const byNumber = new Map<number, { name: string; content: Record<string, StopLike> }>();
  const locales: string[] = [];

  for (const row of rows) {
    const locale = String(row.locale || 'en');
    const payload = (row.detail_payload ?? {}) as { itineraryStops?: StopLike[] };
    const stops = Array.isArray(payload.itineraryStops) ? payload.itineraryStops : [];
    if (stops.length === 0) continue;
    locales.push(locale);
    for (const stop of stops) {
      const number = Number(stop.number);
      if (!Number.isFinite(number)) continue;
      const entry = byNumber.get(number) ?? { name: String(stop.name ?? `Stop ${number}`), content: {} };
      if (locale === 'en' && stop.name) entry.name = String(stop.name);
      entry.content[locale] = stop; // verbatim — lossless
      byNumber.set(number, entry);
    }
  }

  if (byNumber.size === 0) throw new Error(`slug "${slug}" has no itineraryStops in any locale`);

  const output = {
    slug,
    locales: [...new Set(locales)].sort(),
    stop_count: byNumber.size,
    stops: [...byNumber.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, entry]) => ({ number, name: entry.name, content: entry.content })),
  };

  const outDir = path.join('data', 'tour-stop-content');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Loss check: every locale row's stop count must match the union.
  for (const locale of output.locales) {
    const count = output.stops.filter((stop) => stop.content[locale]).length;
    console.log(`  ${locale}: ${count}/${output.stop_count} stops`);
  }
  console.log(`Wrote ${outPath} (${output.stop_count} stops × ${output.locales.length} locales)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
