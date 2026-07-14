/**
 * T4.6 — seed tour_guide_spots for a tour from the T4.1 extraction bundle.
 *
 * Coordinates come from match_pois (the same verified coordinates the
 * itinerary-builder map renders), content is the verbatim per-locale stop
 * object, and poi_key doubles as the data/poi_kb fallback pointer (D-5).
 *
 * Real-coordinate verification stays a human gate (§F T4.6 AC) — see
 * docs/tour-mode-pilot-spot-checklist-2026-07-14.md after running.
 *
 * Run: node --env-file=.env.local --import tsx scripts/seed-tour-guide-spots.ts --slug=<slug> [--force]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/** stop number in the extraction bundle → geofence spec. */
const SPOT_SPECS: Record<string, Array<{ stopNumber: number; poiKey: string; triggerRadiusM: number }>> = {
  'busan-top-attractions-day-tour': [
    { stopNumber: 2, poiKey: 'haedong_yonggungsa', triggerRadiusM: 150 },
    { stopNumber: 3, poiKey: 'cheongsapo_blue_line_park', triggerRadiusM: 200 },
    { stopNumber: 5, poiKey: 'un_memorial_cemetery', triggerRadiusM: 150 },
    { stopNumber: 6, poiKey: 'gamcheon_culture_village', triggerRadiusM: 200 },
    { stopNumber: 7, poiKey: 'jagalchi_market', triggerRadiusM: 150 },
    // stops 1 (pickup) & 4 (lunch) have no fixed venue — no geofence.
  ],
};

async function main(): Promise<void> {
  const slug = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
  const force = process.argv.includes('--force');
  if (!slug || !SPOT_SPECS[slug]) {
    console.error(`Usage: --slug=<one of: ${Object.keys(SPOT_SPECS).join(', ')}> [--force]`);
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const bundle = JSON.parse(
    readFileSync(path.join('data', 'tour-stop-content', `${slug}.json`), 'utf8'),
  ) as { stops: Array<{ number: number; name: string; content: Record<string, unknown> }> };

  const { data: page } = await supabase
    .from('tour_product_pages')
    .select('tour_id')
    .eq('slug', slug)
    .eq('locale', 'en')
    .single();
  if (!page?.tour_id) throw new Error(`No tour_id for slug ${slug}`);

  const { data: existing } = await supabase
    .from('tour_guide_spots')
    .select('id')
    .eq('tour_id', page.tour_id);
  if ((existing?.length ?? 0) > 0 && !force) {
    throw new Error(`tour ${page.tour_id} already has ${existing!.length} spots — rerun with --force to replace`);
  }
  if (force && (existing?.length ?? 0) > 0) {
    await supabase.from('tour_guide_spots').delete().eq('tour_id', page.tour_id);
  }

  const specs = SPOT_SPECS[slug];
  const rows = [];
  for (const [index, spec] of specs.entries()) {
    const stop = bundle.stops.find((s) => s.number === spec.stopNumber);
    if (!stop) throw new Error(`Bundle has no stop #${spec.stopNumber}`);
    const { data: poi } = await supabase
      .from('match_pois')
      .select('lat, lng')
      .eq('poi_key', spec.poiKey)
      .single();
    if (!poi?.lat || !poi?.lng) throw new Error(`match_pois has no coordinates for ${spec.poiKey}`);
    rows.push({
      tour_id: page.tour_id,
      title: stop.name,
      description: (stop.content.en as { description?: string } | undefined)?.description ?? null,
      latitude: Number(poi.lat),
      longitude: Number(poi.lng),
      trigger_radius_m: spec.triggerRadiusM,
      sort_order: index + 1,
      poi_key: spec.poiKey,
      content: stop.content,
    });
  }

  const { error } = await supabase.from('tour_guide_spots').insert(rows);
  if (error) throw error;
  for (const row of rows) {
    console.log(`  ✓ ${row.sort_order}. ${row.title} @ ${row.latitude},${row.longitude} r=${row.trigger_radius_m}m (${row.poi_key})`);
  }
  console.log(`Seeded ${rows.length} spots for ${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
