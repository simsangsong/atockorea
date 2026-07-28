/**
 * qa-lib/contrast-inject — the shared colour instrument for every QA walk.
 *
 * Why this file exists at all: on 2026-07-28 the ad-hoc contrast probes in this
 * repo were wrong THREE times in one session, and each wrong number changed a
 * decision.
 *
 *   1. rgba alpha was dropped, inventing a 2.06 text failure that did not exist.
 *   2. A "fix" moved a ratio 1.04 → 1.14 while the screenshot looked repaired
 *      (a shadow reads as a border to the eye), so the shot agreed with a lie.
 *   3. `color-mix()` computes to `color(srgb 0.65 …)` — 0-to-1 floats — and the
 *      reader treated them as 0-to-255, so light AND dark numbers were fiction.
 *
 * A measuring tape that is wrong in three different ways is worse than no tape,
 * because its output looks like evidence. So the parsing, the alpha compositing
 * and the WCAG maths live here once, are unit-tested (see
 * __tests__/scripts/contrastInject.test.ts), and every walk injects this instead
 * of rewriting them.
 *
 * Install with Playwright:  ctx.addInitScript({ path: 'scripts/qa-lib/contrast-inject.js' })
 * Then inside page.evaluate:  window.__tr.contrast(el, other)  etc.
 */
