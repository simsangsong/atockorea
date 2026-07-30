/**
 * F2/F4 — the scene vocabulary, rendered as one self-contained HTML document.
 *
 * Playwright loads this, steps `window.__seek(ms)` frame by frame, and
 * `window.__measure()` reports whether anything overflowed or wrapped past its
 * line budget. The builder FAILS the render on a violation rather than shipping
 * a frame with clipped text — that check is also what catches a silent font
 * fallback, because a substituted face changes the line count.
 *
 * Every scene draws from `design.mjs` and nothing else. The rules that make it
 * look composed rather than assembled (plan §A-3) are structural here, not
 * conventions to remember:
 *   · one accent, reachable only through `p.accent`
 *   · two type registers, and the gate counts font-family declarations
 *   * cards hold real screenshots — `card-grid`/`screen-focus` REQUIRE a shot
 *   · four corner micro-labels on every frame
 *   · motion is entrance only; there are no decorative transitions
 */

import fs from 'node:fs';
import path from 'node:path';
import { CANVAS, WIDE, GRID, MOTION, SUBTITLE, TYPE, TYPE_WIDE, FONT, palette } from './design.mjs';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline a PNG so the page has zero external requests (and no 404 surprises). */
function dataUri(file) {
  if (!file) return null;
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`scene asset missing: ${abs}`);
  return `data:image/png;base64,${fs.readFileSync(abs).toString('base64')}`;
}

function corners(chrome, wide) {
  const c = chrome ?? {};
  return `
  <div class="corner tl">${esc(c.tl ?? 'ATOC KOREA · APP GUIDE')}</div>
  <div class="corner tr">${esc(c.tr ?? '')}</div>
  <div class="corner bl">${esc(c.bl ?? '')}</div>
  <div class="corner br">${esc(c.br ?? (wide ? '16:9' : '9:16'))}</div>`;
}

/**
 * A shot is drawn at its OWN aspect ratio.
 *
 * The first cut forced every crop into a 390/844 phone box with `object-fit:
 * cover`, so a wide card crop rendered as a vertical slice of its own middle —
 * unreadable, and the opposite of "the card holds the real screen".
 */
function shotFigure(shot, className = 'shot') {
  if (!shot) return '';
  const ratio = shot.ratio ? `style="aspect-ratio:${shot.ratio}"` : '';
  return `<div class="${className}" ${ratio}><img src="${dataUri(shot.file ?? shot)}" alt=""></div>`;
}

/* ── scene bodies ─────────────────────────────────────────────────────────── */

function titleCard(s) {
  return `
  <section class="stage title-card">
    <div class="ghost" data-anim="ghost">${esc(s.ghost ?? '')}</div>
    <div class="block">
      <p class="eyebrow" data-anim="eyebrow">${esc(s.eyebrow ?? '')}</p>
      <h1 class="headline" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
      ${s.sub ? `<p class="sub" data-anim="sub">${esc(s.sub)}</p>` : ''}
    </div>
    ${s.progress ? `<div class="progress"><span style="width:${Math.round(s.progress * 100)}%"></span></div>` : ''}
  </section>`;
}

function screenFocus(s) {
  if (!s.shot) throw new Error(`screen-focus needs a real screenshot: ${s.id}`);
  return `
  <section class="stage screen-focus">
    <div class="block top">
      <p class="eyebrow" data-anim="eyebrow">${esc(s.eyebrow ?? '')}</p>
      <h1 class="headline tight" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
    </div>
    <div class="focus" data-anim="shot">
      ${shotFigure(s.shot)}
      ${s.ring ? `<div class="ring" style="${ringStyle(s.ring)}" data-anim="ring"></div>` : ''}
    </div>
    ${s.note ? `<p class="note" data-anim="note">${esc(s.note)}</p>` : ''}
  </section>`;
}

/** `ring: {x,y,w,h}` in 0..1 of the shot box — a callout on the real UI. */
function ringStyle(r) {
  return `left:${(r.x * 100).toFixed(2)}%;top:${(r.y * 100).toFixed(2)}%;`
    + `width:${(r.w * 100).toFixed(2)}%;height:${(r.h * 100).toFixed(2)}%`;
}

