/**
 * T4.3/T4.4 — zero-LLM event templates, 3-tier content resolution, and the
 * nearest-spot + cooldown geofence stepper (GPS-jitter single-event AC).
 */
import {
  renderSpotEventText,
  renderSpotEventTranslations,
  resolveSpotContent,
} from '@/lib/tour-room/spotContent';
import { stepSpotWatch, INITIAL_SPOT_WATCH_STATE, ARRIVAL_COOLDOWN_MS } from '@/lib/tour-room/spotWatcher';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { GeoSample } from '@/lib/tour-room/geo';

describe('spot event templates (§M-2 ① — zero LLM)', () => {
  it('renders every kind in every locale with the spot name interpolated', () => {
    for (const locale of ROOM_LOCALES) {
      const text = renderSpotEventText('arrived_audio', locale, { spot: 'Haedong Yonggungsa' });
      expect(text).toContain('Haedong Yonggungsa');
      expect(text).not.toContain('{spot}');
    }
  });

  it('bundles all-locale translations with an English source', () => {
    const bundle = renderSpotEventTranslations('meeting_notice_timed', { time: '15:30', point: 'Gate 2' });
    expect(bundle.source_locale).toBe('en');
    expect(bundle.source_text).toBe('Meeting time is 15:30. Please gather at Gate 2.');
    expect(Object.keys(bundle.translations).sort()).toEqual([...ROOM_LOCALES].sort());
    expect(bundle.translations.ko).toContain('15:30');
    expect(bundle.translations.ko).toContain('Gate 2');
  });
});

describe('resolveSpotContent (D-5 three tiers)', () => {
  it('tier 1: curated content jsonb wins, locale key with en fallback', () => {
    const spot = {
      title: 'Gamcheon',
      poi_key: 'gamcheon_culture_village',
      content: { ko: { description: '한국의 마추픽추', highlights: ['골목 예술'] } },
    };
    const ko = resolveSpotContent(spot, 'ko');
    expect(ko.tier).toBe('curated');
    expect(ko.content?.description).toBe('한국의 마추픽추');
    // No ja key, no en key → curated tier misses, poi_kb takes over.
    const ja = resolveSpotContent(spot, 'ja');
    expect(ja.tier).toBe('poi_kb');
  });

  it('tier 2: poi_kb fact sheet by poi_key', () => {
    const { content, tier } = resolveSpotContent(
      { title: 'Haedong Yonggungsa', poi_key: 'haedong_yonggungsa', content: {} },
      'en',
    );
    expect(tier).toBe('poi_kb');
    expect(content?.name).toBe('Haedong Yonggungsa');
    expect(content?.visitBasics?.hours).toBeTruthy();
  });

  it('tier 3: nothing available → none', () => {
    expect(resolveSpotContent({ title: 'X', poi_key: null, content: null }, 'en').tier).toBe('none');
    expect(resolveSpotContent({ title: 'X', poi_key: 'no_such_key', content: {} }, 'en').tier).toBe('none');
  });
});

describe('stepSpotWatch (T4.4 + §O-8)', () => {
  const SPOT_A = { id: 'a', latitude: 35.0, longitude: 129.0, trigger_radius_m: 80 };
  // ~150m east of A — overlapping exit radii scenarios use the nearest rule.
  const SPOT_B = { id: 'b', latitude: 35.0, longitude: 129.00165, trigger_radius_m: 80 };
  const at = (latitude: number, longitude: number, timestampMs: number, speedMps = 0): GeoSample => ({
    latitude,
    longitude,
    accuracyM: 10,
    speedMps,
    timestampMs,
  });

  it('GPS jitter across the boundary emits exactly one arrival (hysteresis + dwell)', () => {
    let state = INITIAL_SPOT_WATCH_STATE;
    const arrivals: string[] = [];
    // Enter A, jitter out to the buffer band and back, dwell 60s.
    const samples = [
      at(35.0, 129.0, 0), // inside
      at(35.0007, 129.0, 10_000), // ~78m — inside
      at(35.00095, 129.0, 20_000), // ~105m — buffer (hold)
      at(35.0, 129.0, 61_000), // back inside, dwell satisfied
      at(35.0, 129.0, 70_000), // still inside — no second event
    ];
    for (const sample of samples) {
      const step = stepSpotWatch(state, sample, [SPOT_A]);
      state = step.state;
      if (step.arrival) arrivals.push(step.arrival.spotId);
    }
    expect(arrivals).toEqual(['a']);
  });

  it('only the nearest spot is evaluated when radii overlap (§O-8)', () => {
    let state = INITIAL_SPOT_WATCH_STATE;
    // Standing basically on B: A is ~150m away (outside its trigger).
    const s1 = stepSpotWatch(state, at(35.0, 129.00165, 0), [SPOT_A, SPOT_B]);
    state = s1.state;
    const s2 = stepSpotWatch(state, at(35.0, 129.00165, 61_000), [SPOT_A, SPOT_B]);
    expect(s2.arrival?.spotId).toBe('b');
  });

  it('a second arrival within the 120s cooldown is deferred, not lost', () => {
    let state = INITIAL_SPOT_WATCH_STATE;
    // Arrive at A.
    state = stepSpotWatch(state, at(35.0, 129.0, 0), [SPOT_A, SPOT_B]).state;
    const first = stepSpotWatch(state, at(35.0, 129.0, 61_000), [SPOT_A, SPOT_B]);
    state = first.state;
    expect(first.arrival?.spotId).toBe('a');

    // Walk straight to B and dwell — dwell satisfied at 61s later but still
    // inside the cooldown window.
    state = stepSpotWatch(state, at(35.0, 129.00165, 70_000), [SPOT_A, SPOT_B]).state;
    const suppressed = stepSpotWatch(state, at(35.0, 129.00165, 131_000), [SPOT_A, SPOT_B]);
    state = suppressed.state;
    expect(suppressed.arrival).toBeNull();

    // After the cooldown the deferred arrival fires.
    const after = stepSpotWatch(state, at(35.0, 129.00165, 61_000 + ARRIVAL_COOLDOWN_MS + 1_000), [SPOT_A, SPOT_B]);
    expect(after.arrival?.spotId).toBe('b');
  });
});
