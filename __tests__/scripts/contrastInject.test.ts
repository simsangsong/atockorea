/**
 * Unit test for the shared QA colour instrument (scripts/qa-lib/contrast-inject.js).
 *
 * The instrument is only useful if it is trustworthy, and this one exists
 * precisely because its ad-hoc predecessors were not: on 2026-07-28 three
 * separate probes produced numbers that changed decisions and were wrong
 * (dropped rgba alpha → invented a text failure; a shadow that read as a border
 * so the screenshot "confirmed" a fix the number denied; `color(srgb …)`
 * floats read as 0-255 so every light and dark figure was fiction).
 *
 * So the three historical failures are the first three cases below. A measuring
 * tape gets tested against a known length before you trust what it says about
 * an unknown one.
 */
import { readFileSync } from 'fs';
import path from 'path';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
interface Instrument {
  parseColor(input: string): Rgba | null;
  over(fg: Rgba, bg: Rgba): Rgba;
  luminance(c: Rgba): number;
  ratio(a: Rgba, b: Rgba): number | null;
  hex(c: Rgba | null): string | null;
}

function load(): Instrument {
  const src = readFileSync(path.join(process.cwd(), 'scripts', 'qa-lib', 'contrast-inject.js'), 'utf8');
  // The file is an IIFE that assigns window.__tr; jsdom gives us a window.
  // eslint-disable-next-line no-eval
  (0, eval)(src);
  return (window as unknown as { __tr: Instrument }).__tr;
}

const tr = load();
const near = (actual: number | null, expected: number, tol = 0.02) => {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tol);
};

describe('qa contrast instrument — parsing', () => {
  it('parses legacy rgb() and rgba(), keeping alpha (failure mode #1)', () => {
    expect(tr.parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    const a = tr.parseColor('rgba(0, 0, 0, 0.5)');
    expect(a).not.toBeNull();
    expect(a!.a).toBeCloseTo(0.5, 5);
  });

  it('parses modern space-separated rgb() with a slash alpha', () => {
    const c = tr.parseColor('rgb(16 32 26 / 0.25)');
    expect(c).toMatchObject({ r: 16, g: 32, b: 26 });
    expect(c!.a).toBeCloseTo(0.25, 5);
  });

  it('🔴 reads color(srgb …) as 0-to-1 floats, not 0-to-255 (failure mode #3)', () => {
    // This is what color-mix() computes to. Reading 0.65 as "0.65 of 255" gives
    // a near-black colour and inverts every ratio that touches it.
    const c = tr.parseColor('color(srgb 0.65 0.7 0.68)');
    expect(c).not.toBeNull();
    expect(Math.round(c!.r)).toBe(166); // 0.65 × 255
    expect(Math.round(c!.g)).toBe(179);
    expect(Math.round(c!.b)).toBe(173);
    expect(c!.a).toBe(1);
  });

  it('reads color(srgb … / a) alpha, including percentages', () => {
    const c = tr.parseColor('color(srgb 1 1 1 / 40%)');
    expect(c!.a).toBeCloseTo(0.4, 5);
  });

  it('treats transparent as zero alpha and refuses to guess unknown syntax', () => {
    expect(tr.parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    // Returning null (rather than black) is deliberate: a guessed colour is
    // exactly how the invented 2.06 failure happened.
    expect(tr.parseColor('currentcolor')).toBeNull();
    expect(tr.parseColor('lab(50% 20 -30)')).toBeNull();
    expect(tr.parseColor('')).toBeNull();
  });

  it('parses hex, including 4- and 8-digit alpha forms', () => {
    expect(tr.parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(tr.parseColor('#151818')).toEqual({ r: 21, g: 24, b: 24, a: 1 });
    const c = tr.parseColor('#00000080');
    expect(c!.a).toBeCloseTo(0.502, 2);
  });
});

describe('qa contrast instrument — compositing and WCAG', () => {
  it('composites a translucent layer over its backdrop', () => {
    const half = tr.parseColor('rgba(255,255,255,0.5)')!;
    const black = tr.parseColor('#000000')!;
    const out = tr.over(half, black);
    expect(Math.round(out.r)).toBe(128);
    expect(out.a).toBe(1);
  });

  it('agrees with known WCAG ratios', () => {
    const white = tr.parseColor('#ffffff')!;
    const black = tr.parseColor('#000000')!;
    near(tr.ratio(white, black), 21, 0.01);
    near(tr.ratio(white, white), 1, 0.001);
    // #767676 on white is the canonical 4.54:1 boundary case.
    near(tr.ratio(tr.parseColor('#767676')!, white), 4.54, 0.05);
  });

  it('is symmetric — order of the pair cannot change the verdict', () => {
    const a = tr.parseColor('#1d2020')!;
    const b = tr.parseColor('#e8eaed')!;
    expect(tr.ratio(a, b)).toBe(tr.ratio(b, a));
  });

  it('🔴 a dropped alpha changes the answer — proving the guard earns its keep', () => {
    // The room's dark signal chip is a 16%-alpha accent wash over the canvas.
    // Judged as if it were opaque, it looks like a bright mint block; composited
    // honestly it is a whisper above the canvas. Failure mode #1 in one line.
    const wash = tr.parseColor('rgba(143, 191, 169, 0.16)')!;
    const canvas = tr.parseColor('#151818')!;
    const honest = tr.ratio(tr.over(wash, canvas), canvas)!;
    const naive = tr.ratio({ ...wash, a: 1 }, canvas)!;
    expect(honest).toBeLessThan(2);
    expect(naive).toBeGreaterThan(5);
  });

  it('renders composited colours back to hex for the report', () => {
    expect(tr.hex(tr.parseColor('rgb(21 24 24)')!)).toBe('#151818');
    expect(tr.hex(null)).toBeNull();
  });
});
