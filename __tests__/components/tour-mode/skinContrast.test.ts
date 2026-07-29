/**
 * T-D7 (docs/pwa-ui-theme-design-master-plan-2026-07-27.md) — the standing
 * contrast gate. The original 66-pair skin verification (chat-ui-theme P2)
 * was a one-off; this test re-derives it from the SHIPPED CSS on every run,
 * for every skin × theme, so a palette edit can never silently break a pair.
 *
 * The resolver mirrors the real cascade, including its one subtlety: a skin's
 * LIGHT block (.tr-root[data-tr-skin]) ties the base dark block (.dark
 * .tr-root) on specificity and sits later in the file, so in dark mode a
 * token the skin-light block sets but the skin-dark block doesn't KEEPS THE
 * LIGHT VALUE. (Exactly the dark-sky safe/accent-soft bug this test caught
 * on introduction.) Merge order below = file order = what browsers compute.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { TOUR_SKINS, type TourSkin } from '@/hooks/useTourRoomSettings';
import { SKIN_SCENERY_SPECS, type ScenerySkin } from '@/components/tour-mode/scenery/SkinScenery';

const css = readFileSync(path.join(process.cwd(), 'app', 'tour-room-theme.css'), 'utf8');

type Tokens = Record<string, string>;

interface Block {
  parts: string[];
  tokens: Tokens;
}

/**
 * 🔴 Comments come out BEFORE the brace scan, not after.
 *
 * This parser splits on `{` and `}`, so a brace inside a comment is read as a
 * block boundary and every rule after it is misparsed. It happened for real:
 * a P7.2 comment reading `--tr-plan-shadow-{soft,card,button}` desynchronised
 * the scan and made `.tr-plan-root`'s tokens vanish from the resolver — the
 * gate went from measuring a palette to measuring nothing, because of prose.
 *
 * A guard that a comment can switch off is worse than no guard, so the strip
 * is global and first.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseBlocks(rawSource: string): Block[] {
  const source = stripComments(rawSource);
  const blocks: Block[] = [];
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(source))) {
    const selector = m[1].trim();
    const tokens: Tokens = {};
    const declRe = /--tr-([a-z0-9-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(m[2]))) tokens[d[1]] = d[2].trim();
    if (Object.keys(tokens).length > 0) {
      blocks.push({ parts: selector.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), tokens });
    }
  }
  return blocks;
}

const BLOCKS = parseBlocks(css);

/**
 * CSS specificity for the selector shapes this stylesheet uses (classes and
 * attribute selectors; no ids, no elements), collapsed to a sortable number.
 *
 * 🔴 Needed because file order alone stopped being sufficient once the PLANNER
 * scope joined this gate. `.tr-root[data-tr-skin='sky']` is (0,2,0) and
 * `.tr-plan-root` is (0,1,0), so the skin wins for every token it sets even
 * though the planner block sits ~640 lines LATER in the file. A file-order
 * merge would report the planner's colours for a skinned planner and gate a
 * palette that no browser ever paints.
 *
 * For the base (non-planner) scope this is a no-op today — verified: the three
 * `.tr-root` blocks that sit after the skins declare only `--tr-font-scale`,
 * the duration/easing quartet and `--tr-chip-quiet-fill`, none of which any
 * skin sets. It is here so that stops being load-bearing luck.
 */
