/**
 * A1/A2 harness — run the real arrival pipeline over the LIVE curated rows.
 *
 *   npx tsx scripts/qa-spot-narration.ts
 *
 * Unit tests use fixtures, which is exactly how the markdown problem hid: the
 * live briefings are written for the eye (`**bold**`, links, headings) and a
 * speech engine reads those marks out loud. This resolves each spot for a
 * mixed-language room, packs it the way the routes do, picks it the way each
 * guest's feed does, and prints what the voice will actually say.
 *
 * Read-only. Exits 2 when nothing was checked, so an empty pass can never be
 * mistaken for a clean one.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import {
  composeSpotNarration,
  packSpotContent,
  pickSpotContent,
  resolveSpotContentForLocales,
} from '../lib/tour-room/spotContent';
import { ROOM_LOCALES, type RoomLocale } from '../lib/tour-room/snapshot';
import { withMatchPoiContent } from '../lib/tour-room/poiContent.server';

config({ path: '.env.local' });
config({ path: '../../../.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** A deliberately mixed room: covered, uncovered, and CJK locales together. */
const ROOM: RoomLocale[] = ['ko', 'en', 'ja', 'fr', 'de'];

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await db.from('tour_guide_spots').select('title, content, poi_key').order('title');
  if (error) throw error;
  const spots = data ?? [];
  if (spots.length === 0) {
    console.error('No tour_guide_spots rows — nothing was verified.');
    process.exit(2);
  }

  let problems = 0;
  let silent = 0;
  let wireMax = 0;

  for (const spot of spots) {
    const byLocale = resolveSpotContentForLocales(spot as never, ROOM);
    const pack = packSpotContent(byLocale);
    if (!pack) {
      silent += 1;
      console.log(`\n■ ${spot.title}\n  (no content in any tier — arrival says only the template line)`);
      continue;
    }
    const meta = { kind: 'spot_arrival', ...pack } as Record<string, unknown>;
    const wireKb = JSON.stringify(pack).length / 1024;
    wireMax = Math.max(wireMax, wireKb);

    console.log(`\n■ ${spot.title}`);
    console.log(`  languages on the wire: ${Object.keys(pack.content_by_lang).join(', ')} — ${wireKb.toFixed(1)} KB`);
    console.log(`  locale → voice: ${JSON.stringify(pack.content_langs)}`);

    for (const locale of ROOM) {
      const picked = pickSpotContent(meta, locale);
      if (!picked) {
        console.log(`    [${locale}] NOTHING TO SHOW`);
        problems += 1;
        continue;
      }
      const spoken = composeSpotNarration(picked.content);
      const flags: string[] = [];
      if (!spoken) flags.push('SILENT');
      if (/\*\*|`|^#|\]\(/m.test(spoken)) flags.push('MARKDOWN LEAKED');
      if (spoken.length > 1200) flags.push('OVER BUDGET');
      if (flags.length) problems += 1;
      console.log(
        `    [${locale}] voice=${picked.lang} ${spoken.length} chars ${flags.length ? `❌ ${flags.join(', ')}` : '✅'}`,
      );
      if (locale === 'ko' || locale === 'fr') console.log(`        “${spoken.slice(0, 130)}…”`);
    }
  }

  console.log(
    `\n${spots.length} spots · ${silent} with no content · largest wire payload ${wireMax.toFixed(1)} KB · ${problems} problems`,
  );
  console.log(`(room locales checked: ${ROOM.join(', ')} of ${ROOM_LOCALES.length} supported)`);

  // A3 — coverage across the POI master, i.e. every stop a private charter can
  // pick. This is the number that decides whether a driver-only tour is guided
  // or silent, and it is the reason the match_pois tier exists.
  const { data: allPois } = await db.from('match_pois').select('poi_key').order('poi_key');
  const keys = ((allPois ?? []) as Array<{ poi_key: string }>).map((r) => r.poi_key);
  const byTier: Record<string, number> = {};
  const spoken: Record<string, number> = {};
  const native: Record<string, number> = {};
  for (const key of keys) {
    const base = resolveSpotContentForLocales({ title: key, content: null, poi_key: key }, ROOM);
    const merged = await withMatchPoiContent(db as never, key, ROOM, base);
    const tier = merged.en?.tier ?? merged[ROOM[0]]?.tier ?? 'none';
    byTier[tier] = (byTier[tier] ?? 0) + 1;
    for (const locale of ROOM) {
      const entry = merged[locale];
      if (!composeSpotNarration(entry?.content)) continue;
      spoken[locale] = (spoken[locale] ?? 0) + 1;
      // Falling back to English still says something, but it is NOT the guest's
      // language — counting the two together would flatter the number.
      if (entry?.lang === locale) native[locale] = (native[locale] ?? 0) + 1;
    }
  }
  // A5 — what is written but withheld. Without this line the coverage table
  // below reads as "French is at 0%" with no hint that 114 briefings exist and
  // are one approval away, which is the opposite of the useful reading.
  const { data: gateRows } = await db
    .from('match_pois')
    .select('poi_key, content_locales, content_locale_status');
  const pendingByLocale: Record<string, number> = {};
  for (const row of (gateRows ?? []) as Array<{
    poi_key: string;
    content_locales: Record<string, unknown> | null;
    content_locale_status: Record<string, string> | null;
  }>) {
    if (row.poi_key.startsWith('_')) continue;
    for (const locale of Object.keys(row.content_locales ?? {})) {
      if ((row.content_locale_status ?? {})[locale] !== 'approved') {
        pendingByLocale[locale] = (pendingByLocale[locale] ?? 0) + 1;
      }
    }
  }
  const pendingTotal = Object.values(pendingByLocale).reduce((a, b) => a + b, 0);
  if (pendingTotal > 0) {
    console.log(`\n── 검수 대기 (A4 게이트가 보류 중 · /admin/poi-content-locales) ──`);
    for (const [locale, n] of Object.entries(pendingByLocale).sort((a, b) => b[1] - a[1])) {
      console.log(`  [${locale}] ${n} POI 대기`);
    }
  }

  console.log(`\n── POI master coverage (${keys.length} stops a charter can pick) ──`);
  console.log(`  tier: ${JSON.stringify(byTier)}`);
  for (const locale of ROOM) {
    const n = spoken[locale] ?? 0;
    const own = native[locale] ?? 0;
    const pct = (v: number) => `${Math.round((v / keys.length) * 100)}%`;
    console.log(
      `  [${locale}] speaks at ${n}/${keys.length} stops (${pct(n)}) — ${own} in ${locale} (${pct(own)}), ${n - own} falling back to English`,
    );
  }

  if (problems > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
