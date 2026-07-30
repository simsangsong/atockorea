#!/usr/bin/env node
/**
 * Distribution by-products, straight off the beat timeline — never hand-typed.
 *
 *   <slug>.chapters.txt  YouTube description block. One line per `chapter`
 *                        field in the spec; validate.mjs already enforced
 *                        0:00 start, ≥6 marks, ≥10s spacing.
 *   <slug>.cues.json     The app overlay track (V6-D11): for every shell-
 *                        bearing beat, when it is on screen, what it says in
 *                        the master burn, and whether the app should speak it
 *                        (V6-D8 — `tts` on stops that carry a caption). The
 *                        app substitutes the guest locale from
 *                        match_pois.content_locales and honours its own
 *                        font-scale; times are master seconds.
 *
 *   node scripts/video-guide/exportmeta.mjs docs/video-specs/<slug>.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { timelineOf, measuredTimeline, stopsOf, promiseLineOf, transitLabel, roleOf } from './lib/timeline.mjs';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: exportmeta.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const OUTDIR = path.join(process.cwd(), 'out', 'video-guide');
fs.mkdirSync(OUTDIR, { recursive: true });

// Chapters and cues point INTO the encode, so they use the measured timeline
// when a render exists; the model is only a preview before any build.
const tl = measuredTimeline(spec, OUTDIR) ?? timelineOf(spec);
if (!tl.measured) console.warn('⚠ 실측 타임라인 없음 — 모델 시각으로 미리보기만 (배포 금지)');
const stops = stopsOf(spec);

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---- chapters ---------------------------------------------------------------
// validate.mjs checked spacing on the model; measured times can differ by a few
// seconds, and YouTube's 10s minimum judges the real file — so re-check here.
const marks = tl.rows.filter((r) => r.beat.chapter);
for (let i = 1; i < marks.length; i++) {
  const gap = marks[i].start - marks[i - 1].start;
  if (gap < 10) {
    console.error(`FAIL 실측 챕터 간격 ${gap.toFixed(1)}s < 10s: "${marks[i - 1].beat.chapter}"→"${marks[i].beat.chapter}"`);
    process.exit(1);
  }
}
const chapterLines = marks.map((r) => `${mmss(r.start)} ${r.beat.chapter}`);
const chaptersFile = path.join(OUTDIR, `${spec.slug}.chapters.txt`);
fs.writeFileSync(chaptersFile, chapterLines.join('\n') + '\n');

// ---- cue track --------------------------------------------------------------
const cues = [];
for (const r of tl.rows) {
  const b = r.beat;
  const role = roleOf(b);
  if (role === 'clean') continue;
  const cue = {
    beat: b.id, kind: role,
    t0: r.start, t1: +(r.start + r.dur).toFixed(3),
    poiKey: spec.poiKey,
    textKey: `${spec.slug}.${b.id}`,
  };
  if (role === 'stop') {
    cue.point = stops.indexOf(b) + 1;
    cue.en = { title: b.stopLabel?.title ?? b.title, sub: b.stopLabel?.sub ?? b.sub, caption: b.caption };
    cue.tts = Boolean(b.caption);
  } else if (role === 'transit') {
    cue.en = { chip: transitLabel(b.out - b.in) };
  } else if (role === 'title') {
    cue.en = { title: b.title, sub: b.sub };
  } else if (role === 'promise') {
    cue.en = { chip: promiseLineOf(spec), caption: 'Ends where it starts.' };
  } else if (role === 'recap') {
    cue.en = { title: b.title, sub: b.sub, caption: `${stops.length} stops · full circle` };
  }
  cues.push(cue);
}
const cuesFile = path.join(OUTDIR, `${spec.slug}.cues.json`);
fs.writeFileSync(cuesFile, JSON.stringify({
  slug: spec.slug, poiKey: spec.poiKey, master: `${spec.slug}-vertical.mp4`,
  duration: tl.total, stops: stops.length, cues,
}, null, 2) + '\n');

console.log(chapterLines.join('\n'));
console.log(`\n=> ${chaptersFile}\n=> ${cuesFile}  (cues ${cues.length}, stops ${stops.length})`);
