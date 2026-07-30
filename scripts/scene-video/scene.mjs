/**
 * F2/F4 v3 — the scene vocabulary, rendered as one self-contained HTML document.
 *
 * Playwright loads this, steps `window.__seek(ms)` frame by frame, and
 * `window.__measure()` reports what the gates need. The builder FAILS the render
 * on a violation rather than shipping a clipped frame — that check is also what
 * catches a silent font fallback, because a substituted face changes line counts.
 *
 * v3 text model (owner brief §V3-A): the HEADLINE is English and the GLOSS
 * beneath it is that locale's reading. Nothing is burnt at the bottom any more,
 * so the native WebVTT band is simply left empty rather than negotiated with.
 *
 * Structural rules from §A-3, unchanged:
 *   · one accent, reachable only through `p.accent`
 *   · two type ROLES; a CJK gloss is the display role in another script, and is
 *     the only place an extra family may appear (marked data-script="cjk")
 *   · cards hold real screens — card-grid / screen-focus REQUIRE a shot
 *   · four corner micro-labels on every frame
 *   · motion is entrance only; no decorative transitions; no italic anywhere
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CANVAS, WIDE, GRID, MOTION, SCREEN, SUBTITLE, TYPE, TYPE_WIDE,
  FONT, glossFont, CJK_LOCALES, palette,
} from './design.mjs';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline a PNG so the page has zero external requests (and no 404 surprises). */
function dataUri(file) {
  if (!file) return null;
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`scene asset missing: ${abs}`);
  return `data:image/png;base64,${fs.readFileSync(abs).toString('base64')}`;
}

/**
 * The four micro-labels.
 *
 * They animate with everything else. Left static they were the last thing that
 * still changed instantly at a scene boundary — the whole frame would dissolve
 * away and then "PAGE 02 · THE ROOM" would snap to "PAGE 03 · TRANSLATION",
 * which is precisely the tick the motion grammar exists to remove.
 */
function corners(chrome, wide) {
  const c = chrome ?? {};
  return `
  <div class="corner tl" data-anim="chrome">${esc(c.tl ?? 'ATOC KOREA · APP GUIDE')}</div>
  <div class="corner tr" data-anim="chrome">${esc(c.tr ?? '')}</div>
  <div class="corner bl" data-anim="chrome">${esc(c.bl ?? '')}</div>
  <div class="corner br" data-anim="chrome">${esc(c.br ?? (wide ? '16:9' : '9:16'))}</div>`;
}

/**
 * A shot is drawn at its OWN aspect ratio.
 *
 * The first cut forced every crop into a 390/844 phone box with object-fit
 * cover, so a wide card crop rendered as a vertical slice of its own middle —
 * unreadable, and the opposite of "the card holds the real screen".
 */
function shotFigure(shot, className = 'shot') {
  if (!shot) return '';
  const ratio = shot.ratio ? `style="aspect-ratio:${shot.ratio}"` : '';
  return `<div class="${className}" ${ratio}><img src="${dataUri(shot.file ?? shot)}" alt=""></div>`;
}

/** The English line, and under it the locale's reading of the same sentence. */
function headBlock(s, { tight = false, center = false } = {}) {
  const gloss = s.gloss
    ? `<p class="gloss" data-script="cjk" data-measure="gloss" data-anim="gloss">${esc(s.gloss)}</p>`
    : '';
  return `
    <div class="block${center ? ' center' : ''}">
      ${s.eyebrow ? `<p class="eyebrow" data-anim="eyebrow">${esc(s.eyebrow)}</p>` : ''}
      <h1 class="headline${tight ? ' tight' : ''}" data-measure="headline" data-anim="headline">${esc(s.headline ?? '')}</h1>
      ${gloss}
    </div>`;
}

/* ── scene bodies ─────────────────────────────────────────────────────────── */

function titleCard(s) {
  return `
  <section class="stage title-card">
    <div class="ghost" data-anim="ghost">${esc(s.ghost ?? '')}</div>
    ${headBlock(s)}
    ${s.progress ? `<div class="progress"><span style="width:${Math.round(s.progress * 100)}%"></span></div>` : ''}
  </section>`;
}

