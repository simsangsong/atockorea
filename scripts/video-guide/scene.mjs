/**
 * Overlay scene generator — vertical 1080x1920 brand shell.
 *
 * Inherits the layout, typography and watermark established in
 * assets/howto/poi-overlay-yonggungsa-p5.html: a 16:9 footage band with the
 * caption block above it and the asset-protection line below. What it does NOT
 * inherit is that file's route arrow, a left-to-right cubic bezier that was the
 * original complaint — arrows here come from measured heading (authorArrows.mjs)
 * and are straight-segment only.
 *
 * Rendered to transparent PNGs by scripts/render-howto-video.mjs --alpha, then
 * composited over the graded footage.
 */
import { ribbonPath, headPath, chevrons, polylineLength, truncate } from './lib/geometry.mjs';
import { SRC_W, SRC_H } from './authorArrows.mjs';

export const CANVAS = { w: 1080, h: 1920 };
export const BAND = { x: 0, y: 656, w: 1080, h: 608 };   // 16:9 at full width

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Ribbon rendered once at full extent; a masked centreline reveals it over time. */
function arrowSvg(a, idx) {
  const total = polylineLength(a.points);
  const headLen = a.headLen ?? 56;
  const shaft = truncate(a.points, Math.max(1, total - headLen));
  const w0 = a.width?.[0] ?? 128, w1 = a.width?.[1] ?? 22;
  const tipW = w0 + (w1 - w0) * Math.min(1, (total - headLen) / total);

  const body = ribbonPath(shaft, w0, w1, total);
  const head = headPath(a.points, tipW * 2.05, headLen);
  const chev = chevrons(shaft, w0, w1, total, a.chevronSpacing ?? 130, 70);
  const centre = a.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return `
  <defs>
    <linearGradient id="g${idx}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#DCE6F4"/>
    </linearGradient>
    <mask id="m${idx}" maskUnits="userSpaceOnUse" x="0" y="0" width="${SRC_W}" height="${SRC_H}">
      <path class="reveal" d="${centre}" fill="none" stroke="#fff"
            stroke-width="${w0 * 2.4}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g mask="url(#m${idx})">
    <g transform="translate(0,7)" opacity="0.40">
      <path d="${body}" fill="rgba(16,28,48,0.9)"/><path d="${head}" fill="rgba(16,28,48,0.9)"/>
    </g>
    <path d="${body}" fill="url(#g${idx})" stroke="#22406B" stroke-width="3.4" stroke-linejoin="round"/>
    <g class="chev" fill="none" stroke="rgba(34,64,107,0.82)" stroke-width="9"
       stroke-linecap="round" stroke-linejoin="round">
      ${chev.map((c) => `<path d="${c.d}"/>`).join('')}
    </g>
  </g>
  <path class="head" d="${head}" fill="url(#g${idx})" stroke="#22406B" stroke-width="3.4" stroke-linejoin="round"/>`;
}

/** Discrete plates for stairs — each fades up in turn, no reveal mask needed. */
function stepsSvg(a, idx) {
  const total = polylineLength(a.points);
  const n = a.steps ?? 7;
  const w0 = a.width?.[0] ?? 230, w1 = a.width?.[1] ?? 62;
  const ratio = a.perspective ?? 0.86;
  const span = []; let sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.pow(ratio, i); span.push(v); sum += v; }

  let acc = 0; const out = [];
  for (let i = 0; i < n; i++) {
    const centre = (acc + span[i] * 0.5) / sum; acc += span[i];
    const p = truncate(a.points, total * centre);
    const at = p[p.length - 1], prev = p[p.length - 2] ?? a.points[0];
    const dx = at.x - prev.x, dy = at.y - prev.y, l = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / l, y: dy / l }, per = { x: -dir.y, y: dir.x };
    const half = (w0 + (w1 - w0) * centre) / 2;
    const depth = Math.max(10, (span[i] / sum) * total * 0.58);
    const tip = { x: at.x + dir.x * depth * 0.5, y: at.y + dir.y * depth * 0.5 };
    const back = { x: at.x - dir.x * depth * 0.5, y: at.y - dir.y * depth * 0.5 };
    const notch = { x: back.x + dir.x * depth * 0.34, y: back.y + dir.y * depth * 0.34 };
    const f = (v) => v.toFixed(1);
    out.push(`<path class="plate" style="--i:${i}" d="M ${f(tip.x)} ${f(tip.y)} `
      + `L ${f(back.x + per.x * half)} ${f(back.y + per.y * half)} `
      + `L ${f(notch.x + per.x * half * 0.3)} ${f(notch.y + per.y * half * 0.3)} `
      + `L ${f(notch.x - per.x * half * 0.3)} ${f(notch.y - per.y * half * 0.3)} `
      + `L ${f(back.x - per.x * half)} ${f(back.y - per.y * half)} Z"/>`);
  }
  return `<defs><linearGradient id="g${idx}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#DCE6F4"/>
    </linearGradient></defs>
    <g fill="url(#g${idx})" stroke="#22406B" stroke-width="3.2" stroke-linejoin="round">${out.join('')}</g>`;
}