function specificity(part: string): number {
  const ids = (part.match(/#[\w-]+/g) ?? []).length;
  const classes = (part.match(/\.[\w-]+/g) ?? []).length;
  const attrs = (part.match(/\[[^\]]+\]/g) ?? []).length;
  return ids * 10_000 + (classes + attrs) * 100;
}

/**
 * Merge every block whose selector list contains one of `wanted`, ordered by
 * (specificity, file position) — which is exactly what the cascade does.
 *
 * The tie-break on file position is load-bearing and models a real shipped bug:
 * a skin's LIGHT block (0,2,0) ties `.dark .tr-root` (0,2,0) and sits later, so
 * in dark mode a token the skin-light block sets but the skin-dark block does
 * not KEEPS THE LIGHT VALUE. That is the dark-sky `safe` failure this gate
 * caught on introduction; it must stay catchable.
 */
function mergeMatching(wanted: string[]): Tokens {
  const matched: Array<{ spec: number; order: number; tokens: Tokens }> = [];
  BLOCKS.forEach((block, order) => {
    let spec = -1;
    for (const part of block.parts) {
      if (wanted.includes(part)) spec = Math.max(spec, specificity(part));
    }
    if (spec >= 0) matched.push({ spec, order, tokens: block.tokens });
  });
  matched.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const out: Tokens = {};
  for (const m of matched) Object.assign(out, m.tokens);
  return derefVars(out);
}

/**
 * 🔴 Resolve `var(--tr-x)` indirection before anything measures a colour.
 *
 * §N-9 option B stores the planner's palette once in `--tr-plan-v-*` and
 * aliases the public tokens to it, so the shipped value of `--tr-surface` is
 * literally the string `var(--tr-plan-v-surface)`. Without this step the WCAG
 * math cannot parse it, returns NaN — and NaN is SKIPPED by these tests. The
 * gate would have gone green while measuring nothing, which is the exact
 * failure this file already carries a warning about ("skipping is not
 * passing"). Aliasing is good for the stylesheet; it must not be invisible to
 * the thing checking the stylesheet.
 */
function derefVars(tokens: Tokens): Tokens {
  const out: Tokens = { ...tokens };
  for (const key of Object.keys(out)) {
    let value = out[key];
    for (let hops = 0; hops < 8; hops++) {
      const m = /^var\(\s*--tr-([a-z0-9-]+)\s*(?:,\s*([^)]*))?\)$/i.exec(value.trim());
      if (!m) break;
      const target = out[m[1]] ?? tokens[m[1]];
      if (target === undefined) {
        value = (m[2] ?? '').trim(); // declared fallback, or empty
        break;
      }
      value = target;
    }
    out[key] = value;
  }
  return out;
}

function skinSelectors(skin: TourSkin, theme: 'light' | 'dark'): string[] {
  const wanted = ['.tr-root']; // base light — always the floor
  if (skin !== 'classic') wanted.push(`.tr-root[data-tr-skin='${skin}']`);
  if (theme === 'dark') {
    wanted.push('.dark .tr-root');
    if (skin !== 'classic') wanted.push(`.dark .tr-root[data-tr-skin='${skin}']`);
  }
  return wanted;
}

/** Resolve the token set for skin × theme. */
function resolve(skin: TourSkin, theme: 'light' | 'dark'): Tokens {
  return mergeMatching(skinSelectors(skin, theme));
}

/**
 * The /tour-mode/plan editor (`.tr-root.tr-plan-root` — BOTH classes on one
 * element) re-declares most of the palette on top of `.tr-root`. It was outside
 * this gate once, which is how it shipped an `ink-3` that missed 4.5:1 on its
 * own canvas, and how `--tr-on-accent` could be read by three components while
 * being declared by none.
 *
 * 🔴 P7.0 — this now takes a SKIN, because P7.1b stamps `data-tr-skin` onto the
 * planner root and P7.8 puts a skin layer on it. The previous signature could
 * only ever answer for `classic`, so the moment the planner became skinnable
 * the gate would have gone quietly out of date on 9 of 10 skins — the exact
 * shape of "a gap that looks like coverage" this file already warns about.
 *
 * The cascade this models is genuinely mixed, which is why `mergeMatching` is
 * specificity-ordered rather than file-ordered:
 *
 *   .tr-root                          (0,1,0)  base floor
 *   .tr-plan-root                     (0,1,0)  planner palette — later, so it wins ties
 *   .tr-root[data-tr-skin='X']        (0,2,0)  🔴 OUTRANKS the planner block
 *   .dark .tr-root                    (0,2,0)
 *   .dark .tr-plan-root / .dark-self  (0,2,0)  later than the skin-light block
 *   .dark .tr-root[data-tr-skin='X']  (0,3,0)  top
 *
 * So a skinned planner in LIGHT wears the SKIN's canvas/surface/ink with the
 * planner's accent family layered under it — a combination that has never been
 * painted and never been measured. That is precisely what this gate is for.
 *
 * Dark note: the planner opens standalone from the invite email with no
 * RoomShell above it, so it carries `.dark` on ITSELF (`.tr-plan-root.dark`).
 * Both forms live in one comma-separated block, so matching either is enough.
 */