function cardGrid(s) {
  const cards = (s.cards ?? []).slice(0, 4);
  if (cards.length === 0) throw new Error(`card-grid needs cards: ${s.id}`);
  for (const c of cards) {
    if (!c.shot) throw new Error(`card-grid card without a screenshot (§H): ${s.id} / ${c.title}`);
  }
  const cols = cards.length <= 2 ? 1 : 2;
  return `
  <section class="stage card-grid">
    <div class="block top">
      <p class="eyebrow" data-anim="eyebrow">${esc(s.eyebrow ?? '')}</p>
      <h1 class="headline tight" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
    </div>
    <div class="cards cols-${cols}">
      ${cards.map((c, i) => `
      <figure class="card${c.active ? ' active' : ''}" data-anim="card" data-i="${i}">
        ${shotFigure(c.shot, 'card-shot')}
        <figcaption>
          <p class="card-title">${esc(c.title ?? '')}</p>
          ${c.sub ? `<p class="card-sub">${esc(c.sub)}</p>` : ''}
        </figcaption>
      </figure>`).join('')}
    </div>
  </section>`;
}

function stepList(s) {
  const steps = (s.steps ?? []).slice(0, 5);
  // The layout follows the ASSET, not a habit. A landscape crop beside a list
  // gets squeezed to a third of the frame and stops being readable — which is
  // the same failure as using an icon. Wide shots go BELOW the steps at full
  // width; only a tall (phone-shaped) shot earns the side column.
  // Threshold is 0.62, not 1: a near-square crop (the schedule panel is 0.87)
  // still loses to a side column — measured, it rendered 470px wide while the
  // step text next to it wrapped every line into three. Only a phone-shaped
  // shot, taller than roughly 8:5, is worth standing beside the list.
  const stacked = !s.shot?.ratio || s.shot.ratio > 0.62;
  return `
  <section class="stage step-list">
    <div class="block top">
      <p class="eyebrow" data-anim="eyebrow">${esc(s.eyebrow ?? '')}</p>
      <h1 class="headline tight" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
    </div>
    <div class="split${stacked ? ' stacked' : ''}">
      <ol class="steps">
        ${steps.map((t, i) => `
        <li data-anim="step" data-i="${i}">
          <span class="n">${String(i + 1).padStart(2, '0')}</span>
          <span class="t">${esc(t)}</span>
        </li>`).join('')}
      </ol>
      ${s.shot ? `<div class="side" data-anim="shot">${shotFigure(s.shot)}
        ${s.ring ? `<div class="ring" style="${ringStyle(s.ring)}" data-anim="ring"></div>` : ''}</div>` : ''}
    </div>
  </section>`;
}

function outro(s) {
  return `
  <section class="stage outro">
    <div class="block center">
      <h1 class="headline" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
      ${s.sub ? `<p class="sub" data-anim="sub">${esc(s.sub)}</p>` : ''}
    </div>
  </section>`;
}

const SCENES = {
  'title-card': titleCard,
  'screen-focus': screenFocus,
  'card-grid': cardGrid,
  'step-list': stepList,
  outro,
};

/* ── the document ─────────────────────────────────────────────────────────── */

