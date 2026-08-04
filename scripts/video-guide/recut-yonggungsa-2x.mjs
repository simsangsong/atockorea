#!/usr/bin/env node
/**
 * Haedong Yonggungsa — §6 re-cut of the 17 beats that ran above 2x.
 *
 *   node scripts/video-guide/recut-yonggungsa-2x.mjs [--dry-run]
 *
 * The standard's §1 caps playback at 2x and §2 says to compress by CUTTING,
 * not by spinning the picture faster. This spec was the old 4-8x grammar: 454s
 * of walking squeezed into 67s of screen. Holding that 67s while dropping to
 * 2x means only 133s of the footage can survive, so this is not a re-timing —
 * it is choosing which two thirds of the walking to throw away.
 *
 * 🔴 The slice table below is written out beat by beat on purpose. §6 records
 * that a mechanical equal-interval pass was run once and reverted on the
 * owner's instruction, and it requires the positions be chosen while looking at
 * the footage. Every window here was checked against a contact sheet of its own
 * source range; the note on each line is what that sheet showed.
 *
 * The shape is the one §2 fixes: the first slice keeps the beat's original `in`
 * and the last keeps its original `out`, so both joins with the neighbouring
 * beats are untouched, and the jump in the middle is covered by a 0.8s
 * dissolve. Beats short enough to play whole at 2x within the 5.2s on-screen
 * cap are simply slowed to 2x — nothing is dropped and nothing is dissolved,
 * which is always better than an unnecessary cut.
 */
import fs from 'node:fs';
import path from 'node:path';

const SPEC = path.join(process.cwd(), 'docs', 'video-specs', 'haedong-yonggungsa.json');
const DRY = process.argv.includes('--dry-run');

/**
 * `whole` — play the original span at 2x; it fits under the on-screen cap.
 * `slices` — explicit [in, out] source windows, all played at 2x, joined by
 * dissolves. Their total screen time equals the beat's original screen time.
 */
const RECUT = {
  // The market approach. Head is the stall street at its busiest, tail is the
  // row of zodiac guardians the next beat names; the dropped middle is the
  // long stretch of identical awnings with a parasol across the lens at ~37s.
  '02': { slices: [[4.5, 11.873], [21.5, 28.873], [85.627, 93]] },
  // Short spans — whole at 2x, nothing dropped.
  '03': { whole: true },   // 7.0s → 3.5s on screen
  '19b': { whole: true },  // 10.1s → 5.05s on screen
  '21': { whole: true },   // 6.0s → 3.0s on screen
  '31': { whole: true },   // 8.0s → 4.0s on screen
  // Head is the white stone figure, tail is the carved stele this beat is
  // named for. The middle is a solid wall of visitors.
  '07': { slices: [[106, 108.75], [114.25, 117]] },
  // Stele → the pagoda and bell pavilion at the gate. Middle is crowd.
  '09': { slices: [[117, 120.333], [133.667, 137]] },
  // 🔴 The head here is the temple's signature shot — the painted one-pillar
  // gate with the dragon column and the Gwaneum stele. Tail is the bamboo the
  // passage opens onto. Both slice edges land inside measured pan windows
  // (turns.mjs: 169.4–173.3, 173.9–176.3).
  '11': { slices: [[139, 143.488], [170.413, 174.9]] },
  // Lantern row at the top, then the coast opening up below. The dropped
  // middle carries two people crossing the lens. Tail is fixed by the
  // polaroid that follows. Head edge sits in the 182.9–185.3 pan window.
  '13': { slices: [[180, 184.75], [213.25, 218]] },
  // Rock shelf: boardwalk down to the sea, then the shelf itself. The parasol
  // that fills the frame at ~4.5s falls in the dropped middle.
  '15': { slices: [[0, 2.25], [15.75, 18]] },
  '17': { slices: [[0, 2.5], [17.5, 20]] },
  // Up to the main hall: stone gate, then the lantern canopy over the hall.
  // Both edges of the tail slice land in measured pans (78.4–80.8, 85.4–87.8).
  // The dropped middle is a blank granite retaining wall.
  '20': { slices: [[44.1, 51.083], [79.017, 86]] },
  '22': { slices: [[100, 103.038], [121.263, 124.3]] },
  '22c': { slices: [[141.5, 143.813], [157.688, 160]] },
  // A stair climb that looks the same the whole way up — no payoff to protect,
  // so the anchored head and tail are as good as any other pair.
  '24': { slices: [[166, 169.375], [189.625, 193]] },
  // Arrival at the Haesu Gwaneum statue. Tail is fixed by the polaroid.
  '25': { slices: [[193, 197], [205, 209]] },
  // 🔴 The clearest case for cutting over speeding: the middle of this descent
  // is the temple's back yard — a car park with a flatbed truck, a generator
  // and a plywood hoarding, ~24s of it. Head is the pine path down, tail is
  // the ochre hall wall. The head edge lands in the 232.4–234.8 pan window.
  '28': { slices: [[226, 234], [282, 290]] },
};

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const out = [];
const log = [];

for (const beat of spec.beats) {
  const plan = RECUT[beat.id];
  if (!plan || beat.kind !== 'clip') { out.push(beat); continue; }

  const before = +((beat.out - beat.in) / beat.speed).toFixed(3);

  if (plan.whole) {
    out.push({ ...beat, speed: 2 });
    log.push(`  ${beat.id.padEnd(4)} ${beat.speed}x → 2x 통째  화면 ${before}s → ${+((beat.out - beat.in) / 2).toFixed(2)}s`);
    continue;
  }

  const { slices } = plan;
  const screen = slices.reduce((a, [i, o]) => a + (o - i) / 2, 0);
  // The first slice inherits everything the beat carried — its title, chapter,
  // stopLabel, and the motioncut verdict for a join this re-cut does not move.
  // Later slices carry only what they need; the dissolve is what exempts their
  // boundary from gate E-4, and a stale `snapped` would claim a measurement
  // nobody made for the new edge.
  slices.forEach(([i, o], n) => {
    if (n === 0) {
      out.push({ ...beat, in: i, out: o, speed: 2 });
    } else {
      out.push({
        id: `${beat.id}s${n}`,
        kind: 'clip',
        src: beat.src,
        in: i,
        out: o,
        speed: 2,
        title: `${beat.title} (cont.)`,
        transition: { kind: 'dissolve', seconds: 0.8 },
      });
    }
  });
  const dropped = (beat.out - beat.in) - slices.reduce((a, [i, o]) => a + (o - i), 0);
  log.push(`  ${beat.id.padEnd(4)} ${beat.speed}x → 2x ×${slices.length}  화면 ${before}s → ${screen.toFixed(2)}s`
    + `  · 버린 소스 ${dropped.toFixed(1)}s`);
}

const screenOf = (bs) => bs.reduce((a, b) => a + (b.kind === 'clip' ? (b.out - b.in) / (b.speed ?? 1) : b.hold), 0);
console.log('재단 결과 (표준 문법 §2)');
log.forEach((l) => console.log(l));
console.log(`\n  비트 ${spec.beats.length} → ${out.length}`);
console.log(`  러닝타임 ${Math.round(screenOf(spec.beats))}s → ${Math.round(screenOf(out))}s`);
console.log(`  2배속 초과 비트 ${out.filter((b) => b.kind === 'clip' && (b.speed ?? 1) > 2).length}`);

if (DRY) { console.log('\n드라이런이다. 쓰려면 --dry-run 을 빼라.'); process.exit(0); }
spec.beats = out;
fs.writeFileSync(SPEC, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`\n${SPEC} 갱신 완료.`);
