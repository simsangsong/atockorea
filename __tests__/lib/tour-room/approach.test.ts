/**
 * §11.C C2 — approach stepper boundary tests: the 1 km ring (999 vs 1001 m),
 * no-dwell single fire, once-per-POI-per-day (even after a full exit), the
 * 100 m accuracy filter, the 120 s cooldown, and nearest-target selection.
 */
import {
  APPROACH_COOLDOWN_MS,
  APPROACH_EXIT_RADIUS_M,
  APPROACH_RADIUS_M,
  INITIAL_APPROACH_STATE,
  composeApproachText,
  composeApproachTranslations,
  stepApproach,
  type ApproachState,
  type ApproachTarget,
} from '@/lib/tour-room/approach';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { GeoSample } from '@/lib/tour-room/geo';

// Seongsan-ish anchor. At this latitude 1° lat ≈ 111,194 m.
const M_PER_DEG_LAT = 111_194;
const SEONGSAN: ApproachTarget = { poi_key: 'seongsan', latitude: 33.458, longitude: 126.9425 };
const UDO: ApproachTarget = { poi_key: 'udo', latitude: 33.5045, longitude: 126.9523 };
const TARGETS = [SEONGSAN, UDO];

/** A sample `north` metres due north of `target`. */
function sample(target: ApproachTarget, north: number, at: number, extra?: Partial<GeoSample>): GeoSample {
  return {
    latitude: target.latitude + north / M_PER_DEG_LAT,
    longitude: target.longitude,
    timestampMs: at,
    accuracyM: 10,
    ...extra,
  };
}

const DAY = { dayKey: '2026-07-24' };
const T0 = Date.parse('2026-07-24T02:00:00Z');

describe('stepApproach — the 1 km ring', () => {
  it('fires on the first sample inside 1 km, with no dwell at all', () => {
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 900, T0), TARGETS, DAY);
    expect(step.approach).not.toBeNull();
    expect(step.approach!.poiKey).toBe('seongsan');
    expect(step.approach!.distanceM).toBeGreaterThan(890);
    expect(step.approach!.distanceM).toBeLessThan(910);
  });

  it('999 m fires, 1001 m does not (boundary ±1 m)', () => {
    expect(stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 999, T0), [SEONGSAN], DAY).approach).not.toBeNull();
    expect(stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 1001, T0), [SEONGSAN], DAY).approach).toBeNull();
  });

  it('exactly on the radius counts as inside', () => {
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, APPROACH_RADIUS_M, T0), [SEONGSAN], {
      ...DAY,
      // haversine of a pure-north offset is within a metre; nudge the ring so
      // the assertion is about the <= comparison, not floating point.
      radiusM: APPROACH_RADIUS_M + 2,
    });
    expect(step.approach).not.toBeNull();
  });

  it('fires exactly once while the device stays inside the ring', () => {
    let state: ApproachState = INITIAL_APPROACH_STATE;
    const fires: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = stepApproach(state, sample(SEONGSAN, 800 - i * 100, T0 + i * 300_000), [SEONGSAN], DAY);
      state = step.state;
      if (step.approach) fires.push(step.approach.poiKey);
    }
    expect(fires).toEqual(['seongsan']);
  });
});

describe('stepApproach — once per POI per day', () => {
  it('leaving past the exit ring and returning does NOT re-fire the same day', () => {
    let { state, approach } = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 900, T0), [SEONGSAN], DAY);
    expect(approach).not.toBeNull();

    // Well past the exit radius: the inside flag resets…
    ({ state, approach } = stepApproach(
      state,
      sample(SEONGSAN, APPROACH_EXIT_RADIUS_M + 4000, T0 + 600_000),
      [SEONGSAN],
      DAY,
    ));
    expect(approach).toBeNull();
    expect(state.inside.seongsan).toBe(false);

    // …but the day guard still holds on re-entry.
    ({ approach } = stepApproach(state, sample(SEONGSAN, 500, T0 + 1_200_000), [SEONGSAN], DAY));
    expect(approach).toBeNull();
  });

  it('the next KST day fires again', () => {
    const first = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 900, T0), [SEONGSAN], DAY);
    const next = stepApproach(first.state, sample(SEONGSAN, 900, T0 + 86_400_000), [SEONGSAN], {
      dayKey: '2026-07-25',
    });
    expect(next.approach).not.toBeNull();
  });

  it('holds through the hysteresis band without resetting', () => {
    const inside = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 900, T0), [SEONGSAN], DAY);
    const buffer = stepApproach(inside.state, sample(SEONGSAN, 1200, T0 + 600_000), [SEONGSAN], DAY);
    expect(buffer.state.inside.seongsan).toBe(true);
  });
});

