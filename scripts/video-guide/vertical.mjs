#!/usr/bin/env node
/**
 * The teaser — 60–90s vertical, money first (V6-D1 / B-7).
 *
 * A shorts cut lives or dies in its first two seconds, so it does NOT open
 * chronologically: segment one is the single best money beat (the panorama
 * polaroid), then the claim, then chronology resumes. 1x/1.2x highlight clips
 * are folded in at up to six seconds each until at least 80% of the budget is
 * used — the old picker took stops only and shipped 54 of 90 seconds.
 *
 * Segments are the full guide's own rendered beats (vfull.mjs must run first):
 * shells, grade and pacing are identical across the two cuts by construction,
 * and only trimmed segments re-encode.
 *
 * The E-5 gate lives here, after the encode, because it judges the output:
 * budget fill ≥80% and a money opener — the build fails otherwise.
 *
 *   node scripts/video-guide/vertical.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { timelineOf, measuredTimeline, roleOf } from './lib/timeline.mjs';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: vertical.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const ROOT = process.cwd();
const VFULL = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-vfull`);
const WORK = path.join(ROOT, '.cache', 'video-guide', `${spec.slug}-teaser`);
const OUT = path.join(ROOT, 'out', 'video-guide', `${spec.slug}-teaser.mp4`);
fs.mkdirSync(WORK, { recursive: true });

const seg = (id) => path.join(VFULL, `v_${id}.mp4`);
if (!fs.existsSync(seg(spec.beats[0].id))) {
  console.error(`먼저 세로 풀 가이드를 렌더해야 한다 (vfull.mjs) — ${VFULL} 가 비어 있다`);
  process.exit(1);
}

const run = (args, label) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`FAILED: ${label}`); process.exit(1); }
};

const BUDGET = spec.verticalSeconds ?? 90;
// Held beats (a polaroid, a close-up) play whole — they are the thing being
// shown. Moving footage gets capped: the first cut let the bamboo path eat
// eighteen seconds, a fifth of the teaser, for one continuous walk.
const CLIP_CAP = 6, STOP_CLIP_CAP = 8;
const tl = measuredTimeline(spec, path.join(ROOT, 'out', 'video-guide')) ?? timelineOf(spec);
const durOf = Object.fromEntries(tl.rows.map((r) => [r.id, r.dur]));

// money lead: explicit teaserLead, else the first polaroid
const lead = spec.teaserLead ?? spec.beats.find((b) => b.kind === 'polaroid')?.id;
const title = spec.beats.find((b) => roleOf(b) === 'title')?.id;

const chronological = spec.beats.filter((b) => {
  if (b.id === lead || b.id === title) return false;
  const role = roleOf(b);
  if (role === 'stop' || role === 'recap') return true;
  return b.kind === 'clip' && (b.speed ?? 1) <= 1.3 && durOf[b.id] >= 3 && role === 'clean';
}).map((b) => b.id);

const order = [lead, title, ...chronological].filter(Boolean);

const parts = [];
let used = 0;
for (const id of order) {
  if (used >= BUDGET - 0.5) break;
  const beat = spec.beats.find((b) => b.id === id);
  const full = durOf[id];
  const cap = beat.kind !== 'clip' ? full
    : roleOf(beat) === 'clean' ? CLIP_CAP : STOP_CLIP_CAP;
  const take = +Math.min(full, cap, BUDGET - used).toFixed(2);
  if (take < 1.2) continue;

  if (take >= full - 0.05) {
    parts.push(seg(id));
  } else {
    const t = path.join(WORK, `t_${id}.mp4`);
    run(['-i', seg(id), '-t', String(take),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', t], `trim ${id}`);
    parts.push(t);
  }
  used += take;
  console.log(`  ${id}  ${take.toFixed(1)}s  ${beat.stopLabel?.title ?? beat.title ?? ''}`);
}

const list = path.join(WORK, 'concat.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], 'concat');

// ---- gate E-5 — judged on the output, not the plan --------------------------
const firstBeat = spec.beats.find((b) => b.id === order[0]);
// A "money beat" is one the film STOPS on. That used to mean a polaroid, because
// polaroids were the only held beat — but V6-D21 made stop-and-label the standard
// point-of-interest treatment and V6-D23 left the polaroid optional, so 오설록
// (2026-08-03, owner: "폴라로이드들은 다 빼고") has ten held stops and zero
// polaroids. Excluding `arrow` here rejected exactly the beat the teaser should
// open on. Same trap as T-57: the check was keyed to a signal a format decision
// had already retired.
const money = firstBeat && (firstBeat.kind === 'polaroid' || firstBeat.kind === 'arrow'
  || (firstBeat.kind === 'clip' && (firstBeat.speed ?? 1) <= 1.05));
const problems = [];
if (used < BUDGET * 0.8) problems.push(`예산 ${BUDGET}s 중 ${used.toFixed(1)}s — 80% 미달`);
if (!money) problems.push(`첫 세그먼트(${order[0]})가 머니 비트가 아니다 (polaroid/1x 여야 한다)`);
if (problems.length) { for (const p of problems) console.error(`  FAIL ${p}`); process.exit(1); }

console.log(`\n=> ${OUT}  (${used.toFixed(0)}s / ${BUDGET}s, ${parts.length} segments, lead=${order[0]})`);
