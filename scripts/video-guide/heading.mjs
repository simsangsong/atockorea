#!/usr/bin/env node
/**
 * Where is the camera actually walking?
 *
 * Walking forward makes image content stream OUTWARD from one point — the focus
 * of expansion. That point is the direction of travel. Route arrows must be
 * derived from it, never eyeballed: v1 arrows were hand-placed and one of them
 * pointed 378px to the wrong side of frame centre.
 *
 * Turning your head instead of walking gives a near-uniform flow field with no
 * focus of expansion. That case is detected and reported as PAN so we can refuse
 * to draw an arrow rather than invent one.
 *
 *   node scripts/video-guide/heading.mjs <spec.json>        # every held beat
 *   node scripts/video-guide/heading.mjs <video> 26 32 41   # ad-hoc times
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const W = 320, H = 180;         // analysis resolution
const SRC_W = 1920, SRC_H = 1080;
const SCALE = SRC_W / W;
const BLK = 16, SEARCH = 14, STEP = 8;

// how far ahead we look, in seconds, to see where the walk goes
export const SAMPLES = [0.8, 1.6, 2.4, 3.2];
const PAN_LIMIT = 0.86;         // above this the flow is uniform => a pan, not a walk
const TURN_FRACTION = 0.08;     // heading drift beyond 8% of width means a real turn

function grayFrame(file, t) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', `scale=${W}:${H}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 26 });
  if (r.status !== 0 || r.stdout.length < W * H) return null;
  return r.stdout;
}

const at = (buf, x, y) => buf[y * W + x];

function blockFlow(a, b) {
  const out = [];
  for (let by = BLK; by < H - BLK; by += STEP) {
    for (let bx = BLK; bx < W - BLK; bx += STEP) {
      let mn = 255, mx = 0;
      for (let y = by; y < by + BLK; y += 3) for (let x = bx; x < bx + BLK; x += 3) {
        const v = at(a, x, y); if (v < mn) mn = v; if (v > mx) mx = v;
      }
      if (mx - mn < 26) continue;                 // flat block, no reliable match

      let best = Infinity, bdx = 0, bdy = 0;
      for (let dy = -SEARCH; dy <= SEARCH; dy++) {
        for (let dx = -SEARCH; dx <= SEARCH; dx++) {
          const nx = bx + dx, ny = by + dy;
          if (nx < 0 || ny < 0 || nx + BLK >= W || ny + BLK >= H) continue;
          let sad = 0;
          for (let y = 0; y < BLK; y += 2) for (let x = 0; x < BLK; x += 2) {
            sad += Math.abs(at(a, bx + x, by + y) - at(b, nx + x, ny + y));
          }
          if (sad < best) { best = sad; bdx = dx; bdy = dy; }
        }
      }
      const mag = Math.hypot(bdx, bdy);
      if (mag < 1.2 || mag > SEARCH - 1) continue; // still, or pinned to the search wall
      out.push({ x: bx + BLK / 2, y: by + BLK / 2, dx: bdx, dy: bdy, mag });
    }
  }
  return out;
}

/** The point closest to every flow line, weighted by vector length. */
function focusOfExpansion(flow) {
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const f of flow) {
    const nx = -f.dy / f.mag, ny = f.dx / f.mag;  // normal to the flow direction
    const c = nx * f.x + ny * f.y;
    const w = Math.min(f.mag, 6);
    a11 += w * nx * nx; a12 += w * nx * ny; a22 += w * ny * ny;
    b1 += w * nx * c; b2 += w * ny * c;
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-6) return null;
  return { x: (b1 * a22 - b2 * a12) / det, y: (a11 * b2 - a12 * b1) / det };
}

/** 1.0 = every vector points the same way (a pan). 0 = radial (a walk). */
function panScore(flow) {
  let sx = 0, sy = 0;
  for (const f of flow) { sx += f.dx / f.mag; sy += f.dy / f.mag; }
  return Math.hypot(sx, sy) / flow.length;
}

export function headingAt(file, t, dt = 1.2) {
  const a = grayFrame(file, t), b = grayFrame(file, t + dt);
  if (!a || !b) return { ok: false, why: 'frame read failed' };
  const flow = blockFlow(a, b);
  if (flow.length < 25) return { ok: false, why: 'not enough texture/motion', n: flow.length };
  const pan = +panScore(flow).toFixed(3);
  const p = focusOfExpansion(flow);
  if (!p) return { ok: false, why: 'degenerate', n: flow.length, pan };
  return { ok: pan < PAN_LIMIT, pan, n: flow.length, x: Math.round(p.x * SCALE), y: Math.round(p.y * SCALE) };
}