(() => {
  const clamp255 = (n) => Math.max(0, Math.min(255, n));

  /** Accepts a CSS number or percentage in a colour component slot. */
  function component(raw, scale) {
    const s = String(raw).trim();
    if (s.endsWith('%')) return clamp255((parseFloat(s) / 100) * 255);
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return clamp255(n * scale);
  }

  function alphaOf(raw) {
    if (raw === undefined || raw === null || raw === '') return 1;
    const s = String(raw).trim();
    if (s === 'none') return 1;
    const n = s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  }

  /**
   * Parse anything getComputedStyle can hand back for a colour.
   * Returns {r,g,b,a} with r/g/b in 0-255 and a in 0-1, or null if unparseable
   * — null, never a guess, because a guessed colour is how #1 and #3 happened.
   */
  function parseColor(input) {
    if (!input) return null;
    const value = String(input).trim().toLowerCase();
    if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (value === 'currentcolor' || value === 'none') return null;

    // #rgb / #rrggbb / #rrggbbaa
    const hex = /^#([0-9a-f]{3,8})$/.exec(value);
    if (hex) {
      const h = hex[1];
      const expand = (t) => parseInt(t.length === 1 ? t + t : t, 16);
      if (h.length === 3 || h.length === 4) {
        return {
          r: expand(h[0]),
          g: expand(h[1]),
          b: expand(h[2]),
          a: h.length === 4 ? expand(h[3]) / 255 : 1,
        };
      }
      if (h.length === 6 || h.length === 8) {
        return {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
          a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        };
      }
      return null;
    }

    // rgb()/rgba(), legacy commas or modern spaces, optional `/ alpha`.
    const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
    if (rgb) {
      const [main, alpha] = rgb[1].split('/');
      const parts = main.trim().split(/[\s,]+/).filter(Boolean);
      if (parts.length < 3) return null;
      return {
        r: component(parts[0], 1),
        g: component(parts[1], 1),
        b: component(parts[2], 1),
        a: alphaOf(alpha !== undefined ? alpha : parts[3]),
      };
    }

    // 🔴 color(srgb r g b / a) — the shape color-mix() resolves to. Components
    // are 0-to-1 here; reading them as 0-to-255 is failure mode #3 above.
    const modern = /^color\(\s*(srgb|srgb-linear)\s+([^)]+)\)$/.exec(value);
    if (modern) {
      const [main, alpha] = modern[2].split('/');
      const parts = main.trim().split(/\s+/).filter(Boolean);
      if (parts.length < 3) return null;
      const linear = modern[1] === 'srgb-linear';
      const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
      const raw = parts.slice(0, 3).map((p) => {
        const s = String(p).trim();
        const n = s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      });
      const conv = linear ? raw.map(toSrgb) : raw;
      return {
        r: clamp255(conv[0] * 255),
        g: clamp255(conv[1] * 255),
        b: clamp255(conv[2] * 255),
        a: alphaOf(alpha),
      };
    }

    return null;
  }

  /** Source-over compositing: `fg` painted on top of opaque-ish `bg`. */
  function over(fg, bg) {
    const a = fg.a;
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    };
  }

  function luminance(c) {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function ratio(a, b) {
    if (!a || !b) return null;
    const la = luminance(a);
    const lb = luminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * The colour a semi-transparent element actually sits on: walk ancestors,
   * collecting background layers until one is opaque, then composite back down.
   *
   * `approx` is set when a gradient/image is in the stack — those cannot be
   * resolved from computed style, and saying so is the point. A number that
   * quietly ignores the wallpaper under it is failure mode #1 wearing a hat.
   */
  function backdropOf(el, { skipSelf = true } = {}) {
    const layers = [];
    let node = skipSelf ? el.parentElement : el;
    let approx = false;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') approx = true;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    const bottom = layers.length && layers[layers.length - 1].a >= 0.999
      ? layers.pop()
      : { r: 255, g: 255, b: 255, a: 1 }; // canvas default
    let out = bottom;
    for (let i = layers.length - 1; i >= 0; i -= 1) out = over(layers[i], out);
    return { color: out, approx };
  }

  /** Own background composited onto its backdrop — the pixel you'd eyedrop. */
  function surfaceOf(el) {
    const cs = getComputedStyle(el);
    const own = parseColor(cs.backgroundColor);
    const back = backdropOf(el);
    const approx = back.approx || (cs.backgroundImage && cs.backgroundImage !== 'none');
    if (!own || own.a === 0) return { color: back.color, approx: Boolean(approx) };
    return { color: over(own, back.color), approx: Boolean(approx) };
  }

  /** Text colour of an element composited onto whatever is behind the glyphs. */
  function inkOf(el) {
    const cs = getComputedStyle(el);
    const ink = parseColor(cs.color);
    const bg = surfaceOf(el);
    if (!ink) return { color: null, approx: bg.approx };
    if (ink.a >= 0.999) return { color: ink, approx: bg.approx };
    return { color: over(ink, bg.color), approx: bg.approx };
  }

  const round = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
  const hex = (c) =>
    c
      ? '#' +
        [c.r, c.g, c.b]
          .map((v) => Math.round(v).toString(16).padStart(2, '0'))
          .join('')
      : null;

  window.__tr = {
    parseColor,
    over,
    luminance,
    ratio,
    backdropOf,
    surfaceOf,
    inkOf,
    hex,
    /** Non-text contrast (WCAG 1.4.11): a control's fill vs what surrounds it. */
    surfaceVsBackdrop(el) {
      const s = surfaceOf(el);
      const b = backdropOf(el);
      return {
        ratio: round(ratio(s.color, b.color)),
        surface: hex(s.color),
        backdrop: hex(b.color),
        approx: s.approx || b.approx,
      };
    },
    /**
     * "Can you see where this control ends?" — WCAG 1.4.11 is satisfied by ANY
     * visible boundary, so judging a chip by its fill alone understates it: N1
     * fixed those chips with a 1px `currentColor` border and the fill never
     * moved. Conversely a box-shadow is deliberately NOT counted here, because
     * a shadow is exactly what fooled the eye in this repo on 2026-07-28 while
     * the measured boundary had barely moved. Shadows are reported as a flag,
     * never as the number.
     */
    boundaryOf(el) {
      const s = getComputedStyle(el);
      const fill = surfaceOf(el);
      const back = backdropOf(el);
      const width = Math.max(
        parseFloat(s.borderTopWidth) || 0,
        parseFloat(s.borderBottomWidth) || 0,
        parseFloat(s.borderLeftWidth) || 0,
        parseFloat(s.borderRightWidth) || 0,
      );
      const raw = parseColor(s.borderTopColor);
      let edge = null;
      if (width > 0 && raw && raw.a > 0 && s.borderTopStyle !== 'none') {
        // The border box sits over the element's own background (background-clip
        // defaults to border-box), so that is what a translucent border blends with.
        const onFill = raw.a >= 0.999 ? raw : over(raw, fill.color);
        edge = Math.max(ratio(onFill, back.color) ?? 0, ratio(onFill, fill.color) ?? 0);
      }
      const fillEdge = ratio(fill.color, back.color);
      return {
        ratio: round(Math.max(edge ?? 0, fillEdge ?? 0)),
        via: edge !== null && edge >= (fillEdge ?? 0) ? 'border' : 'fill',
        borderWidth: width,
        fillRatio: round(fillEdge),
        borderRatio: round(edge),
        hasShadow: s.boxShadow !== 'none' && s.boxShadow !== '',
        approx: fill.approx || back.approx,
      };
    },
    /** Text contrast (WCAG 1.4.3) for the element's own label. */
    inkVsSurface(el) {
      const i = inkOf(el);
      const s = surfaceOf(el);
      return {
        ratio: round(ratio(i.color, s.color)),
        ink: hex(i.color),
        surface: hex(s.color),
        approx: i.approx || s.approx,
      };
    },
  };
})();
