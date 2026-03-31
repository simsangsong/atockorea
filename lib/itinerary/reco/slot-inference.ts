/**
 * Deterministic post-parse inference for SQL candidate pool stability.
 * Runs after merge + UI hints, before bridgeToSlots / get_poi_candidates.
 * Does not choose POIs — only normalizes slot semantics and strictness flags.
 */
import type { MergedParserResult } from '@/lib/parser/types';

export type FilterStrictness = 'hard' | 'soft';

function normalizeForRules(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function inferWalkingFilterStrictness(text: string): FilterStrictness {
  const t = normalizeForRules(text);
  if (
    /절대 많이 걷기 싫|걷는 건 힘들|유모차|휠체어|노약자 심함|계단 많이 싫|휠체어|장애인/.test(
      t,
    )
  ) {
    return 'hard';
  }
  return 'soft';
}

export function inferRegionFilterStrictness(text: string): FilterStrictness {
  const t = normalizeForRules(text);
  if (/동쪽만|서쪽만|남쪽만|북쪽만|제외하고|다른 지역 빼|오직\s*\w+\s*만/.test(t)) {
    return 'hard';
  }
  if (/위주|쪽으로|중심으로|주로|편향/.test(t)) {
    return 'soft';
  }
  return 'soft';
}

export type RainInference = {
  needIndoorIfRain: boolean;
  rainAware: boolean;
};

/**
 * Separates rain-tolerant phrasing from must-be-indoor.
 * - UI explicit rainy-day planning → indoor bias + rain-aware scoring.
 * - "비 와도 괜찮다" → do NOT force indoor-only filter; still rain-aware for ranking.
 * - Strong indoor-only phrases → needIndoorIfRain true.
 */
export function inferRainSlotsFromText(
  text: string,
  explicitNeedIndoorFromUi: boolean,
): RainInference {
  if (explicitNeedIndoorFromUi) {
    return { needIndoorIfRain: true, rainAware: true };
  }

  const t = normalizeForRules(text);

  const indoorStrong =
    /실내 위주|실내로만|비 오면 실내|우천시 실내|실내 코스|실내만/.test(t);

  const rainTolerant =
    /비 와도 괜찮|비가 와도 괜찮|비와도 괜찮|우천 가능|날씨 안 좋아도 괜찮|비와 상관없|비 상관없/.test(
      t,
    );

  const mentionsRain = /비|우천|날씨 안 좋|폭우|장마|강풍/.test(t);

  if (indoorStrong) {
    return { needIndoorIfRain: true, rainAware: true };
  }

  if (rainTolerant) {
    return { needIndoorIfRain: false, rainAware: true };
  }

  if (mentionsRain) {
    return { needIndoorIfRain: true, rainAware: true };
  }

  return { needIndoorIfRain: false, rainAware: false };
}

export type SlotInferenceContext = {
  walkingStrictness: FilterStrictness;
  regionStrictness: FilterStrictness;
  rain: RainInference;
  explicitNeedIndoorFromUi: boolean;
};

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mutates merged.values in place: rain slots, strictness flags, quick-photo boost.
 */
export function applyDeterministicSlotInference(
  merged: MergedParserResult,
  rawText: string,
  opts: {
    explicitNeedIndoorFromUi: boolean;
    quickPhotoModeFromUi: boolean;
  },
): SlotInferenceContext {
  const walkingStrictness = inferWalkingFilterStrictness(rawText);
  const regionStrictness = inferRegionFilterStrictness(rawText);
  const rain = inferRainSlotsFromText(rawText, opts.explicitNeedIndoorFromUi);

  merged.values['need_indoor_if_rain'] = rain.needIndoorIfRain;
  merged.values['rain_aware'] = rain.rainAware;
  merged.values['walking_filter_strictness'] = walkingStrictness;
  merged.values['region_filter_strictness'] = regionStrictness;

  if (opts.quickPhotoModeFromUi || merged.values['quick_photo_mode'] === true) {
    merged.values['quick_photo_mode'] = true;
    const prev = num(merged.values['photo_priority']);
    merged.values['photo_priority'] = Math.max(prev, 7);
  }

  return {
    walkingStrictness,
    regionStrictness,
    rain,
    explicitNeedIndoorFromUi: opts.explicitNeedIndoorFromUi,
  };
}
