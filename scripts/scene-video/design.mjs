/**
 * F2 / v3 — the design system, as numbers.
 *
 * v3 (owner brief, 2026-07-30): English is the copy and the locale line is its
 * gloss; backgrounds are black / deep navy / white / soft pastel; the type is a
 * presentation-grade face with NO italic anywhere; screen recordings join the
 * screenshots. See docs/element-motion-video-plan-2026-07-30.md §V3.
 *
 * The v2 discipline survives intact, because it was never about the colours:
 * one accent, two type ROLES, four corner micro-labels, cards that hold real
 * screens, motion only where something actually changes. §A-3 is a subtraction
 * list and v3 does not lengthen it.
 *
 * Vertical is the master (1080×1920); wide is derived.
 */

export const CANVAS = { w: 1080, h: 1920 };
export const WIDE = { w: 1920, h: 1080 };
export const FPS = 30;

/**
 * The four grounds the owner named. Each carries exactly ONE accent.
 *
 * 🔴 `ink` is the default and the reason is structural, not taste: what goes on
 * these frames is LIGHT app screenshots. On a dark ground a light card becomes
 * a self-luminous object; on white it dissolves into the page and survives only
 * as a border. The bright themes are here for print-adjacent and guest-facing
 * uses, where the surrounding context is already white.
 */
export const THEMES = {
  ink: {
    /** `screen` is the plate a LIGHT app screenshot sits on — the app has no
     *  dark skin in these captures, so letterboxing it into the dark card would
     *  read as a rendering fault rather than a device. */
    canvas: '#0d0e11',
    card: '#171a20',
    ink: '#f3f5f8',
    inkSoft: '#9aa3b0',
    accent: '#c9a227',
    accentSoft: 'rgba(201, 162, 39, 0.15)',
    hairline: '#242832',
    chrome: '#69717e',
    ghost: '#15181e',
    shadow: '0 30px 70px rgba(0, 0, 0, 0.55)',
    screen: '#ffffff',
  },
  navy: {
    canvas: '#0b1b33',
    card: '#122a4a',
    ink: '#eaf1fb',
    inkSoft: '#93a8c4',
    accent: '#e2a93b',
    accentSoft: 'rgba(226, 169, 59, 0.16)',
    hairline: '#1d3a5e',
    chrome: '#5f7a9c',
    ghost: '#102541',
    shadow: '0 30px 70px rgba(2, 10, 22, 0.6)',
    screen: '#ffffff',
  },
  paper: {
    canvas: '#ffffff',
    card: '#f5f6f8',
    ink: '#0f1216',
    inkSoft: '#5b636e',
    accent: '#1f4fd8',
    accentSoft: 'rgba(31, 79, 216, 0.10)',
    hairline: '#e3e6ea',
    chrome: '#9aa1ab',
    ghost: '#f2f4f7',
    shadow: '0 26px 60px rgba(15, 18, 22, 0.10)',
    screen: '#ffffff',
  },
  mist: {
    canvas: '#e9eff6',
    card: '#ffffff',
    ink: '#131820',
    inkSoft: '#5a6472',
    accent: '#2f6bd8',
    accentSoft: 'rgba(47, 107, 216, 0.12)',
    hairline: '#d3dde8',
    chrome: '#8b96a5',
    ghost: '#dfe8f2',
    shadow: '0 26px 60px rgba(19, 24, 32, 0.12)',
    screen: '#ffffff',
  },
};

export const DEFAULT_THEME = 'ink';

/**
 * Two ROLES, and only two.
 *
 * `display` is the sentence; `chrome` is the label. The CJK entries are not a
 * third role — they are the same display role in a script the Latin face cannot
 * draw, and the gate enforces that by allowing extra families ONLY on elements
 * marked `data-script="cjk"`.
 *
 * These are the faces actually installed on the build machine (verified). v2
 * listed Pretendard first and it was never there, so every frame silently fell
 * to Noto Sans KR — which is why the English looked plain.
 *
 * 🔴 No italic, anywhere. G-8 fails the render on font-style italic/oblique.
 */