/**
 * @param {object} o
 *   poi        {kicker, titleKo, titleEn}
 *   point      {n, of}
 *   caption    string shown under the band (locale narration line)
 *   arrows     array of authored arrow specs (source coords), may be empty
 *   durationMs total beat length
 *   timing     {hold, draw} seconds for the arrow reveal
 */
export function buildScene(o) {
  const arrows = o.arrows ?? [];
  const svg = arrows.length
    ? `<div class="band"><svg viewBox="0 0 ${SRC_W} ${SRC_H}" preserveAspectRatio="none">
         ${arrows.map((a, i) => (a.mode === 'steps' ? stepsSvg(a, i) : arrowSvg(a, i))).join('')}
       </svg></div>`
    : '';

  const holdMs = Math.round((o.timing?.hold ?? 0.35) * 1000);
  const drawMs = Math.round((o.timing?.draw ?? 2.2) * 1000);

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${CANVAS.w}px; height:${CANVAS.h}px; overflow:hidden; background:transparent; }
body { font-family:'Segoe UI','Malgun Gothic',-apple-system,sans-serif; }
.kicker { position:absolute; top:352px; width:100%; text-align:center; font-size:30px;
  font-weight:700; letter-spacing:.38em; color:#fff; text-shadow:0 2px 14px rgba(0,0,0,.45); }
.pointchip { position:absolute; top:414px; width:100%; text-align:center; }
.pointchip span { display:inline-block; padding:10px 26px; border-radius:999px;
  background:rgba(13,95,116,.88); color:#fff; font-size:28px; font-weight:700; letter-spacing:.12em; }
.title { position:absolute; top:488px; width:100%; text-align:center; color:#fff;
  text-shadow:0 3px 18px rgba(0,0,0,.5); }
.title h1 { font-size:76px; font-weight:700; letter-spacing:-.01em; font-family:Georgia,'Malgun Gothic',serif; }
.title p { margin-top:12px; font-size:36px; opacity:.94; }
.band { position:absolute; left:${BAND.x}px; top:${BAND.y}px; width:${BAND.w}px; height:${BAND.h}px; }
.band svg { width:100%; height:100%; display:block; }
.caption { position:absolute; top:1330px; left:96px; right:96px; text-align:center; color:#fff;
  font-size:38px; line-height:1.46; font-weight:500; text-shadow:0 2px 14px rgba(0,0,0,.55); }
.watermark { position:absolute; top:1836px; width:100%; text-align:center; font-size:23px;
  font-weight:500; color:rgba(255,255,255,.72); text-shadow:0 1px 8px rgba(0,0,0,.6); }
</style></head><body>
<div class="kicker">${esc(o.poi?.kicker)}</div>
${o.point ? `<div class="pointchip"><span>POINT ${o.point.n} / ${o.point.of}</span></div>` : ''}
<div class="title"><h1>${esc(o.poi?.titleKo)}</h1><p>${esc(o.poi?.titleEn)}</p></div>
${svg}
${o.caption ? `<div class="caption">${esc(o.caption)}</div>` : ''}
<div class="watermark">본 영상은 AtoC Korea의 자산입니다 · 무단 복제·배포 금지</div>
<script>
window.__total = ${Math.round(o.durationMs)};
const anims = [];
const an = (el, frames, opt) => { if (!el) return; const a = el.animate(frames,
  { fill:'both', easing:'cubic-bezier(0.22,1,0.36,1)', ...opt }); a.pause(); anims.push(a); };
window.__seek = (t) => anims.forEach((a) => { a.currentTime = t; });

for (const [sel, delay] of [['.kicker',260],['.pointchip',400],['.title',540],['.caption',760]])
  an(document.querySelector(sel),
     [{ transform:'translateY(26px)', opacity:0 }, { transform:'translateY(0)', opacity:1 }],
     { delay, duration: 820 });

// Route reveal: the mask uncovers the ribbon slowly, then the head lands.
document.querySelectorAll('.reveal').forEach((el) => {
  const len = el.getTotalLength();
  el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
  an(el, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
     { delay: ${holdMs}, duration: ${drawMs}, easing:'cubic-bezier(0.4,0,0.2,1)' });
});
an(document.querySelector('.head'), [{ opacity:0, transform:'scale(.6)' },
   { opacity:1, transform:'scale(1.1)', offset:.7 }, { opacity:1, transform:'scale(1)' }],
   { delay: ${holdMs + drawMs - 240}, duration: 620 });
document.querySelectorAll('.chev').forEach((el) =>
  an(el, [{ opacity:0 }, { opacity:1 }], { delay: ${holdMs + 300}, duration: ${drawMs} }));
document.querySelectorAll('.plate').forEach((el, i) =>
  an(el, [{ opacity:0, transform:'translateY(14px)' }, { opacity:1, transform:'translateY(0)' }],
     { delay: ${holdMs} + i * 190, duration: 560 }));
window.__seek(0);
</script></body></html>`;
}
