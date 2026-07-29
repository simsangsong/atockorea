import { ribbonPath, headPath, chevrons, polylineLength, truncate } from './geometry.mjs';

export const W = 1920, H = 1080;

/**
 * Palettes. `pearl` is the house style (client pick 2026-07-29): a white body reads
 * as calm and premium. Its weakness is bright stone, so the rim/shadow strengthen
 * with background luminance instead of the body ever turning dark.
 */
export const THEMES = {
  pearl: {
    fill0: '#FFFFFF', fill1: '#DCE6F4',
    rim: '#22406B', rimWidth: 2.6,
    shadow: 'rgba(16,28,48,0.34)', shadowOpacity: 0.42,
    chev: 'rgba(34,64,107,0.80)', chevWidth: 5,
    opacity: 0.90,
  },
  navy: {
    fill0: '#3D6098', fill1: '#1E3A63',
    rim: '#FFFFFF', rimWidth: 2.4,
    shadow: 'rgba(10,20,36,0.34)', shadowOpacity: 0.42,
    chev: 'rgba(255,255,255,0.86)', chevWidth: 5,
    opacity: 0.88,
  },
};

/**
 * Bright backgrounds swallow a white ribbon. Thicken the rim and deepen the shadow
 * so the body can stay white. `luma` is 0..255 sampled under the arrow path.
 */
export function adapt(theme, luma) {
  if (theme.fill0 !== '#FFFFFF' || luma == null) return theme;
  const t = Math.max(0, Math.min(1, (luma - 110) / 90)); // 110 dark .. 200 bright
  return {
    ...theme,
    rimWidth: theme.rimWidth + 1.9 * t,
    shadowOpacity: theme.shadowOpacity + 0.26 * t,
    chevWidth: theme.chevWidth + 1.2 * t,
    opacity: Math.min(1, theme.opacity + 0.07 * t),
  };
}

// Slow, soft unfurl — eases in AND out so nothing snaps into place.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (t) => t * t * (3 - 2 * t);

/** Continuous ground ribbon: straight runs, sharp corners at turn vertices. */
function ribbonLayer(TH, a, progress) {
  const pts = a.points;
  const total = polylineLength(pts);
  const shown = Math.max(2, total * ease(progress));
  const headLen = a.headLen ?? 56;
  const shaftLen = Math.max(1, shown - headLen);
  const shaft = truncate(pts, shaftLen);
  const withHead = truncate(pts, shown);
  const w0 = a.width?.[0] ?? 120, w1 = a.width?.[1] ?? 18;
  const tipW = w0 + (w1 - w0) * Math.min(1, shaftLen / total);

  const body = ribbonPath(shaft, w0, w1, total);
  const head = shown > headLen * 0.9 ? headPath(withHead, tipW * 2.05, headLen) : '';
  const tipFade = Math.min(1, progress * 3.2);

  // No chevrons. They were meant to read as "direction of travel" but inside a
  // white ribbon they just look like a second, darker arrow pointing the same
  // way — the client read them as a bug, and they were right.
  return `
    <g opacity="${(TH.opacity * tipFade).toFixed(3)}">
      <g transform="translate(0,7)" opacity="${TH.shadowOpacity.toFixed(2)}">
        <path d="${body}" fill="${TH.shadow}"/>${head ? `<path d="${head}" fill="${TH.shadow}"/>` : ''}
      </g>
      <path d="${body}" fill="url(#grad)" stroke="${TH.rim}" stroke-width="${TH.rimWidth}" stroke-linejoin="round"/>
      ${head ? `<path d="${head}" fill="url(#grad)" stroke="${TH.rim}" stroke-width="${TH.rimWidth}" stroke-linejoin="round"/>` : ''}
    </g>`;
}

/**
 * Discrete chevron plates, one per stair tread, on a STRAIGHT ground path.
 * The staircase read comes from separated plates + perspective compression —
 * never a zigzag polyline (tried, it tangles) and never a vertical plunge.
 */
