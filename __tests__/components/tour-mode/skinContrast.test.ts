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

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(source))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
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

function skinSelectors(skin: TourSkin, theme: 'light' | 'dark'): string[] {
  const wanted = ['.tr-root']; // base light — always the floor
  if (skin !== 'classic') wanted.push(`.tr-root[data-tr-skin='${skin}']`);
  if (theme === 'dark') {
    wanted.push('.dark .tr-root');
    if (skin !== 'classic') wanted.push(`.dark .tr-root[data-tr-skin='${skin}']`);
  }
  return wanted;
}

/** Resolve the token set for skin × theme by merging matching blocks in file order. */
function resolve(skin: TourSkin, theme: 'light' | 'dark'): Tokens {
  const wanted = skinSelectors(skin, theme);
  const out: Tokens = {};
  for (const block of BLOCKS) {
    if (block.parts.some((part) => wanted.includes(part))) Object.assign(out, block.tokens);
  }
  return out;
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

function ratio(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
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
  ['bubble-me-ink', 'bubble-me', 4.5],
  ['bubble-in-ink', 'bubble-in', 4.5],
  ['bubble-me-ink', 'accent', 4.5],
  ['accent-deep', 'canvas', 4.5],
  ['ink', 'home-tile', 4.5],
  ['safe', 'surface', 3.0],
];

const THEMES = ['light', 'dark'] as const;

describe('skin contrast gate (T-D7)', () => {
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
          const r = ratio(fgv, bgv);
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
