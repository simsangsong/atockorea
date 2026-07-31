/**
 * Vertical shell — 1080×1920 brand frame around the 16:9 band.
 *
 * Zone contract (decision V6-D3): the top zone is the way — English
 * wayfinding only (kicker, POINT n/N, stop name, transit chip). The band is
 * footage and never carries shell text (the wide master is kept clean so the
 * lifted band cannot double-print, trap T-11). The bottom zone is the meaning —
 * exactly one locale line. Type sizes are the presbyopia floor (V6-D4): the
 * weakest eyes are the default reader, so there is no separate large-type cut.
 *
 * Layout is flex-anchored to the band edges rather than absolute per element,
 * so a two-line title pushes the kicker up instead of colliding with the band.
 * `window.__measure()` reports overflow and line counts; the builder fails the
 * render on any violation — that is also what catches a silent font fallback.
 *
 * Rendered to transparent PNGs by Playwright (band region stays transparent),
 * composited over the lifted footage by vfull.mjs / vertical.mjs.
 */

export const CANVAS = { w: 1080, h: 1920 };
export const BAND = { x: 0, y: 656, w: 1080, h: 608 };   // 16:9 at full width

export const TYPE = {                 // px on the 1080-wide canvas — gate floor
  kicker: 40,
  chip: 44,
  title: 84,
  titleHero: 88,                      // cold-open claim only — 96 wrapped the
                                      // 36-char pilot claim to three lines
  sub: 44,
  caption: 64,
  captionLineHeight: 1.35,
  captionMaxLines: 2,
  titleMaxLines: 2,
  watermark: 23,                      // protection line — exempt from the floor
};

export const WIDE = { w: 1920, h: 1080 };

/**
 * 16:9 type scale. Not the vertical's numbers scaled down — the wide cut is
 * watched on a laptop or a TV at a greater distance, so the presbyopia floor
 * is set against apparent size, and the footage is full-bleed rather than
 * banded, which means every string sits ON the picture and needs its own
 * scrim rather than a dark margin to live in.
 */
export const TYPE_WIDE = {
  kicker: 30,
  chip: 36,
  title: 76,
  titleHero: 92,
  sub: 42,
  caption: 46,
  captionLineHeight: 1.34,
  captionMaxLines: 2,
  titleMaxLines: 2,
  watermark: 22,
};

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * @param {object} o
 *   role        stop | transit | title | promise | recap | clean
 *   kicker      POI name, uppercase
 *   point       {n, of} — stop counter, stops only
 *   chip        pill text (transit fact or the generated promise line)
 *   title, sub  top-zone name + instruction (English)
 *   caption     bottom-zone locale line (English in the master burn)
 *   prints      recap only: file:/// URIs of polaroid PNGs
 *   durationMs  beat length (animations settle well before the end)
 */
export function buildScene(o) {
  const hero = o.role === 'title';
  const titlePx = hero ? TYPE.titleHero : TYPE.title;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${CANVAS.w}px; height:${CANVAS.h}px; overflow:hidden; background:transparent; }