const durCache = new Map();
export function durationOf(file) {
  if (durCache.has(file)) return durCache.get(file);
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file]);
  const d = Number(String(r.stdout).trim()) || 0;
  durCache.set(file, d);
  return d;
}

/**
 * Sample the heading across the seconds that follow a freeze and decide what the
 * route actually does: go straight, or break left/right at a specific point.
 *
 * Samples that would run past the end of the clip are dropped — a freeze near the
 * tail of a clip simply has less future to measure, and inventing one would be
 * worse than reporting `unknown`.
 */
export function routeAfter(file, t) {
  const dur = durationOf(file);
  const usable = SAMPLES.filter((dt) => t + dt + 1.2 <= dur - 0.05);

  // A freeze at the tail of a clip has no future to measure. The walk that led
  // into it is still the truth, so sample backwards and say so.
  if (usable.length < 2) {
    const back = [-3.2, -2.4, -1.6, -0.8]
      .filter((dt) => t + dt >= 0 && t + dt + 1.2 <= dur - 0.05)
      .map((dt) => ({ dt, ...headingAt(file, t + dt) }))
      .filter((p) => p.ok);
    if (back.length < 2) return { kind: 'unknown', why: `측정 구간 없음 (클립 ${dur.toFixed(1)}s)`, pts: [] };
    const bx = back.map((p) => p.x);
    return {
      kind: 'trailing', trailing: true, pts: back,
      drift: bx[bx.length - 1] - bx[0],
      x: Math.round(bx.reduce((a, b) => a + b) / bx.length),
      y: Math.round(back.reduce((s, p) => s + p.y, 0) / back.length),
    };
  }

  const pts = usable.map((dt) => ({ dt, ...headingAt(file, t + dt) })).filter((p) => p.ok);
  if (pts.length < 2) return { kind: 'unknown', why: '측정 표본 부족', pts };
  const xs = pts.map((p) => p.x);
  const drift = xs[xs.length - 1] - xs[0];
  const limit = SRC_W * TURN_FRACTION;
  if (Math.abs(drift) < limit) {
    return { kind: 'straight', pts, drift, x: Math.round(xs.reduce((a, b) => a + b) / xs.length), y: Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length) };
  }
  // find where the drift starts — that is where the corner belongs
  let idx = 1;
  for (let i = 1; i < xs.length; i++) { if (Math.abs(xs[i] - xs[0]) > limit * 0.45) { idx = i; break; } }
  const span = pts[pts.length - 1].dt;
  return { kind: drift > 0 ? 'right' : 'left', pts, drift, cornerAt: pts[idx].dt / span, x: xs[xs.length - 1], y: pts[pts.length - 1].y };
}

// ---- CLI --------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\//, ''))) {
  const target = process.argv[2];
  if (!target) { console.error('usage: heading.mjs <spec.json | video> [times...]'); process.exit(1); }

  if (target.endsWith('.json')) {
    const spec = JSON.parse(fs.readFileSync(target, 'utf8'));
    const src = (id) => path.join(spec.sourceDir, spec.sources[id]);
    console.log('beat  src  at      route      drift  heading        note');
    for (const b of spec.beats) {
      if (b.kind === 'clip') continue;
      const r = routeAfter(src(b.src), b.at);
      const head = r.x !== undefined ? `(${r.x}, ${r.y})` : '-';
      const corner = r.cornerAt ? ` corner@${(r.cornerAt * 100).toFixed(0)}%` : '';
      console.log(
        `${b.id}    ${b.src}   ${String(b.at).padStart(5)}   ${String(r.kind).padEnd(9)} ` +
        `${String(r.drift ?? '-').padStart(5)}  ${head.padEnd(14)} ${b.note ?? ''}${corner}`
      );
    }
  } else {
    for (const s of process.argv.slice(3)) {
      const t = Number(s);
      const r = headingAt(target, t);
      console.log(`t=${String(t).padStart(6)}  ${(r.ok ? 'WALK' : 'PAN/NA').padEnd(7)} pan=${r.pan ?? '-'} n=${r.n ?? 0}` +
        (r.x !== undefined ? `  heading=(${r.x}, ${r.y})` : `  (${r.why})`));
    }
  }
}