function stepsLayer(TH, a, progress) {
  const pts = a.points;
  const total = polylineLength(pts);
  const n = a.steps ?? 7;
  const w0 = a.width?.[0] ?? 215, w1 = a.width?.[1] ?? 58;
  const ratio = a.perspective ?? 0.86;

  const span = []; let sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.pow(ratio, i); span.push(v); sum += v; }

  const plates = []; let acc = 0;
  for (let i = 0; i < n; i++) {
    const centre = (acc + span[i] * 0.5) / sum;
    acc += span[i];
    const p = truncate(pts, total * centre);
    const at = p[p.length - 1];
    const prev = p[p.length - 2] ?? pts[0];
    const dx = at.x - prev.x, dy = at.y - prev.y;
    const l = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / l, y: dy / l };
    const per = { x: -dir.y, y: dir.x };
    const half = (w0 + (w1 - w0) * centre) / 2;
    const depth = Math.max(10, (span[i] / sum) * total * 0.58);

    const tip = { x: at.x + dir.x * depth * 0.5, y: at.y + dir.y * depth * 0.5 };
    const back = { x: at.x - dir.x * depth * 0.5, y: at.y - dir.y * depth * 0.5 };
    const notch = { x: back.x + dir.x * depth * 0.34, y: back.y + dir.y * depth * 0.34 };
    const a1 = { x: back.x + per.x * half, y: back.y + per.y * half };
    const b1 = { x: back.x - per.x * half, y: back.y - per.y * half };
    const ai = { x: notch.x + per.x * half * 0.30, y: notch.y + per.y * half * 0.30 };
    const bi = { x: notch.x - per.x * half * 0.30, y: notch.y - per.y * half * 0.30 };

    const t0 = i / (n + 2.4);
    const raw = Math.max(0, Math.min(1, (progress - t0) / (1 / (n + 2.4)) * 0.85));
    const local = smoothstep(raw);
    if (local <= 0.001) continue;
    const f = (v) => v.toFixed(1);
    plates.push(`<path d="M ${f(tip.x)} ${f(tip.y)} L ${f(a1.x)} ${f(a1.y)} L ${f(ai.x)} ${f(ai.y)} L ${f(bi.x)} ${f(bi.y)} L ${f(b1.x)} ${f(b1.y)} Z"
      fill="url(#grad)" stroke="${TH.rim}" stroke-width="${TH.rimWidth}" stroke-linejoin="round" opacity="${local.toFixed(3)}"/>`);
  }
  const body = plates.join('');
  return `<g opacity="${TH.opacity}">
    <g transform="translate(0,7)" opacity="${(TH.shadowOpacity * 0.9).toFixed(2)}">${body.replace(/fill="url\(#grad\)"/g, `fill="${TH.shadow}"`)}</g>
    ${body}</g>`;
}

/**
 * Pointing arrow: a short straight stem ending in a head at `target`, plus an
 * optional ring. Used to single out a statue or a plaque — never a curved callout.
 */
function pointerLayer(TH, a, progress) {
  const t = smoothstep(Math.min(1, progress * 1.25));
  const { target, from } = a;
  const dx = target.x - from.x, dy = target.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / l, y: dy / l };
  const gap = a.gap ?? 48;
  const tip = { x: target.x - dir.x * gap, y: target.y - dir.y * gap };
  const grow = l * t;
  const start = { x: from.x, y: from.y };
  const now = { x: from.x + dir.x * Math.max(0, grow - gap), y: from.y + dir.y * Math.max(0, grow - gap) };
  const headLen = a.headLen ?? 54, headW = a.headWidth ?? 46;
  const per = { x: -dir.y, y: dir.x };
  const base = { x: now.x - dir.x * headLen, y: now.y - dir.y * headLen };
  const p1 = { x: base.x + per.x * headW / 2, y: base.y + per.y * headW / 2 };
  const p2 = { x: base.x - per.x * headW / 2, y: base.y - per.y * headW / 2 };
  const ringR = 0;   // the highlight ring read as clutter; the arrow alone points
  const stem = a.stem ?? 16;
  return `<g opacity="${(TH.opacity * t).toFixed(3)}">
    <g transform="translate(0,6)" opacity="${TH.shadowOpacity.toFixed(2)}">
      <line x1="${start.x}" y1="${start.y}" x2="${base.x.toFixed(1)}" y2="${base.y.toFixed(1)}" stroke="${TH.shadow}" stroke-width="${stem + 5}" stroke-linecap="round"/>
    </g>
    <line x1="${start.x}" y1="${start.y}" x2="${base.x.toFixed(1)}" y2="${base.y.toFixed(1)}" stroke="${TH.rim}" stroke-width="${stem + TH.rimWidth * 2}" stroke-linecap="round"/>
    <line x1="${start.x}" y1="${start.y}" x2="${base.x.toFixed(1)}" y2="${base.y.toFixed(1)}" stroke="url(#grad)" stroke-width="${stem}" stroke-linecap="round"/>
    <path d="M ${now.x.toFixed(1)} ${now.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z"
      fill="url(#grad)" stroke="${TH.rim}" stroke-width="${TH.rimWidth}" stroke-linejoin="round"/>
    ${ringR ? `<circle cx="${target.x}" cy="${target.y}" r="${ringR.toFixed(1)}" fill="none" stroke="${TH.rim}" stroke-width="${(4 + TH.rimWidth * 2).toFixed(1)}" opacity="${(0.55 * t).toFixed(2)}"/>
      <circle cx="${target.x}" cy="${target.y}" r="${ringR.toFixed(1)}" fill="none" stroke="url(#grad)" stroke-width="4" opacity="${(0.85 * t).toFixed(2)}"/>` : ''}
  </g>`;
}

export function buildSvg(beat, progress, theme) {
  const TH = theme ?? THEMES.pearl;
  const layers = (beat.arrows ?? []).map((a) => {
    if (a.mode === 'steps') return stepsLayer(TH, a, progress);
    if (a.mode === 'pointer') return pointerLayer(TH, a, progress);
    return ribbonLayer(TH, a, progress);
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${TH.fill0}"/>
      <stop offset="100%" stop-color="${TH.fill1}"/>
    </linearGradient>
  </defs>
  ${layers}
</svg>`;
}
