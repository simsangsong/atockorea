/**
 * 🔴 A stop's `_poi_meta.poi_key` is what the smart app resolves arrival content
 * from, and it is what tells you which real place a stop card is about. When it
 * is wrong, the page still renders perfectly.
 *
 * The defect this gate is for, live until 2026-08-07 on the $265
 * `busan-private-car-charter-cruise-shore`:
 *
 *   0 OPS_busan_cruise_pickup   Pickup at Busan Cruise Port
 *   1 OPS_route_planning        Route planning with your guide   ← UN Cemetery
 *   2 taejongdae                East coast highlights option
 *   3 OPS_busan_lunch           History, village and downtown option
 *   4 OPS_busan_cruise_return   Return to Busan Cruise Port      ← Gamcheon
 *   5 yongdusan_park            Yongdusan Park & Busan Tower
 *   6 jagalchi_market           Nampo-dong & Jagalchi Fish Market
 *   7 OPS_busan_cruise_return   Return to Busan Cruise Terminal
 *
 * An older route MENU had been half-merged over the real course in English:
 * names, times and the first three highlights came from the menu, the rest of
 * each stop was the real place. Guests reading English met the tour ENDING at
 * stop 4, with two more stops under it. Five other locales held the real course
 * all along, so nothing in the repo disagreed loudly enough to notice.
 *
 * THE INVARIANT. `OPS_busan_cruise_return` appears at index 4 AND index 7. A
 * poi_key may repeat only when the day starts and ends in the same place — a
 * round trip. A repeat anywhere else means one of the two stops is mislabelled,
 * and the arrival resolver will serve the wrong content for it.
 *
 * Measured over every bundle: 12 legitimate round trips (all
 * `jeju_cruise_port` at first-and-last), and — after the Busan repair — zero
 * other repeats. So this is a hard zero, not a ratchet.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'components', 'product-tour-static');

type Repeat = { file: string; key: string; at: number[]; length: number };

/** A repeat is legitimate only as the first and last stop of the same day. */
export function findIllegalRepeats(keys: (string | null)[]): { key: string; at: number[] }[] {
  const pos = new Map<string, number[]>();
  keys.forEach((k, i) => {
    if (!k) return;
    pos.set(k, [...(pos.get(k) ?? []), i]);
  });
  const out: { key: string; at: number[] }[] = [];
  for (const [key, at] of pos) {
    if (at.length < 2) continue;
    const roundTrip = at.length === 2 && at[0] === 0 && at[1] === keys.length - 1;
    if (!roundTrip) out.push({ key, at });
  }
  return out;
}

function scan(): { repeats: Repeat[]; roundTrips: number; files: number } {
  const repeats: Repeat[] = [];
  let roundTrips = 0;
  let files = 0;

  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name === 'catalog') continue;
    for (const f of fs.readdirSync(path.join(ROOT, dir.name))) {
      if (!f.endsWith('.json')) continue;
      let doc: { itineraryStops?: { _poi_meta?: { poi_key?: string } }[] };
      try {
        doc = JSON.parse(fs.readFileSync(path.join(ROOT, dir.name, f), 'utf8'));
      } catch {
        continue;
      }
      const stops = doc.itineraryStops;
      if (!Array.isArray(stops) || stops.length === 0) continue;
      files += 1;
      const keys = stops.map((s) => s?._poi_meta?.poi_key ?? null);
      const seen = new Set(keys.filter(Boolean) as string[]);
      if (seen.size < keys.filter(Boolean).length) {
        const illegal = findIllegalRepeats(keys);
        roundTrips += keys.filter(Boolean).length - seen.size - illegal.reduce((n, r) => n + r.at.length - 1, 0);
        for (const r of illegal) repeats.push({ file: f, key: r.key, at: r.at, length: keys.length });
      }
    }
  }
  return { repeats, roundTrips, files };
}

describe('a stop must not claim another stop’s place', () => {
  const { repeats, roundTrips, files } = scan();

  it('reads the bundles at all (guards a silently-empty scan)', () => {
    // A scan that measures nothing reports a cheerful zero. Prove it ran.
    expect(files).toBeGreaterThan(100);
    expect(roundTrips).toBeGreaterThan(0);
  });

  it('no poi_key repeats outside a first-and-last round trip', () => {
    expect(
      repeats.map((r) => `${r.file} :: ${r.key} at [${r.at.join(', ')}] of ${r.length} stops`),
    ).toEqual([]);
  });

  it('catches the Busan charter shape that was live, and spares a round trip', () => {
    // Verbatim key order from the bundle before the 2026-08-07 repair.
    expect(
      findIllegalRepeats([
        'OPS_busan_cruise_pickup',
        'OPS_route_planning',
        'taejongdae',
        'OPS_busan_lunch',
        'OPS_busan_cruise_return',
        'yongdusan_park',
        'jagalchi_market',
        'OPS_busan_cruise_return',
      ]),
    ).toEqual([{ key: 'OPS_busan_cruise_return', at: [4, 7] }]);

    // …and the Jeju shape, which is a genuine round trip, stays legal.
    expect(
      findIllegalRepeats(['jeju_cruise_port', 'seongsan_ilchulbong', 'seopjikoji', 'jeju_cruise_port']),
    ).toEqual([]);

    // A stop with no key is not a match for another stop with no key.
    expect(findIllegalRepeats([null, null, 'a', null])).toEqual([]);
  });
});
