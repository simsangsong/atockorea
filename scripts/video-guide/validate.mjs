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
import path from 'node:path';
import { framing, contains } from './framing.mjs';
import { timelineOf, stopsOf, roleOf, outDurOf } from './lib/timeline.mjs';

const TOLERANCE = 0.6;   // seconds of drift the eye forgives on a straight cut

const specPath = process.argv[2];
if (!specPath) { console.error('usage: validate.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const endOf = (b) => (b.kind === 'clip' ? b.out : b.at);
const startOf = (b) => (b.kind === 'clip' ? b.in : b.at);

const problems = [];
const notes = [];

// Gate 0 — every source file must exist on disk. Reorganising the footage
// drive (2026-08-01) silently orphaned two shipped specs; nothing would have
// failed until deep inside a render.
if (spec.sourceDir && spec.sources) {
  for (const [key, file] of Object.entries(spec.sources)) {
    const p = path.join(spec.sourceDir, file);
    if (!fs.existsSync(p)) {
      problems.push(`source ${key}  ${p} 가 없다 — sourceDir 이동·재순번 여부부터 확인하라`);
    }
  }
}

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

// Gate 1b — a dissolve needs room on BOTH sides. build.mjs silently skips the
// join when either neighbour's on-screen duration is shorter than the dissolve
// (Manjanggul beat 29: 0.64s beat vs 0.8s dissolve — the J→K join shipped as a
// hard cut and only a log-list diff caught it).
for (let i = 0; i < spec.beats.length; i++) {
  const b = spec.beats[i];
  const s = b.transition?.seconds;
  if (!s) continue;
  const durOf = (x) => (x.kind === 'clip' ? (x.out - x.in) / (x.speed ?? 1) : x.hold);
  if (durOf(b) < s) problems.push(`${b.id}  화면 ${durOf(b).toFixed(2)}s < 디졸브 ${s}s — 빌드가 조용히 스킵한다`);
  const prev = spec.beats[i - 1];
  if (prev && durOf(prev) < s) problems.push(`${prev.id}→${b.id}  앞 비트 ${durOf(prev).toFixed(2)}s < 디졸브 ${s}s — 이음새가 앞 비트를 다 먹는다`);
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

// Gate 3b — no unbroken fast run past 5s on screen (V6-D17/D18). The drag is
// never the speed, it is the LENGTH of one continuous sped-up run: on Gamcheon
// thirteen runs near 3s read fine and four at 6.7-8.6s were the whole complaint.
// Break the long one on a turn (turns.mjs); do not just raise the speed, past 8x
// the picture strobes.
const FAST_MAX = 5.2;
for (const b of spec.beats) {
  if (b.kind !== 'clip' || (b.speed ?? 1) < 2) continue;
  const out = (b.out - b.in) / b.speed;
  if (out > FAST_MAX) {
    problems.push(`${b.id}  고속 구간이 끊기지 않고 ${out.toFixed(1)}s — ${FAST_MAX}s 상한 초과`
      + ` (turns.mjs 로 회전에서 쪼개라)`);
  }
}

// Gate 3c — turns must play at real speed (V6-D18). A swing is the moment the
// shooter decided to look at something; sped up it is a whip-pan, which is what
// "휙휙 고개꺾인다" meant. Any beat marked `turn` is 1x with its approach and
// settle intact — a turn cut tight to the swing reads as a glitch.
for (const b of spec.beats) {
  if (!b.turn) continue;
  if ((b.speed ?? 1) > 1.05) problems.push(`${b.id}  회전 비트인데 ${b.speed}배속 — 회전은 1배속이다`);
  if ((b.out - b.in) < 2.0) problems.push(`${b.id}  회전 비트가 ${(b.out - b.in).toFixed(1)}s — 전후 여유가 없다(최소 2.0s)`);
}

// Gate E-4 — cut on motion. Every boundary between two moving beats of the same
// recording must have been through motioncut.mjs: either snapped to a measured
// pan, or explicitly marked steady with the measured ceiling. An unmarked
// boundary means nobody looked.
for (let i = 1; i < spec.beats.length; i++) {
  const prev = spec.beats[i - 1], cur = spec.beats[i];
  if (prev.kind !== 'clip' || cur.kind !== 'clip') continue;
  if (prev.src !== cur.src || cur.transition) continue;
  if (!cur.snapped && !cur.nosnap) {
    problems.push(`${prev.id}→${cur.id}  모션 컷 미판정 — motioncut.mjs 를 돌려라`);
  }
}

// Gate E-1 (spec side) — the presbyopia floor is a reading-time budget, not
// just a font size. A line nobody can finish is the same as no line.
const CHARS_PER_SEC = 12, MIN_HOLD = 2.8, TITLE_MAX = 44, CAPTION_MAX = 58;
for (let bi = 0; bi < spec.beats.length; bi++) {
  const b = spec.beats[bi];
  const role = roleOf(b);
  if (role !== 'stop' && role !== 'title') continue;
  const title = b.stopLabel?.title ?? b.title ?? '';
  const caption = b.caption ?? '';
  // A dissolve on the NEXT beat eats this beat's tail — the polaroids before
  // the recording joins showed their line for 2.0s while the spec said 2.8.
  const eaten = spec.beats[bi + 1]?.transition?.seconds ?? 0;
  const shown = (b.kind === 'clip' ? outDurOf(b) : b.hold) - eaten;
  if (title.length > TITLE_MAX) problems.push(`${b.id}  타이틀 ${title.length}자 > ${TITLE_MAX}`);
  if (caption.length > CAPTION_MAX) problems.push(`${b.id}  캡션 ${caption.length}자 > ${CAPTION_MAX}`);
  if (caption) {
    const need = Math.max(MIN_HOLD, caption.length / CHARS_PER_SEC);
    if (shown + 0.01 < need) {
      problems.push(`${b.id}  캡션 ${caption.length}자는 ${need.toFixed(1)}s 필요한데 ${shown.toFixed(1)}s 만 보인다`);
    }
  }
}

// Gate E-3 — burned numerals must be measurements, never authored. Transit
// chips, the promise line and the recap line are generated from the spec's
// own timecode; anything hand-typed with a unit is an invented fact.
for (const b of spec.beats) {
  const role = roleOf(b);
  if (role !== 'stop' && role !== 'title') continue;
  for (const s of [b.stopLabel?.title, b.stopLabel?.sub, b.title, b.sub, b.caption]) {
    if (s && /\d+\s*(min|sec|km|mi|meter|minute|hour)\b/i.test(s)) {
      problems.push(`${b.id}  숫자+단위가 손으로 적혔다: "${s}" — 수치는 계산 필드에서만`);
    }
  }
}

// Gate E-2 — the hook. The claim lands first and the whole prologue stays
// inside twelve seconds; the promise follows before eighteen.
{
  const tl = timelineOf(spec);
  const first = spec.beats[0];
  if (roleOf(first) !== 'title') problems.push(`첫 비트가 클레임 타이틀이 아니다 (role=${roleOf(first)})`);
  const promiseIdx = spec.beats.findIndex((b) => roleOf(b) === 'promise');
  if (promiseIdx < 0) problems.push('약속(promise) 비트가 없다');
  else {
    const coldOpen = tl.rows[promiseIdx].start;
    if (coldOpen > 12) problems.push(`콜드 오픈이 ${coldOpen.toFixed(1)}s — 12s 상한 초과`);
    if (tl.rows[promiseIdx].start > 18) problems.push(`약속 카드가 ${tl.rows[promiseIdx].start.toFixed(1)}s — 18s 상한 초과`);
    else notes.push(`훅  타이틀 0s · 본편 진입 ${coldOpen.toFixed(1)}s`);
  }
}

// Gate E-6 — chapters. YouTube needs the first at 0:00, at least three, and
// ten seconds between marks; ours must also stay within the stop budget.
{
  const tl = timelineOf(spec);
  const marks = tl.rows.filter((r) => r.beat.chapter);
  const nStops = stopsOf(spec).length;
  if (marks.length < 6) problems.push(`챕터 ${marks.length}개 — 최소 6개`);
  if (marks.length > nStops + 2) problems.push(`챕터 ${marks.length}개 > 스톱+2 (${nStops + 2})`);
  if (marks.length && marks[0].start > 0.01) problems.push(`첫 챕터가 0:00 이 아니다 (${marks[0].start}s)`);
  for (let i = 1; i < marks.length; i++) {
    const gap = marks[i].start - marks[i - 1].start;
    if (gap < 10) problems.push(`챕터 간격 ${gap.toFixed(1)}s < 10s: "${marks[i - 1].beat.chapter}"→"${marks[i].beat.chapter}"`);
  }
  if (marks.length) notes.push(`챕터 ${marks.length}개 · 스톱 ${nStops}개`);
}

for (const n of notes) console.log(`  ok   ${n}`);
if (problems.length) {
  console.error(`\n연속성 게이트 실패 — ${problems.length}건\n`);
  for (const p of problems) console.error(`  FAIL ${p}`);
  process.exit(1);
}
console.log(`\n연속성 게이트 통과 — 비트 ${spec.beats.length}개, 미처리 점프 0`);