function screenFocus(s) {
  if (!s.shot) throw new Error(`screen-focus needs a real screenshot: ${s.id}`);
  // A short landscape crop must not be centred inside a tall empty box — it
  // reads as a small object adrift (measured: a 1098×555 card filled 24% of the
  // frame with dead space above and below). Wide shots take the full width and
  // let the stage centre the headline+shot GROUP; only a tall phone shot needs
  // the box to flex.
  const tall = s.shot?.ratio ? s.shot.ratio < 0.62 : true;
  return `
  <section class="stage screen-focus">
    ${headBlock(s, { tight: true })}
    <div class="focus${tall ? ' tall' : ' wide'}" data-anim="shot">
      ${shotFigure(s.shot)}
      ${s.ring ? `<div class="ring" style="${ringStyle(s.ring)}" data-anim="ring"></div>` : ''}
    </div>
  </section>`;
}

/**
 * v3 — the clip scene. The shell is drawn with a HOLE where the recording goes;
 * ffmpeg lays the video underneath and this transparent PNG on top, which is how
 * the tour pipeline composites footage. `__measure().clipBox` reports exactly
 * where, so the builder never has to guess the geometry.
 */
function screenDemo(s) {
  return `
  <section class="stage screen-demo">
    ${headBlock(s, { tight: true })}
    <div class="clip-slot" data-anim="shot">
      <div class="clip-frame"></div>
    </div>
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
    ${headBlock(s, { tight: true })}
    <div class="cards cols-${cols}">
      ${cards.map((c, i) => `
      <figure class="card${c.active ? ' active' : ''}" data-anim="card" data-i="${i}">
        ${shotFigure(c.shot, 'card-shot')}
        <figcaption>
          <p class="card-title">${esc(c.title ?? '')}</p>
          ${c.gloss ? `<p class="card-sub" data-script="cjk">${esc(c.gloss)}</p>` : ''}
        </figcaption>
      </figure>`).join('')}
    </div>
  </section>`;
}

function stepList(s) {
  const steps = (s.steps ?? []).slice(0, 5);
  // The layout follows the ASSET, not a habit. A landscape crop beside a list
  // gets squeezed to a third of the frame and stops being readable — the same
  // failure as using an icon. Only a phone-shaped shot earns the side column.
  const stacked = !s.shot?.ratio || s.shot.ratio > 0.62;
  return `
  <section class="stage step-list">
    ${headBlock(s, { tight: true })}
    <div class="split${stacked ? ' stacked' : ''}">
      <ol class="steps">
        ${steps.map((t, i) => {
          const [en, gloss] = Array.isArray(t) ? t : [t, null];
          return `
        <li data-anim="step" data-i="${i}">
          <span class="n">${String(i + 1).padStart(2, '0')}</span>
          <span class="t">${esc(en)}${gloss ? `<span class="step-gloss" data-script="cjk">${esc(gloss)}</span>` : ''}</span>
        </li>`;
        }).join('')}
      </ol>
      ${s.shot ? `<div class="side" data-anim="shot">${shotFigure(s.shot)}</div>` : ''}
    </div>
  </section>`;
}

function outro(s) {
  return `
  <section class="stage outro">
    ${headBlock(s, { center: true })}
  </section>`;
}

const SCENES = {
  'title-card': titleCard,
  'screen-focus': screenFocus,
  'screen-demo': screenDemo,
  'card-grid': cardGrid,
  'step-list': stepList,
  outro,
};

/* ── the document ─────────────────────────────────────────────────────────── */

