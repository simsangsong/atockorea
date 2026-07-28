/**
 * @jest-environment node
 *
 * The photo question has never once worked in production. `ops_ai_usage` holds
 * 1,898 rows since 2026-07-25 and not one has `purpose='vision'`; there is no
 * `vision_answer` message in the database. The router meters both success AND
 * total failure, so zero rows means it was never reached — the upload was dying
 * before the function ran.
 *
 * The arithmetic: a phone camera writes 3-12MB, the route accepted 8MB, and the
 * serverless body limit sits below that. So the platform rejected it, our code
 * never executed, and the guest saw one sentence that could equally have meant
 * an AI outage.
 *
 * These tests cover the decisions the fix makes, not the canvas call — the
 * canvas is the browser's, the choices are ours.
 */
import {
  alreadySmallEnough,
  scaleToFit,
  VISION_MAX_EDGE,
  VISION_TARGET_BYTES,
} from '@/lib/tour-room/imageDownscale';

describe('scaleToFit', () => {
  it('leaves an image that already fits alone', () => {
    expect(scaleToFit(1200, 800)).toEqual({ width: 1200, height: 800, unchanged: true });
    expect(scaleToFit(VISION_MAX_EDGE, 400).unchanged).toBe(true);
  });

  it('🔴 shrinks a phone photo to the long edge, preserving aspect ratio', () => {
    // A typical 12MP landscape shot.
    const out = scaleToFit(4032, 3024);
    expect(out.unchanged).toBe(false);
    expect(Math.max(out.width, out.height)).toBe(VISION_MAX_EDGE);
    // 4:3 in, 4:3 out — a squashed photo is a wrong answer waiting to happen.
    expect(out.width / out.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('handles portrait as well as landscape', () => {
    const out = scaleToFit(3024, 4032);
    expect(out.height).toBe(VISION_MAX_EDGE);
    expect(out.width).toBeLessThan(out.height);
  });

  it('never rounds a dimension to zero', () => {
    // A panorama is the shape that breaks naive rounding.
    const out = scaleToFit(20000, 3);
    expect(out.width).toBe(VISION_MAX_EDGE);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it('refuses nonsense instead of producing it', () => {
    expect(scaleToFit(0, 100)).toEqual({ width: 0, height: 0, unchanged: true });
    expect(scaleToFit(Number.NaN, 100).unchanged).toBe(true);
  });
});

describe('alreadySmallEnough', () => {
  it('passes a small JPEG straight through — no needless re-encode', () => {
    expect(alreadySmallEnough({ size: 400_000, type: 'image/jpeg' })).toBe(true);
  });

  it('stops a photo over the budget', () => {
    expect(alreadySmallEnough({ size: VISION_TARGET_BYTES + 1, type: 'image/jpeg' })).toBe(false);
  });

  it('🔴 always re-encodes HEIC, even a small one', () => {
    // It is what an iPhone writes by default and no provider in the ladder
    // accepts it. Size is not the reason to touch these files; the codec is.
    expect(alreadySmallEnough({ size: 200_000, type: 'image/heic' })).toBe(false);
    expect(alreadySmallEnough({ size: 200_000, type: 'image/heif' })).toBe(false);
  });
});

describe('the budget itself', () => {
  it('🔴 leaves room for base64 inflation under a serverless body limit', () => {
    // The provider call base64-encodes the bytes, which costs 4/3. The old 8MB
    // ceiling became ~10.7MB on the wire — past any platform limit, which is
    // why the function never ran.
    const onTheWire = VISION_TARGET_BYTES * (4 / 3);
    expect(onTheWire).toBeLessThan(4_500_000);
  });
});