export const FONT = {
  display: "'Segoe UI Variable Display', 'Segoe UI', Corbel, Candara, sans-serif",
  chrome: "'Cascadia Mono', Consolas, ui-monospace, monospace",
  /** Per-locale companion for the gloss line. Latin locales reuse `display`. */
  cjk: {
    ko: "'Malgun Gothic', 'Noto Sans KR', sans-serif",
    ja: "'Yu Gothic UI', 'Yu Gothic', 'MS Gothic', sans-serif",
    zh: "'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif",
    'zh-TW': "'Microsoft JhengHei UI', 'Microsoft JhengHei', sans-serif",
  },
};

export const CJK_LOCALES = new Set(['ko', 'ja', 'zh', 'zh-TW']);

/** The face for a locale's gloss line — Latin locales stay on `display`. */
export function glossFont(locale) {
  return FONT.cjk[locale] ?? FONT.display;
}

/**
 * Type scale on the 1080-wide canvas.
 *
 * The headline is roughly 1/8 of frame height (§A-3 item 6). The gloss sits a
 * clear step below it — it is a translation, not a second headline, and if the
 * two are close in size the frame has two protagonists again.
 */
export const TYPE = {
  eyebrow: 32,
  headline: 92,
  headlineTight: 78,
  gloss: 44,
  sub: 44,
  cardTitle: 44,
  cardSub: 32,
  step: 46,
  stepGloss: 32,
  chrome: 24,
  ghost: 520,
  headlineMaxLines: 3,
  glossMaxLines: 2,
};

/** Wide is watched further away; apparent size, not a scaled copy. */
export const TYPE_WIDE = {
  ...TYPE,
  eyebrow: 24,
  headline: 74,
  headlineTight: 62,
  gloss: 34,
  sub: 34,
  cardTitle: 32,
  cardSub: 24,
  step: 34,
  stepGloss: 25,
  chrome: 19,
  ghost: 380,
};

export const GRID = {
  margin: 84,
  gutter: 32,
  radius: 28,
  cardRadius: 24,
};

/**
 * The bottom strip, reserved and now genuinely EMPTY.
 *
 * v2 burnt English there and spent real effort keeping it clear of the native
 * WebVTT band. v3 moves English up to the headline, so nothing is burnt at the
 * bottom at all and the collision cannot happen. The gate simplifies from "does
 * the caption fit above the zone" to "is the zone empty".
 */
export const SUBTITLE = {
  vertical: { localeZoneTop: CANVAS.h - 300, stageBottom: 340 },
  wide: { localeZoneTop: WIDE.h - 180, stageBottom: 210 },
};

/**
 * Motion grammar (owner brief, 2026-07-30): elements arrive slowly and leave
 * slowly. Nothing pops in, and no scene ends on a hard cut.
 *
 * 🔴 The v3 first pass only had an entrance. Every beat therefore ended at full
 * opacity and butt-joined the next one — a visible tick at every boundary, ten
 * times a film. Adding a crossfade there would have been the wrong fix: it
 * dissolves one composed frame into another, which reads as a slideshow. The
 * right fix is that the frame EMPTIES itself, so consecutive segments meet on
 * two identical bare backgrounds and the join is not merely soft — it is
 * invisible, because nothing is changing at that instant.
 *
 * `exit` is longer than `entrance` on purpose. Arriving is an event; leaving
 * should feel like the frame settling, not like a second event.
 */
export const MOTION = {
  /** Cards arrive one at a time because the explanation does. */
  stagger: 150,
  entrance: 780,
  /** Time from the first element starting to the last one settled. */
  entranceTail: 520,
  exit: 900,
  exitStagger: 70,
  /** Every beat must hold, fully settled, for at least this long. */
  minHold: 1400,
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
};

/** The floor a beat's duration must clear so the motion is never truncated. */
export function motionFloorMs() {
  return MOTION.entrance + MOTION.entranceTail + MOTION.minHold + MOTION.exit;
}

/** Reading time floor — the tour pipeline's budget, same reasoning. */
export function readingMs(text) {
  const chars = [...String(text ?? '')].length;
  return Math.max(2800, Math.round((chars / 12) * 1000));
}

export function palette(theme) {
  return THEMES[theme] ?? THEMES[DEFAULT_THEME];
}