export function renderSceneHtml(scene, opts = {}) {
  const wide = Boolean(opts.wide);
  const theme = scene.theme ?? opts.theme ?? 'ink';
  const locale = opts.locale ?? 'en';
  const p = palette(theme);
  const t = wide ? TYPE_WIDE : TYPE;
  const size = wide ? WIDE : CANVAS;
  const build = SCENES[scene.scene];
  if (!build) throw new Error(`unknown scene type: ${scene.scene}`);

  const margin = wide ? 96 : GRID.margin;
  const zone = wide ? SUBTITLE.wide : SUBTITLE.vertical;
  const glossFamily = glossFont(locale);
  const isCjk = CJK_LOCALES.has(locale);

  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"><style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  /* The display family is declared on the ROOT, not on body: an element that
     escapes body's cascade would otherwise fall to the browser serif, and the
     role gate would count it as a third typeface — which is what it would be. */
  html{word-break:keep-all;overflow-wrap:break-word;font-family:${FONT.display};font-style:normal}
  body{width:${size.w}px;height:${size.h}px;background:${p.canvas};color:${p.ink};
       font-family:${FONT.display};font-style:normal;-webkit-font-smoothing:antialiased;
       overflow:hidden;position:relative}
  /* Owner brief: no italic. Belt and braces — the gate checks the computed
     value, this stops a UA default from introducing one. */
  i,em,cite,address,dfn,var{font-style:normal}

  .corner{position:absolute;font-family:${FONT.chrome};font-size:${t.chrome}px;letter-spacing:.16em;
          text-transform:uppercase;color:${p.chrome};white-space:nowrap}
  .tl{top:${margin}px;left:${margin}px}.tr{top:${margin}px;right:${margin}px}
  .bl{bottom:${margin}px;left:${margin}px}.br{bottom:${margin}px;right:${margin}px}

  .stage{position:absolute;top:${margin + 70}px;left:${margin}px;right:${margin}px;
         bottom:${zone.stageBottom}px;display:flex;flex-direction:column;
         justify-content:center;gap:${wide ? 40 : 52}px}
  .block{display:flex;flex-direction:column;gap:${wide ? 12 : 18}px}
  .block.center{align-items:center;text-align:center}
  .eyebrow{font-family:${FONT.chrome};font-size:${t.eyebrow}px;letter-spacing:.2em;
           text-transform:uppercase;color:${p.chrome}}
  .headline{font-size:${t.headline}px;line-height:1.1;font-weight:700;letter-spacing:-.02em}
  .headline.tight{font-size:${t.headlineTight}px}
  /* The gloss is a reading of the line above, so it is a clear step down. Two
     lines of similar weight would give the frame two protagonists again. */
  .gloss{font-size:${t.gloss}px;line-height:1.4;font-weight:400;color:${p.inkSoft};
         font-family:${glossFamily}}
  .sub{font-size:${t.sub}px;line-height:1.45;color:${p.inkSoft};font-weight:400}

  .ghost{position:absolute;top:${wide ? -60 : -40}px;right:${-margin / 2}px;font-size:${t.ghost}px;
         font-weight:700;line-height:.8;color:${p.ghost};z-index:0;pointer-events:none}
  .title-card .block{position:relative;z-index:1}
  .progress{height:6px;background:${p.hairline};border-radius:3px;overflow:hidden}
  .progress span{display:block;height:100%;background:${p.accent}}

  /* §V4-B — the screen treatment, in ONE place so every shot gets it. The bezel
     turns even a cropped card into a device; the rim is the only line that can
     separate a dark screen from a dark ground; the glow lifts without adding
     colour. See design.mjs SCREEN for why the filter values are tiny. */
  .shot,.card-shot{overflow:hidden;border-radius:${SCREEN.radius + SCREEN.bezel}px;
        background:${p.screen};padding:${SCREEN.bezel}px;
        border:${SCREEN.rimWidth}px solid ${p.hairline};
        box-shadow:${SCREEN.glow},inset 0 ${SCREEN.rimWidth}px 0 ${p.rim}}
  /* object-fit contain on a box that already carries the shot's own ratio: the
     picture is never cropped nor stretched, so a crop stays legible at any size. */
  .shot img,.card-shot img{display:block;width:100%;height:100%;object-fit:contain;
        object-position:center;border-radius:${SCREEN.radius}px;filter:${SCREEN.filter}}

  .focus{position:relative;min-height:0;display:flex;align-items:center;justify-content:center}
  .focus.tall{flex:1}
  .focus.tall .shot{height:100%;max-width:100%}
  .focus.wide{flex:0 1 auto}
  .focus.wide .shot{width:100%;max-height:100%}
  .ring{position:absolute;border:5px solid ${p.accent};border-radius:20px;
        box-shadow:0 0 0 10px ${p.accentSoft}}

  /* v3 clip slot — a transparent hole the recording plays through. */
  .clip-slot{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
  .clip-frame{height:100%;aspect-ratio:390/844;max-width:100%;
              border-radius:${SCREEN.radius + SCREEN.bezel}px;
              border:${SCREEN.rimWidth}px solid ${p.hairline};
              box-shadow:${SCREEN.glow},inset 0 ${SCREEN.rimWidth}px 0 ${p.rim}}

  .cards{display:grid;gap:${GRID.gutter}px;flex:1;min-height:0}
  .cards.cols-1{grid-template-columns:1fr}
  .cards.cols-2{grid-template-columns:1fr 1fr}
  .card{display:flex;flex-direction:column;background:${p.card};border-radius:${GRID.cardRadius}px;
        border:2px solid transparent;overflow:hidden;box-shadow:${p.shadow}}
  /* 🔴 object-fit cover cropped the sides off a wide card shot — a frame went
     out reading "rrived near Jusangjeolli Cliffs". A guide card that clips its
     own words is worse than one that letterboxes, so the plate holds the whole
     picture. (No backticks in this file's CSS — it is a template literal.) */
  .card .card-shot{flex:1;min-height:0;border:0;border-radius:0;box-shadow:none;
        aspect-ratio:auto!important;background:${p.screen};padding:${SCREEN.bezel}px}
  .card .card-shot img{object-fit:contain;object-position:center;border-radius:12px}
  .card figcaption{padding:${wide ? 18 : 24}px ${wide ? 20 : 28}px;display:flex;flex-direction:column;gap:4px}
  .card-title{font-size:${t.cardTitle}px;font-weight:650;line-height:1.2}
  .card-sub{font-size:${t.cardSub}px;color:${p.inkSoft};line-height:1.35;font-weight:400;
            font-family:${glossFamily}}
  .card.active{border-color:${p.accent};transform:translateY(-10px)}
  .card.active .card-sub{color:${p.accent}}

  .split{display:flex;gap:${GRID.gutter + 16}px;flex:1;min-height:0;align-items:center}
  .split.stacked{flex-direction:column;align-items:stretch;justify-content:center}
  .split.stacked .side{width:100%;flex:1;min-height:0;justify-content:center}
  .split.stacked .steps{flex:none}
  .steps{list-style:none;display:flex;flex-direction:column;gap:${wide ? 20 : 28}px;flex:1}
  .steps li{display:flex;gap:${wide ? 18 : 26}px;align-items:baseline}
  .steps .n{font-family:${FONT.chrome};font-size:${t.chrome + 4}px;color:${p.accent};letter-spacing:.1em}
  .steps .t{font-size:${t.step}px;line-height:1.3;font-weight:600}
  .step-gloss{display:block;font-size:${t.stepGloss}px;font-weight:400;color:${p.inkSoft};
              line-height:1.35;margin-top:4px;font-family:${glossFamily}}
  .side{position:relative;width:${wide ? 340 : 470}px;flex:none;display:flex;align-items:center}
  .side .shot{width:100%;max-height:100%}

  [data-anim]{opacity:0}
  </style></head><body data-locale="${esc(locale)}" data-theme="${esc(theme)}">
  ${corners(scene.chrome, wide)}
  ${build(scene)}
  <script>
  (function(){
    const E=${MOTION.entrance}, S=${MOTION.stagger};
    const X=${MOTION.exit}, XS=${MOTION.exitStagger};
    const nodes=[...document.querySelectorAll('[data-anim]')];
    // Entrance order is reading order; cards carry a per-index stagger because
    // the point of the animation is that the explanation grows by one item.
    const delayOf=function(el,i){
      const idx=el.dataset.i!==undefined?Number(el.dataset.i):null;
      return idx===null?i*90:400+idx*S;
    };
    // Cubic ease-out arriving, ease-in leaving: the frame accelerates away
    // rather than stopping dead, which is what makes the join disappear.
    const easeOut=function(p){return 1-Math.pow(1-p,3)};
    // Smoothstep leaving: gentle at both ends. A cubic ease-IN kept the frame
    // at half opacity most of the way and then dropped it, which felt like a
    // snap at the end of a slow move — the opposite of the intent.
    const easeInOut=function(p){return p*p*(3-2*p)};
    const paint=function(el,vis,lift){
      el.style.opacity=String(vis);
      // Chrome labels are anchored furniture: they dissolve, they do not drift.
      if(el.dataset.anim==='chrome') return;
      const active=el.classList.contains('card')&&el.classList.contains('active');
      el.style.transform='translateY('+(lift-(active?10:0)).toFixed(2)+'px)';
    };
    window.__seek=function(ms){
      nodes.forEach(function(el,i){
        const p=Math.max(0,Math.min(1,(ms-delayOf(el,i))/E));
        const e=easeOut(p);
        paint(el,e,(1-e)*24);
      });
    };
    /**
     * The exit. Its argument counts from the moment the beat begins to leave.
     *
     * The stagger runs the SAME direction as the entrance but far tighter, so
     * the frame empties as one gesture instead of unwinding itself. Elements
     * drift up as they go — the opposite of the entrance's rise, so nothing
     * looks like it is being put back.
     */
    window.__seekOut=function(ms){
      nodes.forEach(function(el,i){
        const p=Math.max(0,Math.min(1,(ms-i*XS)/X));
        const e=easeInOut(p);
        paint(el,1-e,-e*18);
      });
    };
    window.__measure=function(){
      const r={};
      const lineCount=function(el){
        if(!el) return 0;
        const cs=getComputedStyle(el);
        const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
        return Math.round(el.getBoundingClientRect().height/lh);
      };
      r.headlineLines=lineCount(document.querySelector('[data-measure="headline"]'));
      r.glossLines=lineCount(document.querySelector('[data-measure="gloss"]'));

      const stage=document.querySelector('.stage');
      const sb=stage?stage.getBoundingClientRect():{bottom:0,top:0};
      r.stageOverflow=Math.max(0,Math.round(sb.bottom-window.innerHeight),Math.round(-sb.top));

      // G-3 v3: the locale band is simply EMPTY. Nothing is burnt there now, so
      // any painted text below the line is a layout bug, not a near miss.
      const zoneTop=${zone.localeZoneTop};
      var intruder=null;
      document.querySelectorAll('.stage *').forEach(function(el){
        if(!el.textContent||!el.textContent.trim()) return;
        const b=el.getBoundingClientRect();
        if(b.height>0&&b.bottom>zoneTop&&!intruder) intruder=el.textContent.trim().slice(0,40);
      });
      r.subtitleZoneIntruder=intruder;

      // G-2 v3: count ROLES, not raw families. An extra family is legal only on
      // an element marked data-script="cjk", where the Latin face cannot draw
      // the script. A decorative third face still fails.
      const roles=new Set(); const displayFams=new Set();
      document.querySelectorAll('body *').forEach(function(el){
        const own=[...el.childNodes].some(function(n){
          return n.nodeType===3&&n.nodeValue&&n.nodeValue.trim();
        });
        if(!own) return;
        if(el.closest('[data-script="cjk"]')) return;   // the script companion
        const fam=(getComputedStyle(el).fontFamily||'').split(',')[0].replace(/["']/g,'').trim();
        if(el.closest('.corner')||el.classList.contains('eyebrow')||el.classList.contains('n')){
          roles.add('chrome:'+fam); return;
        }
        roles.add('display:'+fam);
        displayFams.add(fam);
      });
      r.roles=[...roles];
      r.displayFamilies=[...displayFams];

      // G-8: no italic, anywhere (owner brief).
      const italics=[];
      document.querySelectorAll('body *').forEach(function(el){
        const st=getComputedStyle(el).fontStyle;
        if(st&&st!=='normal'&&el.textContent&&el.textContent.trim()){
          italics.push(el.textContent.trim().slice(0,30)+' ['+st+']');
        }
      });
      r.italics=italics;

      // The clip hole, in canvas pixels, so the builder can scale the video to it.
      const slot=document.querySelector('.clip-frame');
      if(slot){
        const b=slot.getBoundingClientRect();
        r.clipBox={x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};
      }

      // CJK must never break between two characters (CLAUDE.md P1-5).
      const CJK=/[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]/;
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const broken=[];var n;
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
