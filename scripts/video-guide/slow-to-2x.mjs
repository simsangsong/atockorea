#!/usr/bin/env node
/**
 * Bring every over-2x beat that ALREADY FITS down to the standard's 2x cap.
 *
 *   node scripts/video-guide/slow-to-2x.mjs [<slug> …] [--apply]
 *
 * §1 of the standard (사장님 승인 2026-08-04) is absolute: **2x 초과 금지**. The
 * old 4–8x transits are what produced the "휙휙 돌아가는 빨리감기" complaint.
 *
 * 🔴 This script deliberately does only the half of that job that needs no
 * judgment.
 *
 * §6 records that a mechanical equal-interval slicing pass was run once and
 * REVERTED on the owner's instruction, because slice positions have to be
 * chosen while looking at the footage — the Jusangjeolli v2 rejection lists
 * four measured turns a blind pass had thrown away. So this touches nothing
 * that requires choosing what to discard.
 *
 * The split is arithmetic, not taste. Dropping a beat from 2.6x to 2x makes it
 * longer on screen; §1 also caps a beat at 5.2s of screen time. So:
 *
 *   span / 2 <= 5.2s   → the beat plays whole at 2x. Nothing is dropped,
 *                        nothing is dissolved, `in` and `out` do not move.
 *                        That is strictly better than a cut (recut-yonggungsa
 *                        §2 says so) and it is safe to do without eyes.
 *   span / 2  > 5.2s   → compressing it means choosing which seconds to lose.
 *                        LEFT ALONE, listed as remaining work.
 *
 * Because `in`/`out` never move, beats followed by a held polaroid/freeze stay
 * aligned (§2: "뒤에 held 비트가 붙는 비트는 out 을 움직이지 마라").
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'docs', 'video-specs');
const CAP_SCREEN_SECONDS = 5.2;
const APPLY = process.argv.includes('--apply');

const slugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = slugs.length
  ? slugs
  : readdirSync(DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.turns.json'))
      .map((f) => f.replace(/\.json$/, ''));

let slowed = 0;
let left = 0;

for (const slug of targets) {
  const file = path.join(DIR, `${slug}.json`);
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  const beats = spec.beats ?? [];
  const changed = [];
  const remaining = [];

  for (const beat of beats) {
    const speed = Number(beat.speed);
    if (!(speed > 2)) continue;
    const span = Number(beat.out) - Number(beat.in);
    if (!Number.isFinite(span) || span <= 0) continue;
    const screenAt2x = span / 2;
    if (screenAt2x <= CAP_SCREEN_SECONDS) {
      changed.push({ id: beat.id ?? '?', from: speed, screen: screenAt2x });
      beat.speed = 2;
    } else {
      remaining.push({ id: beat.id ?? '?', from: speed, span, screen: screenAt2x });
    }
  }

  slowed += changed.length;
  left += remaining.length;
  if (changed.length === 0 && remaining.length === 0) continue;

  console.log(`\n${slug}`);
  for (const c of changed) {
    console.log(`  2x 로 늦춤  ${String(c.id).padEnd(5)} ${c.from}x → 2x  (화면 ${c.screen.toFixed(1)}s)`);
  }
  for (const r of remaining) {
    console.log(
      `  남김        ${String(r.id).padEnd(5)} ${r.from}x  원본 ${r.span.toFixed(1)}s → 2x 면 화면 ${r.screen.toFixed(1)}s (상한 ${CAP_SCREEN_SECONDS}s 초과 — 재단 필요)`,
    );
  }

  if (APPLY && changed.length) writeFileSync(file, `${JSON.stringify(spec, null, 2)}\n`);
}

console.log(
  `\n${APPLY ? '적용' : '계획 (실행하려면 --apply)'} — 2x 로 늦춤 ${slowed} · 눈으로 재단해야 하는 것 ${left}`,
);
