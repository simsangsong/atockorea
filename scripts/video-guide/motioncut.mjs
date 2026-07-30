#!/usr/bin/env node
/**
 * Cut on motion — snap clip↔clip boundaries to the nearest whip-pan.
 *
 * A cut placed inside a fast camera movement is invisible: the motion blur
 * covers it. `panScore()` (via headingAt) returns ~1.0 exactly when the flow
 * field is uniform — a pan. So every boundary between two moving beats of the
 * same recording is slid, within ±1.5s, to the strongest pan nearby, and the
 * speed-ramp entries stop announcing themselves.
 *
 * Boundaries next to held beats (arrow/closeup/polaroid) are never touched —
 * a freeze must hand off on the exact frame it froze (validate.mjs gate).
 * Cross-recording joins keep their dissolves and are not candidates either.
 *
 * Writes the result into the spec like autoarrow.mjs does: `snapped` on the
 * later beat when a pan was found, `nosnap` with the measured ceiling when the
 * neighbourhood is walk-steady. validate.mjs refuses specs where neither mark
 * is present (gate E-4) — running this script IS the compliance step.
 *
 *   node scripts/video-guide/motioncut.mjs docs/video-specs/<slug>.json [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { headingAt } from './heading.mjs';

const SEARCH = 1.5;      // seconds either side of the authored boundary
const STEP = 0.2;
const WINDOW = 0.6;      // pan is measured across [t-0.3, t+0.3]
const PAN_MIN = 0.55;    // same bar heading.mjs uses to call a pan a pan
const KEEP = 1.5;        // each beat keeps at least this much source time

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
if (!specPath) { console.error('usage: motioncut.mjs <spec.json> [--force]'); process.exit(1); }
const FORCE = argv.includes('--force');

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const src = (id) => path.join(spec.sourceDir, spec.sources[id]);

let moved = 0, held = 0, skipped = 0;
console.log('boundary        was      pan-scan                      result');

for (let i = 1; i < spec.beats.length; i++) {
  const prev = spec.beats[i - 1], cur = spec.beats[i];
  if (prev.kind !== 'clip' || cur.kind !== 'clip') continue;
  if (prev.src !== cur.src || cur.transition) continue;
  if ((cur.snapped || cur.nosnap) && !FORCE) { skipped++; continue; }

  const t = cur.in;
  const lo = Math.max(prev.in + KEEP, t - SEARCH);
  const hi = Math.min(cur.out - KEEP, t + SEARCH);

  let best = { pan: -1, at: t };
  for (let at = lo; at <= hi + 1e-6; at += STEP) {
    const r = headingAt(src(cur.src), Math.max(0, at - WINDOW / 2), WINDOW);
    const pan = r.pan ?? 0;
    if (pan > best.pan) best = { pan, at: +at.toFixed(2) };
  }

  const where = `${prev.id}→${cur.id}`.padEnd(14);
  if (best.pan >= PAN_MIN) {
    delete cur.nosnap;
    cur.snapped = { from: t, pan: +best.pan.toFixed(3) };
    prev.out = best.at;
    cur.in = best.at;
    moved++;
    console.log(`${where}  ${String(t).padStart(6)}   max pan ${best.pan.toFixed(2)} @ ${best.at}`.padEnd(52)
      + `SNAP ${t}→${best.at}`);
  } else {
    delete cur.snapped;
    cur.nosnap = `no pan within ±${SEARCH}s (max ${best.pan.toFixed(2)})`;
    held++;
    console.log(`${where}  ${String(t).padStart(6)}   max pan ${best.pan.toFixed(2)} @ ${best.at}`.padEnd(52) + 'steady — keep');
  }
}

fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
console.log(`\nsnapped ${moved} · steady ${held} · already-marked ${skipped}  →  ${specPath}`);