export function renderSceneHtml(scene, opts = {}) {
  const wide = Boolean(opts.wide);
  const theme = scene.theme ?? opts.theme ?? 'light';
  const p = palette(theme);
  const t = wide ? TYPE_WIDE : TYPE;
  const size = wide ? WIDE : CANVAS;
  const build = SCENES[scene.scene];
  if (!build) throw new Error(`unknown scene type: ${scene.scene}`);

  const margin = wide ? 96 : GRID.margin;
  const zone = wide ? SUBTITLE.wide : SUBTITLE.vertical;
  // The caption fades in with everything else. Without data-anim it popped to
  // full opacity on frame 0 while the rest of the frame was still arriving —
  // one element out of step is more noticeable than no animation at all.
  const caption = scene.caption
    ? `<p class="caption" data-measure="caption" data-anim="caption">${esc(scene.caption)}</p>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  /* The display family is declared on the ROOT, not on body: an element that
     escapes body's cascade would otherwise fall to the browser serif, and the
     two-register gate below would count it as a third typeface — which is
     exactly what it is. */
  html{word-break:keep-all;overflow-wrap:break-word;font-family:${FONT.display}}
  body{width:${size.w}px;height:${size.h}px;background:${p.canvas};color:${p.ink};
       font-family:${FONT.display};-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}
  .corner{position:absolute;font-family:${FONT.chrome};font-size:${t.chrome}px;letter-spacing:.16em;
          text-transform:uppercase;color:${p.chrome};white-space:nowrap}
  .tl{top:${margin}px;left:${margin}px}.tr{top:${margin}px;right:${margin}px}
  .bl{bottom:${margin}px;left:${margin}px}.br{bottom:${margin}px;right:${margin}px}

  .stage{position:absolute;top:${margin + 70}px;left:${margin}px;right:${margin}px;bottom:${zone.stageBottom}px;
         display:flex;flex-direction:column;justify-content:center;gap:${wide ? 40 : 56}px}
  .block{display:flex;flex-direction:column;gap:${wide ? 16 : 22}px}
  .block.top{justify-content:flex-start}
  .block.center{align-items:center;text-align:center}
  .eyebrow{font-family:${FONT.chrome};font-size:${t.eyebrow}px;letter-spacing:.2em;
           text-transform:uppercase;color:${p.chrome}}
  .headline{font-size:${t.headline}px;line-height:1.14;font-weight:800;letter-spacing:-.02em}
  .headline.tight{font-size:${t.headlineTight}px}
  .sub{font-size:${t.sub}px;line-height:1.45;color:${p.inkSoft};font-weight:500}
  .note{font-size:${t.sub}px;line-height:1.45;color:${p.inkSoft};font-weight:500}

  .ghost{position:absolute;top:${wide ? -60 : -40}px;right:${-margin / 2}px;font-size:${t.ghost}px;
         font-weight:800;line-height:.8;color:${theme === 'dark' ? p.ghost : p.accentSoft};
         z-index:0;pointer-events:none}
  .title-card .block{position:relative;z-index:1}
  .progress{height:6px;background:${p.hairline};border-radius:3px;overflow:hidden}
  .progress span{display:block;height:100%;background:${p.accent}}

  .shot,.card-shot{overflow:hidden;border-radius:${GRID.cardRadius}px;background:${p.card};
        border:1px solid ${p.hairline};box-shadow:0 24px 60px rgba(16,16,16,.10)}
  /* object-fit contain on a box that already carries the shot's own ratio: the
     picture is never cropped nor stretched, so a crop stays legible at any size.
     (No backticks in here — this string is a template literal.) */
  .shot img,.card-shot img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}

  .focus{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
  .focus .shot{max-height:100%;max-width:100%}
  .ring{position:absolute;border:5px solid ${p.accent};border-radius:20px;
        box-shadow:0 0 0 10px ${p.accentSoft}}

  .cards{display:grid;gap:${GRID.gutter}px;flex:1;min-height:0}
  .cards.cols-1{grid-template-columns:1fr}
  .cards.cols-2{grid-template-columns:1fr 1fr}
  .card{display:flex;flex-direction:column;background:${p.card};border-radius:${GRID.cardRadius}px;
        border:2px solid transparent;overflow:hidden;box-shadow:0 20px 48px rgba(16,16,16,.10)}
  .card .card-shot{flex:1;min-height:0;border:0;border-radius:0;box-shadow:none;aspect-ratio:auto!important}
  .card .card-shot img{object-fit:cover;object-position:top center}
  .card figcaption{padding:${wide ? 18 : 26}px ${wide ? 20 : 28}px;display:flex;flex-direction:column;gap:6px}
  .card-title{font-size:${t.cardTitle}px;font-weight:750;line-height:1.2}
  .card-sub{font-size:${t.cardSub}px;color:${p.inkSoft};line-height:1.35}
  .card.active{border-color:${p.accent};transform:translateY(-10px)}
  .card.active .card-sub{color:${p.accent}}

  .split{display:flex;gap:${GRID.gutter + 16}px;flex:1;min-height:0;align-items:center}
  .split.stacked{flex-direction:column;align-items:stretch;justify-content:center}
  .split.stacked .side{width:100%;flex:1;min-height:0;justify-content:center}
  .split.stacked .steps{flex:none}
  .steps{list-style:none;display:flex;flex-direction:column;gap:${wide ? 22 : 34}px;flex:1}
  .steps li{display:flex;gap:${wide ? 18 : 26}px;align-items:baseline}
  .steps .n{font-family:${FONT.chrome};font-size:${t.chrome + 4}px;color:${p.accent};letter-spacing:.1em}
  .steps .t{font-size:${t.step}px;line-height:1.35;font-weight:650}
  .side{position:relative;width:${wide ? 340 : 470}px;flex:none;display:flex;align-items:center}
  .side .shot{width:100%;max-height:100%}

  .caption{position:absolute;left:${margin}px;right:${margin}px;bottom:${zone.englishBottom}px;
           font-size:${t.caption}px;line-height:${TYPE.captionLineHeight};font-weight:650;text-align:center}

  [data-anim]{opacity:0}
  </style></head><body>
  ${corners(scene.chrome, wide)}
  ${build(scene)}
  ${caption}
  <script>
  (function(){
    const E=${MOTION.entrance}, S=${MOTION.stagger};
    const nodes=[...document.querySelectorAll('[data-anim]')];
    // Entrance order is the reading order, and cards carry an extra per-index
    // stagger because the point of the animation is that the explanation grows
    // by one item, not that things move.
    const delayOf=(el,i)=>{
      const idx=el.dataset.i!==undefined?Number(el.dataset.i):null;
      const base=i*90;
      return idx===null?base:400+idx*S;
    };
    window.__seek=function(ms){
      nodes.forEach(function(el,i){
        const d=delayOf(el,i);
        const p=Math.max(0,Math.min(1,(ms-d)/E));
        const e=1-Math.pow(1-p,3);
        el.style.opacity=String(e);
        el.style.transform='translateY('+((1-e)*26).toFixed(2)+'px)';
        if(el.classList.contains('card')&&el.classList.contains('active')){
          el.style.transform='translateY('+(((1-e)*26)-10).toFixed(2)+'px)';
        }
      });
    };
    window.__measure=function(){
      const r={};
      const h=document.querySelector('[data-measure="headline"]');
      const c=document.querySelector('[data-measure="caption"]');
      const lineCount=(el)=>{
        if(!el) return 0;
        const cs=getComputedStyle(el);
        const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
        return Math.round(el.getBoundingClientRect().height/lh);
      };
      r.headlineLines=lineCount(h);
      r.captionLines=lineCount(c);
      const stage=document.querySelector('.stage');
      const sb=stage?stage.getBoundingClientRect():{bottom:0,top:0,right:0,left:0};
      r.stageOverflow=Math.max(0,Math.round(sb.bottom-window.innerHeight),Math.round(-sb.top));
      // The locale subtitle strip must stay empty — native WebVTT paints there.
      const zoneTop=${zone.localeZoneTop};
      let intruder=null;
      document.querySelectorAll('.stage *, .caption').forEach(function(el){
        if(!el.textContent||!el.textContent.trim()) return;
        const b=el.getBoundingClientRect();
        if(b.height>0&&b.bottom>zoneTop) intruder=intruder||el.textContent.trim().slice(0,40);
      });
      r.subtitleZoneIntruder=intruder;
      // Two type registers, no more. A third family means the system broke —
      // or a face failed to load and something is silently drawing in serif.
      // Only elements that actually paint text are counted; <head>, <script>
      // and empty wrappers have computed fonts but no reader.
      const fams=new Set();
      document.querySelectorAll('body *').forEach(function(el){
        const own=[...el.childNodes].some(function(n){
          return n.nodeType===3&&n.nodeValue&&n.nodeValue.trim();
        });
        if(!own) return;
        const f=getComputedStyle(el).fontFamily;
        if(f) fams.add(f.split(',')[0].replace(/["']/g,'').trim());
      });
      r.fontFamilies=[...fams];
      // CJK must never break between two characters (CLAUDE.md P1-5).
      const CJK=/[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]/;
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const broken=[];let n;
      while((n=w.nextNode())){
        const tx=n.nodeValue||'';
        if(tx.trim().length<2||!CJK.test(tx)) continue;
        for(let i=0;i<tx.length-1;i++){
          if(!CJK.test(tx[i])||!CJK.test(tx[i+1])) continue;
          const rg=document.createRange();rg.setStart(n,i);rg.setEnd(n,i+2);
          const rects=[...rg.getClientRects()].filter(function(x){return x.width>0||x.height>0});
          if(rects.length>1&&Math.abs(rects[0].top-rects[rects.length-1].top)>1){
            broken.push(tx.slice(Math.max(0,i-5),i+1)+'|'+tx.slice(i+1,i+6));
          }
        }
      }
      r.cjkBroken=broken;
      return r;
    };
    window.__seek(0);
  })();
  </script></body></html>`;
}
