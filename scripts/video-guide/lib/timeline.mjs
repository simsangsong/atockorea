/**
 * Where every beat lands in the finished master — the one place this is
 * computed, because the naive cumulative sum is wrong.
 *
 * applyTransitions() merges `d` seconds at every dissolve join, so the master
 * is shorter than the sum of beat durations (6.2s shorter on the pilot). The
 * first vertical cut used the naive sum and its picks drifted up to six
 * seconds late by the end of the timeline. Everything that maps beat → master
 * time (vertical lift, chapters, cue track) must go through here.
 */

import fs from 'node:fs';
import path from 'node:path';

export const outDurOf = (b) =>
  b.kind === 'clip' ? +(((b.out - b.in) / (b.speed ?? 1))).toFixed(3) : b.hold;

/**
 * The measured timeline build.mjs emitted next to the master — per-segment AAC
 * padding and frame rounding make the encode ~4s longer than the model, so the
 * model must never be used to lift from a real render. Returns null when the
 * file is missing or does not match this spec's beats (stale render).
 */
export function measuredTimeline(spec, outDir) {
  const f = path.join(outDir, `${spec.slug}.timeline.json`);
  if (!fs.existsSync(f)) return null;
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const byId = Object.fromEntries(data.rows.map((r) => [r.id, r]));
  if (data.rows.length !== spec.beats.length || spec.beats.some((b) => !byId[b.id])) return null;
  return {
    rows: spec.beats.map((b) => ({ ...byId[b.id], beat: b })),
    total: data.total,
    measured: true,
  };
}

/** [{id, start, dur}] in finished-master seconds, dissolve overlap deducted. */
export function timelineOf(spec) {
  const rows = [];
  let t = 0;
  for (let i = 0; i < spec.beats.length; i++) {
    const b = spec.beats[i];
    const d = i > 0 ? (b.transition?.seconds ?? 0) : 0;
    t -= d;
    rows.push({ id: b.id, start: +Math.max(0, t).toFixed(3), dur: outDurOf(b), beat: b });
    t += outDurOf(b);
  }
  return { rows, total: +t.toFixed(3) };
}

/** Stops = held beats plus clips that carry a stopLabel, in order. */
export const stopsOf = (spec) =>
  spec.beats.filter((b) => b.kind !== 'clip' || b.stopLabel);

/**
 * Real walking seconds, measured off the source timecode — never authored.
 * Repeated footage (cold open, bookend ending) is excluded: a clip whose
 * source range overlaps an earlier beat of the same recording is a repeat.
 */
export function walkSecondsOf(spec) {
  const seen = {};
  let sum = 0;
  for (const b of spec.beats) {
    if (b.kind !== 'clip') continue;
    const ranges = (seen[b.src] ??= []);
    const overlaps = ranges.some(([a, z]) => b.in < z && b.out > a);
    if (!overlaps) sum += b.out - b.in;
    ranges.push([b.in, b.out]);
  }
  return Math.round(sum);
}

/** "a 10-minute walk" — generated, so gate E-3 has nothing to catch. */
export function promiseLineOf(spec) {
  const stops = stopsOf(spec).length;
  const min = Math.round(walkSecondsOf(spec) / 60);
  return `${stops} STOPS · A ${min}-MINUTE WALK`;
}

/** "≈1½ min walk" for a transit stretch, from measured source seconds. */
export function transitLabel(srcSeconds) {
  if (srcSeconds < 45) return `≈${Math.round(srcSeconds / 10) * 10} sec walk`;
  const halves = Math.round(srcSeconds / 30);
  const whole = Math.floor(halves / 2);
  return halves % 2 ? `≈${whole ? whole + '½' : '½'} min walk` : `≈${whole} min walk`;
}

/** The shell role a beat plays in the vertical cut. */
export function roleOf(b) {
  if (b.role) return b.role;                       // title | promise | recap
  if (b.kind !== 'clip') return 'stop';
  if (b.stopLabel) return 'stop';
  if ((b.speed ?? 1) >= 4 && (b.out - b.in) >= 20) return 'transit';
  return 'clean';
}
