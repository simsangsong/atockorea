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

/* ── v5 primitives — drawn information, not photographed screens ──────────── */

/**
 * The inline icon set. Line icons drawn here so the film has zero external
 * assets and one stroke weight everywhere; currentColor lets the accent state
 * recolour them without a second SVG.
 */
const ICONS = {
  chat: '<path d="M6 10h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H14l-6 5v-5H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"/>',
  guide: '<path d="M16 4l2.8 7.2L26 14l-7.2 2.8L16 24l-2.8-7.2L6 14l7.2-2.8z"/><path d="M25 22l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/>',
  pin: '<path d="M16 28s-9-8.1-9-14a9 9 0 0 1 18 0c0 5.9-9 14-9 14z"/><circle cx="16" cy="13.5" r="3.4"/>',
  bell: '<path d="M16 5a7 7 0 0 1 7 7v5l2.4 4H6.6L9 17v-5a7 7 0 0 1 7-7z"/><path d="M13 24a3 3 0 0 0 6 0"/>',
  hand: '<path d="M11 15V7.5a2 2 0 0 1 4 0V14m0-4.5a2 2 0 0 1 4 0V14m0-2.5a2 2 0 0 1 4 0V17c0 6-3 10-8.5 10S9 22.5 9 18.5V12a2 2 0 0 1 2 3z"/>',
  sos: '<path d="M16 4l12 6v7c0 7-5.4 10.6-12 13C9.4 27.6 4 24 4 17v-7z"/><path d="M16 11v7"/><circle cx="16" cy="22" r="0.6"/>',
  route: '<circle cx="7" cy="25" r="3"/><circle cx="25" cy="7" r="3"/><path d="M10 25h8a6 6 0 0 0 6-6v-6"/>',
  clock: '<circle cx="16" cy="16" r="11"/><path d="M16 10v6l4.5 3"/>',
  toggle: '<rect x="4" y="10" width="24" height="12" rx="6"/><circle cx="22" cy="16" r="4"/>',
  card: '<rect x="5" y="7" width="22" height="18" rx="3"/><path d="M9 13h9M9 17h14M9 21h11"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name] ?? ICONS.card;
  return `<svg class="ic ${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/**
 * `map-of-app` — the whole app on one card: a phone silhouette and its
 * features, each label CONNECTED to the phone and arriving one at a time.
 *
 * This is the film's skeleton (§V5): it opens the film half-lit, closes it
 * fully lit, and the closing frame is the summary of everything taught. The
 * arrival order is the teaching order — the motion carries the information.
 */
function mapOfApp(s) {
  const items = (s.items ?? []).slice(0, 6);
  const side = (i) => (i % 2 === 0 ? 'l' : 'r');
  return `
  <section class="stage map-of-app">
    ${headBlock(s, { tight: true })}
    <div class="atlas" data-anim="shot">
      <div class="atlas-phone">
        <span class="atlas-notch"></span>
        ${icon(s.phoneIcon ?? 'chat', 'atlas-core')}
      </div>
      ${items.map((it, i) => `
      <div class="atlas-item ${side(i)} ${it.active ? 'active' : ''}" data-anim="node" data-i="${i}"
           style="top:${(s.slots ?? [16, 30, 44, 58, 72, 86])[i]}%">
        <span class="atlas-line"></span>
        <span class="atlas-chip">${icon(it.icon)}</span>
        <span class="atlas-text">
          <span class="atlas-title">${esc(it.title)}</span>
          ${it.gloss ? `<span class="atlas-gloss" data-script="cjk">${esc(it.gloss)}</span>` : ''}
        </span>
      </div>`).join('')}
    </div>
  </section>`;
}

/**
 * `device-note` — a phone silhouette holding exactly ONE drawn element.
 *
 * The answer to "the screenshot has thirty things on it": a screen we draw has
 * one. The real app remains the proof elsewhere; this is the explanation.
 */
function deviceNote(s) {
  const n = s.note ?? {};
  return `
  <section class="stage device-note">
    ${headBlock(s, { tight: true })}
    <div class="device" data-anim="shot">
      <span class="atlas-notch"></span>
      <div class="device-note-card${n.accent ? ' accent' : ''}" data-anim="node" data-i="0">
        ${n.icon ? icon(n.icon) : ''}
        <span class="device-note-text">
          <span class="device-note-title">${esc(n.title ?? '')}</span>
          ${n.gloss ? `<span class="device-note-gloss" data-script="cjk">${esc(n.gloss)}</span>` : ''}
        </span>
      </div>
      ${n.under ? `<p class="device-under" data-anim="node" data-i="1">${esc(n.under)}</p>` : ''}
    </div>
  </section>`;
}

/**
 * `bubble-pair` — two chat bubbles arriving in order: the guest's language,
 * then Korean (or the reverse). Translation's point IS the round trip, so the
 * SEQUENCE is the information and a still could not carry it.
 */
function bubblePair(s) {
  const bubbles = (s.bubbles ?? []).slice(0, 3);
  return `
  <section class="stage bubble-pair">
    ${headBlock(s, { tight: true })}
    <div class="bubbles" data-anim="shot">
      ${bubbles.map((b, i) => `
      <div class="bub ${b.who === 'me' ? 'me' : 'them'}" data-anim="node" data-i="${i}">
        ${b.tag ? `<span class="bub-tag">${esc(b.tag)}</span>` : ''}
        <span class="bub-text" ${b.cjk ? 'data-script="cjk"' : ''}>${esc(b.text)}</span>
      </div>`).join('')}
    </div>
  </section>`;
}

/**
 * `flow-3` — up to three icon nodes joined by arrows, arriving left to right.
 * A procedure reads faster as a flow than as prose; the arrows and the arrival
 * order both say "then".
 */
function flow3(s) {
  const nodes = (s.nodes ?? []).slice(0, 3);
  return `
  <section class="stage flow-3">
    ${headBlock(s, { tight: true })}
    <div class="flow" data-anim="shot">
      ${nodes.map((n, i) => `
      ${i > 0 ? `<span class="flow-arrow" data-anim="node" data-i="${i * 2 - 1}">
        <svg viewBox="0 0 44 16" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 8h36m-6-5 6 5-6 5"/></svg></span>` : ''}
      <div class="flow-node${n.active ? ' active' : ''}" data-anim="node" data-i="${i * 2}">
        <span class="flow-chip">${icon(n.icon)}</span>
        <span class="flow-title">${esc(n.title)}</span>
        ${n.gloss ? `<span class="flow-gloss" data-script="cjk">${esc(n.gloss)}</span>` : ''}
      </div>`).join('')}
    </div>
  </section>`;
}

const SCENES = {
  'title-card': titleCard,
  'screen-focus': screenFocus,
  'screen-demo': screenDemo,
  'card-grid': cardGrid,
  'step-list': stepList,
  'map-of-app': mapOfApp,
  'device-note': deviceNote,
  'bubble-pair': bubblePair,
  'flow-3': flow3,
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

  /* ── v5 drawn-information primitives ─────────────────────────────────── */
  .ic{width:32px;height:32px;display:block}

  /* map-of-app: one phone, its features connected and lighting up in order. */
  .atlas{position:relative;flex:1;min-height:0}
  .atlas-phone{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    width:180px;height:380px;border-radius:30px;background:${p.screen};
    border:${SCREEN.rimWidth}px solid ${p.hairline};
    box-shadow:${SCREEN.glow},inset 0 ${SCREEN.rimWidth}px 0 ${p.rim};
    display:flex;align-items:center;justify-content:center}
  .atlas-notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);
    width:64px;height:8px;border-radius:4px;background:${p.hairline}}
  .atlas-core{width:52px;height:52px;color:${p.inkSoft};opacity:.5}
  .atlas-item{position:absolute;display:flex;align-items:center;gap:12px;max-width:330px}
  .atlas-item.l{right:calc(50% + 104px);flex-direction:row-reverse;text-align:right}
  .atlas-item.r{left:calc(50% + 104px)}
  .atlas-line{width:28px;height:2px;background:${p.hairline};flex:none}
  .atlas-item.active .atlas-line{background:${p.accent}}
  .atlas-chip{width:58px;height:58px;border-radius:16px;background:${p.card};
    border:1.5px solid ${p.hairline};display:flex;align-items:center;justify-content:center;
    color:${p.ink};flex:none}
  .atlas-chip .ic{width:28px;height:28px}
  .atlas-item.active .atlas-chip{border-color:${p.accent};color:${p.accent};
    background:${p.accentSoft}}
  .atlas-text{display:flex;flex-direction:column;gap:2px;min-width:0}
  /* overflow-wrap:normal — the frame shipped "Emergenc/y" once; a mid-word
     break in a five-word map is worse than a slightly wider column. */
  .atlas-title{font-size:32px;font-weight:650;line-height:1.18;
    overflow-wrap:normal;text-wrap:balance}
  .atlas-item.active .atlas-title{color:${p.accent}}
  .atlas-gloss{font-size:25px;color:${p.inkSoft};line-height:1.3;overflow-wrap:normal}

  /* device-note: a phone holding exactly one drawn element. */
  .device{position:relative;flex:1;min-height:0;max-height:660px;margin:0 auto;
    aspect-ratio:390/640;border-radius:44px;background:${p.screen};
    border:${SCREEN.rimWidth}px solid ${p.hairline};
    box-shadow:${SCREEN.glow},inset 0 ${SCREEN.rimWidth}px 0 ${p.rim};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:34px;padding:44px}
  .device .atlas-notch{top:20px}
  .device-note-card{display:flex;align-items:center;gap:20px;width:100%;
    background:${p.card};border:1.5px solid ${p.hairline};border-radius:22px;
    padding:26px 28px;color:${p.ink}}
  .device-note-card .ic{width:44px;height:44px;flex:none}
  .device-note-card.accent{border-color:${p.accent}}
  .device-note-card.accent .ic{color:${p.accent}}
  .device-note-text{display:flex;flex-direction:column;gap:4px;min-width:0}
  .device-note-title{font-size:38px;font-weight:650;line-height:1.2}
  .device-note-gloss{font-size:28px;color:${p.inkSoft};line-height:1.3}
  .device-under{font-size:28px;color:${p.inkSoft};text-align:center;line-height:1.4}

  /* bubble-pair: the round trip, in order. */
  .bubbles{display:flex;flex-direction:column;gap:26px;flex:0 1 auto;
    width:100%;max-width:760px;margin:0 auto}
  .bub{position:relative;max-width:82%;border-radius:24px;padding:24px 30px;
    font-size:40px;line-height:1.35;font-weight:500}
  .bub.me{align-self:flex-end;background:${p.accentSoft};color:${p.ink};
    border:1.5px solid ${p.accent};border-bottom-right-radius:8px}
  .bub.them{align-self:flex-start;background:${p.card};color:${p.ink};
    border:1.5px solid ${p.hairline};border-bottom-left-radius:8px}
  .bub-tag{display:block;font-family:${FONT.chrome};font-size:20px;
    letter-spacing:.14em;text-transform:uppercase;color:${p.inkSoft};margin-bottom:8px}

  /* flow-3: nodes joined by arrows, arriving in reading order. */
  .flow{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
    flex:0 1 auto;width:100%}
  .flow-node{display:flex;flex-direction:column;align-items:center;gap:14px;
    text-align:center;flex:1;min-width:0}
  .flow-chip{width:150px;height:150px;border-radius:34px;background:${p.card};
    border:1.5px solid ${p.hairline};display:flex;align-items:center;
    justify-content:center;color:${p.ink}}
  .flow-chip .ic{width:68px;height:68px}
  .flow-node.active .flow-chip{border-color:${p.accent};color:${p.accent};
    background:${p.accentSoft}}
  .flow-title{font-size:34px;font-weight:650;line-height:1.2;overflow-wrap:normal;text-wrap:balance}
  .flow-node.active .flow-title{color:${p.accent}}
  .flow-gloss{font-size:26px;color:${p.inkSoft};line-height:1.3;overflow-wrap:normal}
  .flow-arrow{color:${p.inkSoft};flex:none;display:flex;margin-top:63px}
  .flow-arrow svg{width:56px;height:24px}

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
      if(idx===null) return i*90;
      // Diagram nodes (map labels, flow steps, bubbles) are the information
      // itself, so they arrive on a slower clock than decorative card stagger:
      // one thought at a time, after the frame has settled.
      if(el.dataset.anim==='node') return 650+idx*430;
      return 400+idx*S;
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

      // G-2 v3: count ROLES, not raw families — and classify by the FAMILY the
      // element actually computed, not by a class list that has to be kept in
      // sync with every new scene (it fell out of sync the first time a new
      // primitive used a mono label). The failure this gate exists for is a
      // THIRD typeface, so: the chrome family is chrome wherever it appears,
      // the CJK companion is exempt where marked, everything else must be one
      // single display family.
      const chromeFirst=${JSON.stringify(FONT.chrome.split(',')[0].replace(/["']/g,'').trim())};
      const roles=new Set(); const displayFams=new Set();
      document.querySelectorAll('body *').forEach(function(el){
        const own=[...el.childNodes].some(function(n){
          return n.nodeType===3&&n.nodeValue&&n.nodeValue.trim();
        });
        if(!own) return;
        if(el.closest('[data-script="cjk"]')) return;   // the script companion
        const fam=(getComputedStyle(el).fontFamily||'').split(',')[0].replace(/["']/g,'').trim();
        if(fam===chromeFirst){ roles.add('chrome:'+fam); return; }
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
