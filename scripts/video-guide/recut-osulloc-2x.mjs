#!/usr/bin/env node
/**
 * Osulloc Tea Museum — §2 re-cut of the four beats still above 2x.
 *
 *   node scripts/video-guide/recut-osulloc-2x.mjs [--dry-run]
 *
 * The other four over-2x beats in this spec were short enough to play whole at
 * 2x and were handled by `slow-to-2x.mjs`. These four are not: at 2x they would
 * each run past the 5.2s on-screen cap, so holding their screen time means
 * choosing which seconds of source to drop.
 *
 * 🔴 §6 requires those positions be chosen while LOOKING at the footage — a
 * mechanical equal-interval pass was run once and reverted on the owner's
 * instruction. Every window below was picked off a contact sheet of its own
 * source range (`scripts/video-guide/beat-sheet.mjs <slug> <beatId>`), and the
 * note on each line is what that sheet actually showed.
 *
 * None of these four spans touches a measured turn — checked against
 * `osulloc-tea-museum.turns.json` before cutting. G's turns are at 0–2.3 and
 * 4.9–7.3, all before beat 36 begins; H's first is at 26.4, long after beat 41
 * ends. So the choice here was only ever "which stretch is dull", never "may I
 * cut here".
 *
 * Shape per §2: first slice keeps the beat's original `in`, last keeps its
 * original `out`, both joins with the neighbouring beats untouched, and the
 * dropped middle is covered by a 0.8s dissolve. No slice is shorter on screen
 * than that dissolve.
 */
import fs from 'node:fs';
import path from 'node:path';

const SPEC = path.join(process.cwd(), 'docs', 'video-specs', 'osulloc-tea-museum.json');
const DRY = process.argv.includes('--dry-run');

const RECUT = {
  // 7.3–9.6 is near-black — the lens is still behind the dark door reveal — but
  // that is the pinned `in`, so it stays. The drop is the stretch where a hand
  // crosses the lens (15.4) and the hedge-lined path then repeats itself almost
  // frame for frame. Kept: the door opening onto the garden and the glass
  // "TEA STONE" lettering, then the final approach.
  '36': { slices: [[7.3, 15.0], [17.93, 20.0]] },
  // A man stands reading a signboard from 25.5 and the camera passes so close
  // at ~27.6 that his shoulder fills the left third. That pass-by is the drop.
  // Kept: the approach along the glass facade, him at the sign, and the arrival
  // at the wooden pavilion which the next beat opens on.
  '37': { slices: [[20.0, 27.0], [29.77, 32.0]] },
  // The TEA BAR pavilion is the payoff and it lands early (32–36), so the head
  // is untouchable. 40.0–42.7 is the same shaded path three times over — that
  // is the drop — and the last slice re-joins for the curve into the trees.
  '38': { slices: [[32.0, 39.9], [42.78, 44.5]] },
  // Inverse shape: the dull part is the HEAD here — five near-identical frames
  // of the café terrace and its tables (8.0–13.2) — and the payoff is the whole
  // INNISFREE JEJU HOUSE arrival from 15.3 to the door at 19.4. So the drop sits
  // early and the second slice carries almost the whole beat.
  '41': { slices: [[8.0, 10.5], [12.4, 19.4]] },
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
