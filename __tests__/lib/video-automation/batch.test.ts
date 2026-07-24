/**
 * Batch runner planning (plan §14.3): dry-run posture, skip/resume, budget.
 */

import {
  DEFAULT_BATCH_BUDGET_USD,
  DEFAULT_BATCH_LIMIT,
  ESTIMATED_TTS_USD_PER_LANGUAGE,
  estimateBatchCostUsd,
  parseBatchArgs,
  planBatch,
  resolveBatchLimit,
  shouldAbortForBudget,
  type BatchCandidate,
} from '@/lib/video-automation/batch';

const candidates: BatchCandidate[] = [
  { poiKey: 'b_spot', label: 'B Spot', region: 'jeju', imageCount: 6, visits: 5 },
  { poiKey: 'a_spot', label: 'A Spot', region: 'jeju', imageCount: 4, visits: 5 },
  { poiKey: 'c_spot', label: 'C Spot', region: 'jeju', imageCount: 9, visits: 9 },
  { poiKey: 'd_spot', label: 'D Spot', region: 'jeju', imageCount: 0, visits: 3 },
];

const base = { limit: 10, force: false, languages: ['en' as const], tts: 'silent' as const };

describe('parseBatchArgs', () => {
  it('is a dry run unless --apply is passed', () => {
    expect(parseBatchArgs([]).dry).toBe(true);
    expect(parseBatchArgs([]).apply).toBe(false);
    expect(parseBatchArgs(['--apply']).dry).toBe(false);
    // --dry after --apply wins: the safer flag is never overridden silently.
    expect(parseBatchArgs(['--apply', '--dry']).apply).toBe(false);
  });

  it('defaults to silent narration, the template script and no upload', () => {
    const options = parseBatchArgs([]);
    expect(options.tts).toBe('silent');
    expect(options.script).toBe('template');
    expect(options.upload).toBe(false);
    expect(options.budgetUsd).toBe(DEFAULT_BATCH_BUDGET_USD);
  });

  it('accepts repeated and comma-separated --poi', () => {
    const options = parseBatchArgs(['--poi=a,b', '--poi=c']);
    expect(options.poiKeys).toEqual(['a', 'b', 'c']);
  });

  it('normalises language codes and rejects nonsense', () => {
    expect(parseBatchArgs(['--languages=en,zh-TW']).languages).toEqual(['en', 'zh-Hant']);
    expect(() => parseBatchArgs(['--languages=klingon'])).toThrow();
    expect(() => parseBatchArgs(['--tts=elevenlabs'])).toThrow();
    expect(() => parseBatchArgs(['--limit=0'])).toThrow();
    expect(() => parseBatchArgs(['--nope'])).toThrow();
  });

  it('does not truncate an explicit POI list', () => {
    expect(resolveBatchLimit({ limit: null, poiKeys: ['a', 'b', 'c'] })).toBe(3);
    expect(resolveBatchLimit({ limit: null, poiKeys: [] })).toBe(DEFAULT_BATCH_LIMIT);
    expect(resolveBatchLimit({ limit: 2, poiKeys: ['a', 'b', 'c'] })).toBe(2);
  });
});

describe('planBatch', () => {
  it('orders by itinerary visits then key, and caps at the limit', () => {
    const plan = planBatch(candidates, { ...base, limit: 2 });
    expect(plan.produce.map((target) => target.poiKey)).toEqual(['c_spot', 'a_spot']);
  });

  it('skips POIs with no local imagery', () => {
    const plan = planBatch(candidates, base);
    const skipped = plan.skipped.find((target) => target.poiKey === 'd_spot');
    expect(skipped?.skip).toBe('no-images');
    expect(plan.produce.map((target) => target.poiKey)).not.toContain('d_spot');
  });

  it('attempts a POI whose image count is unknown (no match_pois row)', () => {
    const plan = planBatch([{ ...candidates[0], poiKey: 'x_spot', imageCount: null }], base);
    expect(plan.produce.map((target) => target.poiKey)).toEqual(['x_spot']);
  });

  it('resumes: an existing run directory or an uploaded row is done', () => {
    const plan = planBatch(candidates, {
      ...base,
      producedRuns: { c_spot: '.tmp/video-automation/c_spot/prod-v1-abc' },
      uploadedPoiKeys: ['a_spot'],
    });
    expect(plan.produce.map((target) => target.poiKey)).toEqual(['b_spot']);
    expect(plan.skipped.find((t) => t.poiKey === 'c_spot')?.skip).toBe('produced');
    expect(plan.skipped.find((t) => t.poiKey === 'c_spot')?.existingRunDir).toContain('prod-v1-abc');
    expect(plan.skipped.find((t) => t.poiKey === 'a_spot')?.skip).toBe('uploaded');
  });

  it('re-produces everything renderable under --force', () => {
    const plan = planBatch(candidates, {
      ...base,
      force: true,
      producedRuns: { c_spot: 'somewhere' },
      uploadedPoiKeys: ['a_spot'],
    });
    expect(plan.produce.map((target) => target.poiKey)).toEqual(['c_spot', 'a_spot', 'b_spot']);
    // --force still cannot render a POI with no images.
    expect(plan.skipped.map((target) => target.poiKey)).toEqual(['d_spot']);
  });

  it('is idempotent: replanning after a full run produces nothing', () => {
    const first = planBatch(candidates, base);
    const producedRuns = Object.fromEntries(first.produce.map((t) => [t.poiKey, `run/${t.poiKey}`]));
    const second = planBatch(candidates, { ...base, producedRuns });
    expect(second.produce).toHaveLength(0);
  });
});

describe('budget brake', () => {
  it('costs nothing in silent mode', () => {
    expect(estimateBatchCostUsd(20, 4, 'silent')).toBe(0);
  });

  it('estimates real TTS spend per POI per language', () => {
    expect(estimateBatchCostUsd(10, 4, 'openai')).toBeCloseTo(
      Math.round(10 * 4 * ESTIMATED_TTS_USD_PER_LANGUAGE * 100) / 100,
      5,
    );
  });

  it('stops once the spend reaches the budget', () => {
    expect(shouldAbortForBudget(0.4, 2)).toBe(false);
    expect(shouldAbortForBudget(2, 2)).toBe(true);
    expect(shouldAbortForBudget(5, 0)).toBe(false); // budget 0 = uncapped
  });
});
