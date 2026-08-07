#!/usr/bin/env node
/**
 * Where the camera TURNS — the moments that decide the pacing (V6-D18).
 *
 *   node scripts/video-guide/turns.mjs docs/video-specs/<slug>.json [--src B] [--min 0.55]
 *
 * The pacing rule this exists to serve is the owner's, and it is the inverse of
 * what the first Gamcheon cut did: **a turn is the interesting moment and plays
 * at 1x; a straight walk is the dull moment and gets sped up.** The camera only
 * swings when the person carrying it decided to look at something, so the turn
 * IS the sightseeing — and a turn played at 6-8x is a whip-pan that makes the
 * viewer dizzy, which is exactly the complaint.
 *
 * The signal is already in the pipeline: `panScore()` is ~1.0 when the optical
 * flow field is uniform (the head swung) and ~0 when it is radial (the body
 * walked forward). heading.mjs uses it to refuse drawing an arrow and motioncut
 * uses it to hide cuts; here it picks the beats themselves.
 *
 * Output: turn windows [start, end] in source seconds, already padded so the
 * approach and the settle are included — a turn cut tight to the swing reads as
 * a glitch, the eye needs to see what was being looked away from and what was
 * arrived at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { headingAt, durationOf } from './heading.mjs';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
const CLI = Boolean(specPath);   // importable as a library; only the CLI needs a spec
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const spec = CLI ? JSON.parse(fs.readFileSync(specPath, 'utf8')) : null;
const ONLY_SRC = flag('src', null);
const MIN_PAN = Number(flag('min', 0.55));
const STEP = Number(flag('step', 0.5));      // sampling grid, seconds
const PAD_IN = Number(flag('padin', 1.0));   // seconds of approach kept before the swing
const PAD_OUT = Number(flag('padout', 1.4)); // seconds of settle kept after it
const MERGE_GAP = 1.5;                       // two swings closer than this are one look

export function turnsIn(file, { min = MIN_PAN, step = STEP } = {}) {
  const dur = durationOf(file);
  const hits = [];
  for (let t = 0.4; t < dur - 1.6; t += step) {
    const h = headingAt(file, t, 0.5);
    if (h && typeof h.pan === 'number' && h.pan >= min) hits.push({ t: +t.toFixed(2), pan: h.pan });
  }
  // group consecutive hits into single turn events
  const events = [];
  for (const h of hits) {
    const last = events[events.length - 1];
    if (last && h.t - last.end <= MERGE_GAP) {
      last.end = h.t;
      if (h.pan > last.peak) { last.peak = h.pan; last.at = h.t; }
    } else {
      events.push({ start: h.t, end: h.t, at: h.t, peak: h.pan });
    }
  }
  return events.map((e) => ({
    at: e.at,
    peak: +e.peak.toFixed(3),
    in: +Math.max(0, e.start - PAD_IN).toFixed(2),
    out: +Math.min(dur, e.end + PAD_OUT).toFixed(2),
  }));
}

if (CLI && process.argv[1].endsWith('turns.mjs')) {
  const srcDir = spec.sourceDir;
  const measured = {};
  for (const [id, name] of Object.entries(spec.sources)) {
    if (ONLY_SRC && id !== ONLY_SRC) continue;
    const file = path.join(srcDir, name);
    const evs = turnsIn(file);
    measured[id] = evs;
    console.log(`\n[${id}] ${name}  (${durationOf(file).toFixed(0)}s)  회전 ${evs.length}건  pan>=${MIN_PAN}`);
    for (const e of evs) {
      console.log(`  ${String(e.in).padStart(7)}s → ${String(e.out).padStart(7)}s`
        + `  (${(e.out - e.in).toFixed(1)}s)  peak ${e.peak} @${e.at}s`);
    }
  }
  // Cache the measurement beside the spec so validate.mjs can enforce "a turn is
  // never sped up" (Gate 3d) without paying for the decode. A full sweep only —
  // a --src run would write a partial map and the gate would go quiet on the
  // sources it could not see.
  if (!ONLY_SRC) {
    const out = specPath.replace(/\.json$/, '.turns.json');
    fs.writeFileSync(out, JSON.stringify({ min: MIN_PAN, step: STEP, padIn: PAD_IN, padOut: PAD_OUT, turns: measured }, null, 1));
    console.log(`\n측정 캐시 → ${out}  (게이트 3d 가 읽는다)`);
  } else {
    console.log('\n⚠ --src 단일 실행이라 캐시를 쓰지 않았다 — 게이트 3d 용 캐시는 전체 실행으로 만들어라');
  }
}
