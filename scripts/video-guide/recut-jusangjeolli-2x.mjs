#!/usr/bin/env node
/**
 * Daepo Jusangjeolli Cliff — §2 re-cut of the six beats still above 2x.
 *
 *   node scripts/video-guide/recut-jusangjeolli-2x.mjs [--dry-run]
 *
 * The other four over-2x beats fitted under the 5.2s cap at 2x and were handled
 * by `slow-to-2x.mjs`. These six do not: holding their screen time at 2x means
 * choosing which seconds of source to lose.
 *
 * 🔴 This spec is the one with the precedent. Its v2 was REJECTED by the owner
 * because v1's cuts had thrown away four measured turns — the ocean sweep from
 * the first stairs, the lava-rock-and-horizon sweep, the "→10m toilet" sign, and
 * a distant deck sweep pushed to 5x. §6 therefore requires slice positions be
 * chosen while LOOKING at the footage. Every window below came off a contact
 * sheet of its own source range (`beat-sheet.mjs daepo-jusangjeolli-cliff <id>`)
 * and each note says what that sheet showed.
 *
 * 🔴 Checked against `daepo-jusangjeolli-cliff.turns.json` first: all six beats
 * have a measured turn ENDING at their `in` and another STARTING at their `out`
 * — the beats were cut at turn boundaries in the first place — and turn-free
 * interiors. §2's rule that the first slice keeps `in` and the last keeps `out`
 * therefore protects every turn on its own. No cut here lands in one.
 *
 * The consistent shape of this footage: the sightseeing is at one end of a beat
 * and the other end is people's backs on a crowded boardwalk. So the drops are
 * the transit, and what survives is the rock, the sea, and the joins.
 */
import fs from 'node:fs';
import path from 'node:path';

const SPEC = path.join(process.cwd(), 'docs', 'video-specs', 'daepo-jusangjeolli-cliff.json');
const DRY = process.argv.includes('--dry-run');

const RECUT = {
  // Souvenir stall street. Only 0.96s has to go, and the sheet offers exactly
  // one candidate: at ~26.6 a passer-by's head and shoulder fill the centre of
  // frame. Dropping precisely that leaves the stalls, the signage and both
  // joins untouched.
  '07': { slices: [[20.8, 26.1], [27.06, 31.4]] },
  // Opens on the cove — turquoise water, pine headland, rock stacks — and ends
  // among people coming the other way down the boardwalk. 103.7–105.4 is a
  // close rock face, then 107–113.9 is pure crowded transit with a couple
  // filling the frame at the end. Keep the sea, keep the arrival, drop the walk.
  '31': { slices: [[95.3, 100.94], [112.1, 113.9]] },
  // The signature: columnar basalt against deep blue at 12–15.5. After that the
  // camera falls in behind a queue and at ~20.7 a man's back fills the entire
  // frame. Keep the basalt, keep the final deck, drop nine seconds of backs.
  '35': { slices: [[10.3, 16.0], [27.46, 29.4]] },
  // A crowded viewpoint, then a stair climb where a couple stops to pose and
  // blocks the lens (61.6–63.7), then the sea opening through the pines at 67.9.
  // The reveal is the point of the beat; the posing is not.
  '40': { slices: [[58.5, 60.2], [66.59, 70.0]] },
  // 🔴 Three slices, not two — and this one is the reason to look rather than
  // halve. The dull stretches are on BOTH sides of a coastal rock view that
  // opens at ~84.5, so a single middle cut would have thrown that view away,
  // which is precisely what the v2 rejection was about. Kept: the entry steps,
  // the rock view, the arrival at the garden. Dropped: two stretches of shaded
  // boardwalk, one of them with a bucket hat filling half the frame at 89.8.
  '41': { slices: [[78.0, 80.5], [84.0, 86.0], [89.7, 92.4]] },
  // Ends on the sea opening past the lava rock at 112.4 — that is the payoff and
  // it lands in the last second. The middle is the rock-garden path behind other
  // walkers. Keep the head join and the whole reveal.
  '43': { slices: [[101.8, 104.6], [109.38, 113.4]] },
};

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const out = [];
const log = [];

for (const beat of spec.beats) {
  const plan = RECUT[beat.id];
  if (!plan || beat.kind !== 'clip') { out.push(beat); continue; }

  const before = +((beat.out - beat.in) / beat.speed).toFixed(3);
  const { slices } = plan;
  const screen = slices.reduce((a, [i, o]) => a + (o - i) / 2, 0);

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
  log.push(
    `  ${String(beat.id).padEnd(4)} ${beat.speed}x → 2x ×${slices.length}  화면 ${before}s → ${screen.toFixed(2)}s`
    + `  · 버린 소스 ${dropped.toFixed(2)}s`,
  );
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
