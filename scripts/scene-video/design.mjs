/**
 * F2 — the design system, as numbers.
 *
 * These are the measured values from the reference deck (element-motion plan
 * §A), not invented ones. The plan's §A-3 argues the polish is subtraction, so
 * this file is deliberately short: one accent, two type registers, four corner
 * micro-labels, and a grid. Anything a scene wants beyond this list is a scene
 * asking for a third typeface — say no.
 *
 * Vertical is the master (1080×1920, plan §C-1). The reference deck was 16:9,
 * where four cards sit in a row; that does not survive a portrait frame, so the
 * card row becomes a 2×2 grid or a stack of three and the wide cut is derived
 * from the same spec.
 */

export const CANVAS = { w: 1080, h: 1920 };
export const WIDE = { w: 1920, h: 1080 };
export const FPS = 30;

/**
 * Light deck. Measured coverage: warm cream ~61% of frame, white cards ~11%,
 * near-black ink ~4%. The cream matters — pure white reads as an unstyled page
 * and pure grey reads as a wireframe.
 */
export const LIGHT = {
  canvas: '#f0ece5',
  card: '#ffffff',
  ink: '#101010',
  inkSoft: '#5d5851',
  /** THE accent. One. Used only for the active state. */
  accent: '#b0813c',
  accentSoft: '#f2e6d2',
  hairline: '#ded7cb',
  chrome: '#9a938a',
};

/** Dark deck — the same system inverted, warm black rather than neutral. */
export const DARK = {
  canvas: '#181510',
  card: '#221e18',
  ink: '#f6f1e8',
  inkSoft: '#a9a094',
  accent: '#d8a550',
  accentSoft: 'rgba(216, 165, 80, 0.16)',
  hairline: '#2f2a22',
  chrome: '#6b6459',
  /** The oversize ghost numeral: barely above the canvas, never a highlight. */
  ghost: '#221e18',
};

/**
 * Two registers. Not three.
 *   display — the sentence the viewer reads. Bold CJK-capable, left aligned.
 *   chrome  — mono, uppercase, wide tracking, low contrast. Labels only.
 * The CJK stack is explicit because a silent fallback is a failure this
 * pipeline has to catch, not inherit (the measure gate below reads line counts,
 * and a fallback font changes them).
 */
export const FONT = {
  display: "'Pretendard Variable', Pretendard, 'Noto Sans KR', -apple-system, 'Segoe UI', system-ui, sans-serif",
  chrome: "'JetBrains Mono', 'Consolas', 'SFMono-Regular', ui-monospace, monospace",
};

/**
 * Type scale on the 1080-wide canvas.
 *
 * The headline is ~1/8 of frame height (plan §A-3 item 6 — "글자가 실제로
 * 크다"), and the floor is the presbyopia floor the tour pipeline already
 * committed to: body copy never below 44px, spoken/narration lines 64px.
 */
export const TYPE = {
  eyebrow: 34,
  headline: 96,
  headlineTight: 84,
  sub: 46,
  cardTitle: 46,
  cardSub: 34,
  step: 46,
  chrome: 24,
  ghost: 520,
  caption: 64,
  captionLineHeight: 1.32,
  captionMaxLines: 2,
  headlineMaxLines: 3,
};

/** Wide is watched further away; apparent size, not a scaled copy. */
export const TYPE_WIDE = {
  ...TYPE,
  eyebrow: 26,
  headline: 78,
  headlineTight: 66,
  sub: 36,
  cardTitle: 34,
  cardSub: 26,
  step: 34,
  chrome: 20,
  ghost: 380,
  caption: 46,
};

export const GRID = {
  margin: 84,
  gutter: 32,
  radius: 28,
  cardRadius: 24,
  /** Cards occupy the middle third; the empty top and bottom are the design. */
  bandTop: 560,
  bandHeight: 800,
};

/**
 * The subtitle contract, both orientations, in one place.
 *
 * Native WebVTT paints at the BOTTOM CENTRE. Burn English anywhere near there
 * and the two overprint — the trap the tour pipeline already paid for (V6-D3).
 * So the frame is three bands from the bottom up:
 *
 *   localeZone   reserved for the player's track. NOTHING may enter it.
 *   english      the burnt-in line, immediately above that.
 *   stage        everything else, which must stop above the English.
 *
 * Keeping the numbers together is the point: they were separately plausible
 * and jointly wrong the first time — the wide caption sat inside its own
 * reserved strip, and the vertical stage overhung both.
 */
export const SUBTITLE = {
  vertical: {
    /** y below which only the player may draw. */
    localeZoneTop: CANVAS.h - 300,
    /** Burnt-in English, measured from the bottom edge. */
    englishBottom: 360,
    /** The stage's bottom inset — clear of the English line's two lines. */
    stageBottom: 580,
  },
  wide: {
    localeZoneTop: WIDE.h - 180,
    englishBottom: 214,
    stageBottom: 330,
  },
};

export const MOTION = {
  /** Cards arrive one at a time because the explanation does. */
  stagger: 130,
  entrance: 520,
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
};

/** Reading time floor — the tour pipeline's budget, same reasoning. */
export function readingMs(text) {
  const chars = [...String(text ?? '')].length;
  return Math.max(2800, Math.round((chars / 12) * 1000));
}

export function palette(theme) {
  return theme === 'dark' ? DARK : LIGHT;
}