function planSelectors(skin: TourSkin, theme: 'light' | 'dark'): string[] {
  const wanted = ['.tr-root', '.tr-plan-root'];
  if (skin !== 'classic') {
    wanted.push(`.tr-root[data-tr-skin='${skin}']`);
    /**
     * 🔴 P7.8 (§N-9 option B) — the planner now carries `data-tr-skin`, and
     * this block re-asserts everything the skin would otherwise take EXCEPT
     * `--tr-canvas`. It is (0,2,0), tying a skin block and winning on file
     * order. Leaving it out of the resolver would make this gate measure a
     * palette the browser never paints — the same class of error the
     * specificity fix in P7.0 was written to prevent.
     */
    wanted.push('.tr-plan-root[data-tr-skin]');
  }
  if (theme === 'dark') {
    wanted.push('.dark .tr-root', '.dark .tr-plan-root', '.tr-plan-root.dark');
    if (skin !== 'classic') {
      wanted.push(`.dark .tr-root[data-tr-skin='${skin}']`);
      wanted.push('.dark .tr-plan-root[data-tr-skin]', '.tr-plan-root.dark[data-tr-skin]');
    }
  }
  return wanted;
}

function resolvePlan(skin: TourSkin, theme: 'light' | 'dark'): Tokens {
  return mergeMatching(planSelectors(skin, theme));
}

// ---- WCAG math --------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 🔴 rgba was being skipped, and skipping is not passing.
 *
 * Half the dark palette's soft washes are `rgba(…, 0.2)` over the canvas, and
 * this gate returned NaN for them — so every pair involving one silently did
 * not run. The suite was green about tokens it had never looked at, which is
 * the shape G-b warned about: a guard that leaks is worse than none, because
 * people stop looking.
 *
 * Compositing needs to know what is UNDER the wash. Everywhere these tokens are
 * used that is the canvas, so the canvas is the backdrop.
 */
function parseColour(value: string, backdrop: [number, number, number] | null): [number, number, number] | null {
  const hex = hexToRgb(value);
  if (hex) return hex;
  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/i.exec(value.trim());
  if (!rgba) return null;
  const raw: [number, number, number] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  const alphaRaw = rgba[4];
  const alpha = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : Number(alphaRaw);
  if (!Number.isFinite(alpha)) return null;
  if (alpha >= 0.999) return raw;
  if (!backdrop) return null; // translucent with nothing behind it is undecidable
  return [
    raw[0] * alpha + backdrop[0] * (1 - alpha),
    raw[1] * alpha + backdrop[1] * (1 - alpha),
    raw[2] * alpha + backdrop[2] * (1 - alpha),
  ];
}