describe('stepApproach — filters and cooldown', () => {
  it('ignores samples less accurate than 100 m (state untouched)', () => {
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 500, T0, { accuracyM: 101 }), TARGETS, DAY);
    expect(step.approach).toBeNull();
    expect(step.state).toBe(INITIAL_APPROACH_STATE);
  });

  it('accepts a 100 m accuracy sample (boundary is inclusive)', () => {
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 500, T0, { accuracyM: 100 }), TARGETS, DAY);
    expect(step.approach).not.toBeNull();
  });

  it('a second POI inside the cooldown is suppressed, then fires later', () => {
    const first = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 300, T0), TARGETS, DAY);
    expect(first.approach!.poiKey).toBe('seongsan');

    const tooSoon = stepApproach(first.state, sample(UDO, 300, T0 + APPROACH_COOLDOWN_MS - 1_000), TARGETS, DAY);
    expect(tooSoon.approach).toBeNull();
    expect(tooSoon.state.firedOn.udo).toBeUndefined(); // not consumed

    const later = stepApproach(tooSoon.state, sample(UDO, 300, T0 + APPROACH_COOLDOWN_MS + 1_000), TARGETS, DAY);
    expect(later.approach!.poiKey).toBe('udo');
  });

  it('evaluates only the nearest target when two rings overlap', () => {
    // Midway-ish but closer to Udo.
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(UDO, -200, T0), TARGETS, DAY);
    expect(step.approach!.poiKey).toBe('udo');
  });

  it('no targets is a no-op', () => {
    const step = stepApproach(INITIAL_APPROACH_STATE, sample(SEONGSAN, 100, T0), [], DAY);
    expect(step.approach).toBeNull();
    expect(step.state).toBe(INITIAL_APPROACH_STATE);
  });

  it('a device far from everything never fires', () => {
    // Seoul, ~450 km away.
    const step = stepApproach(
      INITIAL_APPROACH_STATE,
      { latitude: 37.5665, longitude: 126.978, timestampMs: T0, accuracyM: 10 },
      TARGETS,
      DAY,
    );
    expect(step.approach).toBeNull();
  });
});

describe('approach copy (zero-LLM, 5 locales)', () => {
  it.each(ROOM_LOCALES)('%s names the spot and the distance', (locale) => {
    const line = composeApproachText(locale, { spotTitle: 'Seongsan Ilchulbong', distanceM: 900 });
    expect(line).toContain('Seongsan Ilchulbong');
    expect(line).toContain('900 m');
  });

  it('formats km over 1000 m and reads naturally in ko/en', () => {
    expect(composeApproachText('ko', { spotTitle: '성산일출봉', distanceM: 1000 })).toBe(
      '곧 도착: 성산일출봉 — 약 1.0 km 앞이에요.',
    );
    expect(composeApproachText('en', { spotTitle: 'Udo', distanceM: 640 })).toBe(
      'Coming up: Udo — about 640 m ahead.',
    );
  });

  it('composeApproachTranslations covers every room locale with en as source', () => {
    const text = composeApproachTranslations({ spotTitle: 'Udo', distanceM: 900 });
    expect(Object.keys(text.translations).sort()).toEqual([...ROOM_LOCALES].sort());
    expect(text.source_locale).toBe('en');
    expect(text.source_text).toBe(text.translations.en);
  });
});
