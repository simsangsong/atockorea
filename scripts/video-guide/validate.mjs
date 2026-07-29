#!/usr/bin/env node
/**
 * Continuity gate. Fails the build when the cut would visibly jump.
 *
 * v1 shipped with twelve timeline breaks inside single clips — including a
 * 25-second skip and two rewinds — plus three untransitioned clip joins. That
 * is the "툭 끊긴다" the client reported. Nothing catches this by eye at build
 * time, so it is checked here instead.
 *
 *   node scripts/video-guide/validate.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import { framing, contains } from './framing.mjs';

const TOLERANCE = 0.6;   // seconds of drift the eye forgives on a straight cut

const specPath = process.argv[2];
if (!specPath) { console.error('usage: validate.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const endOf = (b) => (b.kind === 'clip' ? b.out : b.at);
const startOf = (b) => (b.kind === 'clip' ? b.in : b.at);

const problems = [];
const notes = [];

for (let i = 1; i < spec.beats.length; i++) {
  const prev = spec.beats[i - 1], cur = spec.beats[i];
  const where = `${prev.id}→${cur.id}`;

  if (prev.src !== cur.src) {
    if (!cur.transition) {
      problems.push(`${where}  클립 전환 ${prev.src}→${cur.src} 인데 transition 이 없다`);
    } else {
      notes.push(`${where}  클립 전환 ${prev.src}→${cur.src}  (${cur.transition.kind} ${cur.transition.seconds}s)`);
    }
    continue;
  }

  const gap = +(startOf(cur) - endOf(prev)).toFixed(2);
  if (Math.abs(gap) <= TOLERANCE) continue;

  if (cur.transition) {
    notes.push(`${where}  ${gap > 0 ? '건너뜀' : '되감김'} ${Math.abs(gap)}s  (${cur.transition.kind} ${cur.transition.seconds}s 로 덮음)`);
  } else {
    problems.push(
      `${where}  ${prev.src}  ${gap > 0 ? '건너뜀' : '되감김'} ${Math.abs(gap)}s ` +
      `(${endOf(prev)} → ${startOf(cur)}) — transition 을 달거나 시각을 맞춰라`
    );
  }
}

// A freeze that hands off to motion must hand off on the SAME frame, otherwise the
// sped-up walk does not follow the direction the arrow just drew.
for (let i = 0; i < spec.beats.length - 1; i++) {
  const b = spec.beats[i], next = spec.beats[i + 1];
  if (b.kind !== 'arrow' || next.kind !== 'clip' || b.src !== next.src) continue;
  if (Math.abs(next.in - b.at) > 0.05) {
    problems.push(`${b.id}→${next.id}  화살표 정지(${b.at}s) 다음 클립이 ${next.in}s 에서 시작 — 화살표가 가리킨 방향으로 이어지지 않는다`);
  }
}

// Gate 2 — a close-up must never crop its own subject. v4 shipped four of them
// framed tighter than the thing they were framing, and start/end stills looked
// fine because each showed a different third of the statue.
for (const b of spec.beats) {
  if (b.kind !== 'closeup') continue;
  if (!b.focus) { problems.push(`${b.id}  closeup 인데 focus 사각형이 없다`); continue; }
  const f = framing(b.focus, { maxZoom: b.maxZoom });
  for (const [where, pt] of [['시작', f.start], ['끝', f.end]]) {
    if (!contains(b.focus, f, pt.x, pt.y)) {
      problems.push(`${b.id}  ${where} 프레임이 대상을 잘라먹는다 — 창 ${f.cw}x${f.ch}, 대상 ${b.focus[2]}x${b.focus[3]}`);
    }
  }
}

// Gate 3 — pacing. Real-speed stretches are for the two or three views worth
// standing still for; past 40% the whole thing drags, which is what "왜 이렇게
// 느려" meant.
let slow = 0, total = 0;
for (const b of spec.beats) {
  const d = b.kind === 'clip' ? (b.out - b.in) / (b.speed ?? 1) : b.hold;
  total += d;
  if (b.kind === 'clip' && (b.speed ?? 1) <= 1.05) slow += d;
  if (d > 20) problems.push(`${b.id}  한 비트가 ${d.toFixed(1)}초 — 20초를 넘는다`);
}
const slowPct = (slow / total) * 100;
if (slowPct > 40) problems.push(`1배속 구간이 ${slowPct.toFixed(0)}% — 40% 상한 초과 (${slow.toFixed(0)}s/${total.toFixed(0)}s)`);
else notes.push(`페이싱  1배속 ${slowPct.toFixed(0)}% · 전체 ${Math.round(total)}s`);

for (const n of notes) console.log(`  ok   ${n}`);
if (problems.length) {
  console.error(`\n연속성 게이트 실패 — ${problems.length}건\n`);
  for (const p of problems) console.error(`  FAIL ${p}`);
  process.exit(1);
}
console.log(`\n연속성 게이트 통과 — 비트 ${spec.beats.length}개, 미처리 점프 0`);