body { font-family:'Segoe UI','Malgun Gothic',-apple-system,sans-serif; color:#fff; }
.top { position:absolute; left:64px; right:64px; top:170px; height:${BAND.y - 170 - 26}px;
  display:flex; flex-direction:column; justify-content:flex-end; align-items:center;
  text-align:center; gap:18px; }
.kicker { font-size:${TYPE.kicker}px; font-weight:700; letter-spacing:.34em;
  text-shadow:0 2px 16px rgba(0,0,0,.55); }
.chip { display:inline-block; padding:12px 34px; border-radius:999px;
  background:rgba(13,95,116,.9); font-size:${TYPE.chip}px; font-weight:700;
  letter-spacing:.1em; box-shadow:0 4px 18px rgba(0,0,0,.35); }
.title { font-size:${titlePx}px; line-height:1.14; font-weight:700; letter-spacing:-.01em;
  font-family:Georgia,'Malgun Gothic',serif; text-shadow:0 3px 20px rgba(0,0,0,.6);
  max-width:952px; }
.sub { font-size:${TYPE.sub}px; opacity:.95; text-shadow:0 2px 14px rgba(0,0,0,.55);
  max-width:952px; }
.bottom { position:absolute; left:80px; right:80px; top:${BAND.y + BAND.h + 52}px;
  height:${1840 - BAND.y - BAND.h - 52}px; display:flex; flex-direction:column;
  align-items:center; gap:30px; text-align:center; }
.caption { font-size:${TYPE.caption}px; line-height:${TYPE.captionLineHeight};
  font-weight:600; max-width:920px; text-shadow:0 2px 16px rgba(0,0,0,.6); }
.prints { display:flex; gap:26px; justify-content:center; align-items:flex-start; }
.prints img { width:212px; box-shadow:0 10px 28px rgba(0,0,0,.45); border-radius:4px; }
.prints img:nth-child(1) { transform:rotate(-3deg); }
.prints img:nth-child(2) { transform:rotate(2deg) translateY(10px); }
.prints img:nth-child(3) { transform:rotate(-1.5deg); }
.prints img:nth-child(4) { transform:rotate(2.6deg) translateY(8px); }
.deter { position:absolute; left:0; right:0; top:52%; transform:translateY(-50%) rotate(-19deg);
  text-align:center; pointer-events:none;
  font-size:30px; font-weight:700; letter-spacing:.06em; line-height:1.5;
  color:rgba(255,255,255,.17);
  text-shadow:0 1px 3px rgba(0,0,0,.42), 0 0 1px rgba(0,0,0,.5); }
.deter b { display:block; font-weight:800; letter-spacing:.12em; font-size:34px; }
.watermark { position:absolute; top:1856px; width:100%; text-align:center;
  font-size:${TYPE.watermark}px; font-weight:500; color:rgba(255,255,255,.72);
  text-shadow:0 1px 8px rgba(0,0,0,.6); }
</style></head><body>
<div class="top">
  ${o.kicker ? `<div class="kicker">${esc(o.kicker)}</div>` : ''}
  ${o.point ? `<div class="chip">POINT ${o.point.n} / ${o.point.of}</div>` : ''}
  ${o.chip ? `<div class="chip">${esc(o.chip)}</div>` : ''}
  ${o.title ? `<div class="title">${esc(o.title)}</div>` : ''}
  ${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}
</div>
<div class="bottom">
  ${o.prints?.length ? `<div class="prints">${o.prints.map((p) => `<img src="${p}"/>`).join('')}</div>` : ''}
  ${o.caption ? `<div class="caption">${esc(o.caption)}</div>` : ''}
</div>
<div class="deter"><b>AtoC KOREA</b>Property of AtoC Korea. Unauthorised use will be pursued to the full extent of the law.<br/>© AtoC Korea — 본 영상은 AtoC Korea 의 자산입니다. 무단 도용·복제·재배포 시 법적 책임을 반드시 추궁합니다.</div>
<div class="watermark">© AtoC Korea · Unauthorized copying or redistribution prohibited</div>
<script>
const anims = [];
const an = (el, delay) => { if (!el) return;
  const a = el.animate(
    [{ transform:'translateY(26px)', opacity:0 }, { transform:'translateY(0)', opacity:1 }],
    { fill:'both', easing:'cubic-bezier(0.22,1,0.36,1)', delay, duration:820 });
  a.pause(); anims.push(a); };
let i = 0;
for (const sel of ['.kicker','.chip','.title','.sub','.prints','.caption'])
  document.querySelectorAll(sel).forEach((el) => an(el, 220 + (i++) * 150));
window.__seek = (t) => anims.forEach((a) => { a.currentTime = t; });
window.__measure = () => {
  const lines = (el, lh) => el ? Math.round(el.scrollHeight / lh) : 0;
  const top = document.querySelector('.top');
  const bottom = document.querySelector('.bottom');
  const title = document.querySelector('.title');
  const caption = document.querySelector('.caption');
  return {
    topOverflow: top ? Math.max(0, top.scrollHeight - top.clientHeight) : 0,
    bottomOverflow: bottom ? Math.max(0, bottom.scrollHeight - bottom.clientHeight) : 0,
    titleLines: lines(title, ${titlePx} * 1.14),
    captionLines: lines(caption, ${TYPE.caption} * ${TYPE.captionLineHeight}),
  };
};
window.__seek(0);
</script></body></html>`;
}

/**
 * The 16:9 shell — same information, different room.
 *
 * The vertical has margins to put text in; the wide does not, so the layout is
 * a corner block (who/where you are) and a lower third (what this is and why),
 * both over gradient scrims rather than over bare footage. Cold open, promise
 * and recap centre instead, because they are cards rather than labels.
 *
 * The clean master is never dressed in place — this shell is composited into a
 * separate `-wide.mp4`, so the vertical can go on lifting an untouched band.
 */
export function buildWideScene(o) {
  const T = TYPE_WIDE;
  const hero = o.role === 'title' || o.role === 'promise' || o.role === 'recap';
  const titlePx = o.role === 'title' ? T.titleHero : T.title;

  // 🔴 A scrim exists to make ITS OWN text readable, so it has to scale with the
  // text that is actually there. Fixed scrims put a 520px band at 86% across the
  // bottom of a beat carrying nothing but the watermark, and the owner read the
  // result as a filter: "귀퉁이에 시커먼 오버레이". Measured on one such frame,
  // the dressing cost the bottom-right corner 53% of its luma (127 → 59).
  // Lower third present → full scrim. Watermark only → a slim, weak one.
  const hasLower = Boolean(o.title || o.sub || o.caption);
  const bottom = hasLower
    ? { h: 470, a0: 0.78, a1: 0.36, stop: 46 }
    : { h: 168, a0: 0.50, a1: 0.16, stop: 52 };
  // Same for the corner block: a lone kicker needs far less cover than a kicker
  // plus two chips.
  const corner = (o.point || o.chip)
    ? { w: 1020, h: 440, a: 0.50 }
    : { w: 760, h: 300, a: 0.36 };

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${WIDE.w}px; height:${WIDE.h}px; overflow:hidden; background:transparent; }
body { font-family:'Segoe UI','Malgun Gothic',-apple-system,sans-serif; color:#fff; }
.scrim-b { position:absolute; left:0; right:0; bottom:0; height:${bottom.h}px;
  background:linear-gradient(to top, rgba(6,14,26,${bottom.a0}) 0%, rgba(6,14,26,${bottom.a1}) ${bottom.stop}%, transparent 100%); }
.scrim-t { position:absolute; inset:0;
  background:radial-gradient(ellipse ${corner.w}px ${corner.h}px at 0% 0%, rgba(6,14,26,${corner.a}), transparent 66%); }
.scrim-hero { position:absolute; inset:0; background:rgba(6,14,26,.46); }
.corner { position:absolute; left:72px; top:56px; height:132px;
  display:flex; flex-direction:column; align-items:flex-start; gap:14px; }
.kicker { font-size:${T.kicker}px; font-weight:700; letter-spacing:.3em;
  text-shadow:0 2px 14px rgba(0,0,0,.6); }
.chip { display:inline-block; padding:9px 26px; border-radius:999px;
  background:rgba(13,95,116,.92); font-size:${T.chip}px; font-weight:700; letter-spacing:.1em;
  box-shadow:0 4px 16px rgba(0,0,0,.4); }
.lower { position:absolute; left:72px; right:480px; bottom:72px; height:400px;
  display:flex; flex-direction:column; justify-content:flex-end; gap:16px; }
.hero { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center; gap:22px; padding:0 160px; }
.title { font-size:${titlePx}px; line-height:1.12; font-weight:700; letter-spacing:-.01em;
  font-family:Georgia,'Malgun Gothic',serif; text-shadow:0 4px 22px rgba(0,0,0,.62); }
.sub { font-size:${T.sub}px; opacity:.95; text-shadow:0 2px 14px rgba(0,0,0,.6); }
.caption { font-size:${T.caption}px; line-height:${T.captionLineHeight}; font-weight:600;
  text-shadow:0 2px 16px rgba(0,0,0,.66); }
.prints { display:flex; gap:22px; justify-content:center; }
.prints img { width:186px; box-shadow:0 10px 26px rgba(0,0,0,.5); border-radius:3px; }
.prints img:nth-child(odd) { transform:rotate(-2.6deg); }
.prints img:nth-child(even) { transform:rotate(2.2deg) translateY(9px); }
.deter { position:absolute; left:0; right:0; top:52%; transform:translateY(-50%) rotate(-19deg);
  text-align:center; pointer-events:none;
  font-size:26px; font-weight:700; letter-spacing:.06em; line-height:1.5;
  color:rgba(255,255,255,.17);
  text-shadow:0 1px 3px rgba(0,0,0,.42), 0 0 1px rgba(0,0,0,.5); }
.deter b { display:block; font-weight:800; letter-spacing:.12em; font-size:30px; }
.watermark { position:absolute; top:1026px; width:100%; text-align:center;
  font-size:${T.watermark}px; font-weight:500; color:rgba(255,255,255,.74);
  text-shadow:0 1px 8px rgba(0,0,0,.7); }
</style></head><body>
${hero ? '<div class="scrim-hero"></div>' : '<div class="scrim-t"></div><div class="scrim-b"></div>'}
${hero ? `
<div class="hero">
  ${o.kicker ? `<div class="kicker">${esc(o.kicker)}</div>` : ''}
  ${o.prints?.length ? `<div class="prints">${o.prints.map((p) => `<img src="${p}"/>`).join('')}</div>` : ''}
  ${o.chip ? `<div class="chip">${esc(o.chip)}</div>` : ''}
  ${o.title ? `<div class="title">${esc(o.title)}</div>` : ''}
  ${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}
  ${o.caption ? `<div class="caption">${esc(o.caption)}</div>` : ''}
</div>` : `
<div class="corner">
  ${o.kicker ? `<div class="kicker">${esc(o.kicker)}</div>` : ''}
  ${o.point ? `<div class="chip">POINT ${o.point.n} / ${o.point.of}</div>` : ''}
  ${o.chip ? `<div class="chip">${esc(o.chip)}</div>` : ''}
</div>
<div class="lower">
  ${o.title ? `<div class="title">${esc(o.title)}</div>` : ''}
  ${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}
  ${o.caption ? `<div class="caption">${esc(o.caption)}</div>` : ''}
</div>`}
<div class="deter"><b>AtoC KOREA</b>Property of AtoC Korea. Unauthorised use will be pursued to the full extent of the law.<br/>© AtoC Korea — 본 영상은 AtoC Korea 의 자산입니다. 무단 도용·복제·재배포 시 법적 책임을 반드시 추궁합니다.</div>
<div class="watermark">© AtoC Korea · Unauthorized copying or redistribution prohibited</div>
<script>
const anims = [];
const an = (el, delay) => { if (!el) return;
  const a = el.animate(
    [{ transform:'translateY(22px)', opacity:0 }, { transform:'translateY(0)', opacity:1 }],
    { fill:'both', easing:'cubic-bezier(0.22,1,0.36,1)', delay, duration:780 });
  a.pause(); anims.push(a); };
let i = 0;
for (const sel of ['.scrim-t','.scrim-b','.scrim-hero','.kicker','.chip','.prints','.title','.sub','.caption'])
  document.querySelectorAll(sel).forEach((el) => an(el, 180 + (i++) * 130));
window.__seek = (t) => anims.forEach((a) => { a.currentTime = t; });
window.__measure = () => {
  const lines = (el, lh) => el ? Math.round(el.scrollHeight / lh) : 0;
  const over = (el) => el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
  return {
    topOverflow: over(document.querySelector('.corner')) + over(document.querySelector('.hero')),
    bottomOverflow: over(document.querySelector('.lower')),
    titleLines: lines(document.querySelector('.title'), ${titlePx} * 1.12),
    captionLines: lines(document.querySelector('.caption'), ${T.caption} * ${T.captionLineHeight}),
  };
};
window.__seek(0);
</script></body></html>`;
}
