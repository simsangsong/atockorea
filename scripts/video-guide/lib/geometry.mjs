// Ground-plane arrow geometry.
// Design rules (from client feedback):
//   - segments are STRAIGHT; no bezier smoothing between waypoints
//   - a turn is a SHARP corner at the actual turn point
//   - stairs descend as a stepped zigzag, never a vertical plunge
//   - width tapers with perspective so the ribbon reads as painted on the ground

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v) => Math.hypot(v.x, v.y);
const norm = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; };
const perp = (v) => ({ x: -v.y, y: v.x });

export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += len(sub(pts[i], pts[i - 1]));
  return L;
}

/** Cumulative arc length at each vertex. */
function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  return cum;
}

/** Truncate polyline to arc length L, keeping every original corner before the cut. */
export function truncate(pts, L) {
  const cum = cumulative(pts);
  if (L >= cum[cum.length - 1]) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] <= L) { out.push(pts[i]); continue; }
    const segLen = cum[i] - cum[i - 1];
    const t = segLen === 0 ? 0 : (L - cum[i - 1]) / segLen;
    out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
    break;
  }
  return out;
}

/** Width at normalized arc position s in [0,1] — linear taper (near -> far). */
const widthAt = (s, w0, w1) => w0 + (w1 - w0) * s;

/**
 * Build a tapered ribbon polygon along pts.
 * Sharp miter joins at corners (clamped so hairpins don't explode).
 */
export function ribbonPath(pts, w0, w1, totalLen) {
  if (pts.length < 2) return '';
  const cum = cumulative(pts);
  const L = cum[cum.length - 1] || 1;
  const left = [], right = [];

  for (let i = 0; i < pts.length; i++) {
    const s = (totalLen ? cum[i] / totalLen : cum[i] / L);
    const half = widthAt(Math.min(s, 1), w0, w1) / 2;
    let n;
    if (i === 0) n = perp(norm(sub(pts[1], pts[0])));
    else if (i === pts.length - 1) n = perp(norm(sub(pts[i], pts[i - 1])));
    else {
      const d0 = norm(sub(pts[i], pts[i - 1]));
      const d1 = norm(sub(pts[i + 1], pts[i]));
      const bis = norm({ x: d0.x + d1.x, y: d0.y + d1.y });
      n = perp(bis);
      // miter compensation keeps the ribbon a constant width through the corner
      const cosHalf = Math.max(0.35, Math.abs(d0.x * bis.x + d0.y * bis.y));
      n = { x: n.x / cosHalf, y: n.y / cosHalf };
    }
    left.push({ x: pts[i].x + n.x * half, y: pts[i].y + n.y * half });
    right.push({ x: pts[i].x - n.x * half, y: pts[i].y - n.y * half });
  }

  const d = [`M ${left[0].x.toFixed(2)} ${left[0].y.toFixed(2)}`];
  for (let i = 1; i < left.length; i++) d.push(`L ${left[i].x.toFixed(2)} ${left[i].y.toFixed(2)}`);
  for (let i = right.length - 1; i >= 0; i--) d.push(`L ${right[i].x.toFixed(2)} ${right[i].y.toFixed(2)}`);
  d.push('Z');
  return d.join(' ');
}

/** Arrowhead triangle at the tip of pts, pointing along the final segment. */
export function headPath(pts, width, length) {
  const n = pts.length;
  if (n < 2) return '';
  const tip = pts[n - 1];
  const dir = norm(sub(pts[n - 1], pts[n - 2]));
  const p = perp(dir);
  const base = { x: tip.x - dir.x * length, y: tip.y - dir.y * length };
  const a = { x: base.x + p.x * width / 2, y: base.y + p.y * width / 2 };
  const b = { x: base.x - p.x * width / 2, y: base.y - p.y * width / 2 };
  return `M ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

/** Chevrons riding the ribbon — the "direction of travel" read. */
export function chevrons(pts, w0, w1, totalLen, spacing, startOffset = 0) {
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  const out = [];
  for (let d = startOffset; d < L - spacing * 0.4; d += spacing) {
    let i = 1;
    while (i < cum.length && cum[i] < d) i++;
    if (i >= cum.length) break;
    const segLen = cum[i] - cum[i - 1] || 1;
    const t = (d - cum[i - 1]) / segLen;
    const at = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    const dir = norm(sub(pts[i], pts[i - 1]));
    const p = perp(dir);
    const s = totalLen ? d / totalLen : d / L;
    const half = widthAt(Math.min(s, 1), w0, w1) / 2 * 0.62;
    const depth = half * 1.15;
    const tip = { x: at.x + dir.x * depth, y: at.y + dir.y * depth };
    const a = { x: at.x - dir.x * depth * 0.35 + p.x * half, y: at.y - dir.y * depth * 0.35 + p.y * half };
    const b = { x: at.x - dir.x * depth * 0.35 - p.x * half, y: at.y - dir.y * depth * 0.35 - p.y * half };
    out.push({ d: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`, at: d });
  }
  return out;
}

/**
 * Generate a stepped (staircase) polyline between two ground points.
 * Steps shrink toward the far end so it sits in perspective.
 * `dropRatio` = share of each step spent on the vertical drop (screen-space).
 */
export function stairPolyline(from, to, steps, dropRatio = 0.55) {
  const pts = [{ ...from }];
  const dx = to.x - from.x, dy = to.y - from.y;
  // geometric shrink so far steps are smaller (perspective)
  const shrink = 0.88;
  let wsum = 0; const w = [];
  for (let i = 0; i < steps; i++) { const v = Math.pow(shrink, i); w.push(v); wsum += v; }
  let acc = 0;
  let cur = { ...from };
  for (let i = 0; i < steps; i++) {
    const share = w[i] / wsum;
    const nx = dx * share, ny = dy * share;
    // tread: mostly lateral movement
    const tread = { x: cur.x + nx * (1 - dropRatio), y: cur.y + ny * (1 - dropRatio) * 0.28 };
    pts.push(tread);
    // riser: mostly vertical movement
    const riser = { x: tread.x + nx * dropRatio * 0.35, y: tread.y + ny - ny * (1 - dropRatio) * 0.28 };
    pts.push(riser);
    cur = riser;
    acc += share;
  }
  pts.push({ ...to });
  return pts;
}