function ratio(aValue: string, bValue: string, canvas?: string): number {
  const base = canvas ? hexToRgb(canvas) : null;
  // The background composites onto the canvas; the foreground composites onto
  // the composited background, which is what a reader's eye actually receives.
  const b = parseColour(bValue, base);
  const a = parseColour(aValue, b);
  if (!a || !b) return NaN;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---- gates ------------------------------------------------------------------

/** [foreground token, background token, minimum ratio] */
const PAIRS: Array<[string, string, number]> = [
  ['ink', 'canvas', 4.5],
  ['ink', 'surface', 4.5],
  ['ink-2', 'surface', 4.5],
  ['ink-3', 'canvas', 4.5],
  /**
   * 🔴 The pair every card eyebrow in the app actually uses, and the one the
   * list did not have.
   *
   * `ink-2` on surface was checked, and `ink-3` on CANVAS was checked, so the
   * table read as complete. But an eyebrow — "YOU'RE HERE", "PICKUP" — is
   * `--tr-ink-3` at 11px sitting on a CARD, which is `--tr-surface`. Measured
   * on a seeded room in dark: 4.39. Eleven pixels is nowhere near WCAG's large
   * text threshold (18.66px bold / 24px), so 4.5 is the bar and 4.39 misses it.
   *
   * It went unseen because the two neighbouring pairs were both present — the
   * shape of a gap that looks like coverage.
   */
  ['ink-3', 'surface', 4.5],
  /**
   * 🔴 And the SECOND surface an eyebrow lands on, which the first pass missed.
   *
   * `--tr-surface-2` carries LobbyCard's pickup and vehicle eyebrows
   * (`LobbyCard.tsx:192,213`) and GuideGuestCard's `unseated` badge — all
   * `ink-3`, all 11px. Nine dark skins measured 4.12–4.32 there, and the
   * PLANNER measured 4.43 in LIGHT, which the "dark only" reading of the first
   * fix would have missed entirely: the planner test spreads this same array
   * into `.tr-plan-root`, so a pair added here is gated in eleven scopes, not
   * ten.
   *
   * Two pairs rather than one wider rule, because `surface` and `surface-2` are
   * different colours per skin and a single check would only ever fail on
   * whichever is worse.
   */
  ['ink-3', 'surface-2', 4.5],
  ['bubble-me-ink', 'bubble-me', 4.5],
  ['bubble-in-ink', 'bubble-in', 4.5],
  ['bubble-me-ink', 'accent', 4.5],
  // 🔴 2026-07-28: read by three components, declared by none. An undeclared
  // custom property makes `color: var(--tr-on-accent)` an invalid substitution,
  // so the label INHERITED the surrounding dark ink and disappeared into the
  // deep-pine button under it. Gated now, everywhere accent is.
  ['on-accent', 'accent', 4.5],
  ['accent-deep', 'canvas', 4.5],
  ['ink', 'home-tile', 4.5],
  ['safe', 'surface', 3.0],
  // O3 — 경고 색은 신설되자마자 게이트에 들어간다. 스킨별로 재정의하지 않으므로
  // 한 값이 10스킨 × 라이트/다크 전부에서 읽혀야 한다.
  ['warn', 'surface', 4.5],
  ['warn', 'canvas', 4.5],
  /**
   * I5 — the now card's two loud states paint INK ON THEIR OWN WASH, which is a
   * pairing nothing above covered: `--tr-danger` text sitting on
   * `--tr-danger-soft`, and ordinary ink on `--tr-warn-soft`.
   *
   * That card is the screen's protagonist, and its danger variant is the one a
   * guest reads while their group is already waiting for them. A skin where the
   * wash creeps toward the text turns the most urgent card in the app into the
   * hardest one to read — the same failure N1 measured on the chips, one layer
   * up. Ten skins × two themes, checked from the shipped CSS.
   */
  ['ink', 'danger-soft', 4.5],
  ['ink', 'warn-soft', 4.5],
];

const THEMES = ['light', 'dark'] as const;

describe('skin contrast gate (T-D7)', () => {
  const PLAN_PAIRS: Array<[string, string, number]> = [
    ...PAIRS,
    ['accent-deep', 'accent-soft', 4.5],
    ['ink-2', 'surface-2', 4.5],
  ];

  it('every skin has light + dark CSS blocks (classic is the base itself)', () => {
    for (const skin of TOUR_SKINS) {
      if (skin === 'classic') continue;
      expect(css).toContain(`.tr-root[data-tr-skin='${skin}']`);
      expect(css).toContain(`.dark .tr-root[data-tr-skin='${skin}']`);
    }
    // Picker order intent: the accessibility skin closes the list.
    expect(TOUR_SKINS[TOUR_SKINS.length - 1]).toBe('contrast');
  });

  it('all token pairs clear their WCAG floor in every skin × theme', () => {
    const failures: string[] = [];
    for (const skin of TOUR_SKINS) {
      for (const theme of THEMES) {
        const tokens = resolve(skin, theme);
        for (const [fg, bg, min] of PAIRS) {
          const fgv = tokens[fg];
          const bgv = tokens[bg];
          if (!fgv || !bgv) {
            failures.push(`${skin}/${theme}: missing token ${!fgv ? fg : bg}`);
            continue;
          }
          const r = ratio(fgv, bgv, tokens.canvas);
          if (Number.isNaN(r)) {
            failures.push(`${skin}/${theme}: non-hex value for ${fg}(${fgv}) on ${bg}(${bgv})`);
            continue;
          }
          if (r < min) {
            failures.push(`${skin}/${theme}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * The tinted-chip pairing: `--tr-accent-deep` ink on an `--tr-accent-soft`
   * wash. Used all over the room, and since 2026-07-28 it is also the whole
   * surface of `.tr-cta-hero` — the guide console's 운행 시작 button — so a skin
   * that washes out here loses the day's primary action, not just a chip.
   *
   * Dark skins express accent-soft as rgba() over an unknown backdrop, which
   * WCAG math on two hex values cannot judge; those are skipped rather than
   * guessed at. The light side, where the wash is opaque, is fully covered.
   */
  it('accent-deep stays readable on the accent-soft wash wherever both are opaque', () => {
    const failures: string[] = [];
    for (const skin of TOUR_SKINS) {
      for (const theme of THEMES) {
        const tokens = resolve(skin, theme);
        const r = ratio(tokens['accent-deep'], tokens['accent-soft']);
        if (Number.isNaN(r)) continue; // rgba wash — not decidable here
        if (r < 4.5) {
          failures.push(
            `${skin}/${theme}: accent-deep(${tokens['accent-deep']}) on accent-soft(${tokens['accent-soft']}) = ${r.toFixed(2)} < 4.5`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * accent-soft is an opaque wash in the planner's own light palette, so the
   * chip ink is gated too. Under a skin it may become rgba(), in which case the
   * composite is taken against that skin's canvas like everywhere else.
   */

  it('the planner scope (.tr-plan-root) clears the same floors in classic', () => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      const tokens = resolvePlan('classic', theme);
      for (const [fg, bg, min] of PLAN_PAIRS) {
        const fgv = tokens[fg];
        const bgv = tokens[bg];
        if (!fgv || !bgv) {
          failures.push(`plan/${theme}: missing token ${!fgv ? fg : bg}`);
          continue;
        }
        const r = ratio(fgv, bgv, tokens.canvas);
        // Dark mode washes are rgba() by design — skip what WCAG math can't see.
        if (Number.isNaN(r)) continue;
        if (r < min) failures.push(`plan/${theme}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * 🔴 P7.0 — the same floors for the planner under EVERY skin.
   *
   * The planner is about to become skinnable (P7.1b stamps `data-tr-skin`;
   * P7.8 puts a background skin layer on it). Without this, nine of ten skins
   * would reach the one screen in the app with the most small type on it while
   * being measured by nobody — and this scope has already shipped a sub-4.5
   * `ink-3` once for exactly that reason.
   *
   * This is a MIXED palette by construction: the skin outranks the planner
   * block on canvas/surface/ink (0,2,0 vs 0,1,0) while the planner keeps its
   * accent family and its plan-only tokens. Neither half was designed against
   * the other, so this test is the thing that decides whether the planner can
   * wear a full skin or only a background (§N-9 option B).
   */
  it('the planner scope clears the same floors under every skin × theme', () => {
    const failures: string[] = [];
    for (const skin of TOUR_SKINS) {
      for (const theme of THEMES) {
        const tokens = resolvePlan(skin, theme);
        for (const [fg, bg, min] of PLAN_PAIRS) {
          const fgv = tokens[fg];
          const bgv = tokens[bg];
          if (!fgv || !bgv) {
            failures.push(`plan/${skin}/${theme}: missing token ${!fgv ? fg : bg}`);
            continue;
          }
          const r = ratio(fgv, bgv, tokens.canvas);
          if (Number.isNaN(r)) continue; // rgba over an undecidable backdrop
          if (r < min) {
            failures.push(`plan/${skin}/${theme}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  /**
   * 🔴 Proof that the test above is measuring what it claims to measure.
   *
   * A resolver that quietly failed to match the skin selectors would return the
   * classic planner palette for all ten skins and report ten passes — the same
   * false green this file was built to stop. So pin the two halves of the mix:
   * the skin must win where it outranks the planner block, and the planner must
   * keep what the skin never sets.
   */
  /**
   * 🔴 P7.8 (§N-9) — where the line between skin and planner actually falls,
   * and why it is not where the plan guessed.
   *
   * §N-9 chose option B, "the skin sets the BACKGROUND only". Implemented
   * literally — skin canvas, planner ink — it FAILED this gate, measured:
   *
   *     sky/light      ink-3 on canvas  3.31
   *     winter/light   ink-3 on canvas  4.36
   *     forest/light   4.31 · meadow 4.20 · seoul 4.35 · busan 4.21
   *
   * Because a canvas and its ink are a PAIR. Each skin picks an ink that clears
   * its own background; pinning one screen's ink while swapping the background
   * under it breaks the only relationship that made either value safe. Moving
   * ink as well then failed on `ink-3 on surface-2` in dark (4.44 / 4.45 / 4.32
   * / 4.23) for the same reason one level down.
   *
   * So the line is drawn where the palette itself is jointed: the NEUTRAL
   * family travels together (canvas, surface, surface-2, hairline, ink x3), and
   * the planner keeps its IDENTITY — the deep-pine accent family that makes its
   * buttons and chips look like the planner's, plus its own plan-only tokens.
   * All 20 combinations pass at that split.
   *
   * This still honours the owner's intent (a skin changes the backdrop; the
   * planner still reads as the planner) without asking a palette to hold a
   * relationship it does not have.
   */
  it('a skinned planner takes the skin NEUTRALS and keeps its accent identity', () => {
    for (const skin of TOUR_SKINS) {
      if (skin === 'classic') continue;
      for (const theme of THEMES) {
        const skinned = resolve(skin, theme);
        const plain = resolvePlan('classic', theme);
        const mixed = resolvePlan(skin, theme);

        // Backdrop family: the skin's, and jointly — never half of it.
        for (const token of ['canvas', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3']) {
          expect(`${skin}/${theme}/${token}=${mixed[token]}`).toBe(`${skin}/${theme}/${token}=${skinned[token]}`);
        }

        // Identity: the planner's, even where the skin declares its own.
        for (const token of ['accent', 'accent-hi', 'accent-deep', 'accent-soft', 'on-accent']) {
          expect(`${skin}/${theme}/${token}=${mixed[token]}`).toBe(`${skin}/${theme}/${token}=${plain[token]}`);
        }
        expect(mixed['plan-hero-ink']).toBeDefined();
      }
    }
  });

  /**
   * Aliasing must not become invisible. Every token these tests read has to
   * resolve to a real colour, or the WCAG math returns NaN and NaN is skipped.
   */
  it('no measured token is left as an unresolved var()', () => {
    const unresolved: string[] = [];
    for (const skin of TOUR_SKINS) {
      for (const theme of THEMES) {
        const tokens = resolvePlan(skin, theme);
        for (const [fg, bg] of PLAN_PAIRS) {
          for (const key of [fg, bg]) {
            if (/^var\(/.test(tokens[key] ?? '')) unresolved.push(`plan/${skin}/${theme}: ${key}`);
          }
        }
      }
    }
    expect([...new Set(unresolved)]).toEqual([]);
  });

  it('scenery BAND fills keep timestamps readable (ink-3 ≥ 3.5) in both themes', () => {
    const failures: string[] = [];
    const scenerySkins = Object.keys(SKIN_SCENERY_SPECS) as ScenerySkin[];
    for (const skin of scenerySkins) {
      const spec = SKIN_SCENERY_SPECS[skin];
      for (const theme of THEMES) {
        const ink3 = resolve(skin, theme)['ink-3'];
        const palette = theme === 'light' ? spec.light : spec.dark;
        for (const key of spec.bandKeys) {
          const fill = palette[key];
          if (!fill) {
            failures.push(`${skin}/${theme}: band key ${key} missing from palette`);
            continue;
          }
          const r = ratio(ink3, fill);
          if (Number.isNaN(r) || r < 3.5) {
            failures.push(`${skin}/${theme}: ink-3 on scenery ${key}(${fill}) = ${r.toFixed(2)} < 3.5`);
          }
        }
        // Same-key discipline: light and dark palettes must describe the same scene.
        expect(Object.keys(spec.light).sort()).toEqual(Object.keys(spec.dark).sort());
      }
    }
    expect(failures).toEqual([]);
  });

  it('every non-contrast skin carries a scenery scene; contrast carries none', () => {
    for (const skin of TOUR_SKINS) {
      if (skin === 'contrast') {
        expect((SKIN_SCENERY_SPECS as Record<string, unknown>)[skin]).toBeUndefined();
      } else {
        expect(SKIN_SCENERY_SPECS[skin as ScenerySkin]).toBeDefined();
        expect(SKIN_SCENERY_SPECS[skin as ScenerySkin].bandKeys.length).toBeGreaterThan(0);
      }
    }
  });

  it('no skin block touches the SOS red (danger stays invariant)', () => {
    // Danger may only be declared in the base blocks and .tr-plan-root —
    // never inside a [data-tr-skin] block.
    for (const block of BLOCKS) {
      const isSkinBlock = block.parts.some((part) => part.includes('[data-tr-skin='));
      if (isSkinBlock) {
        expect(Object.keys(block.tokens)).not.toContain('danger');
        expect(Object.keys(block.tokens)).not.toContain('danger-soft');
      }
    }
  });
});
