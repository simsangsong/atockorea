/**
 * A6 — skip-reason guest capsule (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 */
import { newlySkippedStops, renderSkipCapsule } from '@/lib/tour-room/skipNotice';
import type { DayPlanStop } from '@/lib/tour-room/dayPlan';

const stop = (over: Partial<DayPlanStop>): DayPlanStop => ({ seq: 1, ...over });

describe('newlySkippedStops', () => {
  it('detects a stop that BECAME skipped with a whitelisted reason', () => {
    const prev = [stop({ id: 's1', poi_key: 'udo', status: 'pending' })];
    const next = [stop({ id: 's1', poi_key: 'udo', status: 'skipped', skip_reason: 'weather' })];
    const result = newlySkippedStops(prev, next);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('weather');
  });

  it('does not re-announce an already-skipped stop', () => {
    const prev = [stop({ id: 's1', status: 'skipped', skip_reason: 'weather' })];
    const next = [stop({ id: 's1', status: 'skipped', skip_reason: 'weather' })];
    expect(newlySkippedStops(prev, next)).toHaveLength(0);
  });

  it('ignores skips without a whitelisted reason and non-skip status changes', () => {
    const prev = [stop({ id: 's1', status: 'pending' }), stop({ id: 's2', status: 'pending' })];
    const next = [
      stop({ id: 's1', status: 'skipped', skip_reason: 'because' }),
      stop({ id: 's2', status: 'arrived' }),
    ];
    expect(newlySkippedStops(prev, next)).toHaveLength(0);
  });

  it('a brand-new stop arriving already skipped announces once', () => {
    const next = [stop({ id: 'sX', poi_key: 'hallasan', status: 'skipped', skip_reason: 'closed' })];
    expect(newlySkippedStops([], next)).toHaveLength(1);
  });
});

describe('renderSkipCapsule', () => {
  it('names the stop per locale and translates the reason', () => {
    const bundle = renderSkipCapsule({
      stop: stop({
        poi_key: 'udo_island',
        status: 'skipped',
        skip_reason: 'weather',
        name_i18n: { en: 'Udo Island', ko: '우도' },
      }),
      reason: 'weather',
    });
    expect(bundle.translations.ko).toContain('우도');
    expect(bundle.translations.ko).toContain('날씨');
    expect(bundle.translations.en).toContain('Udo Island');
    expect(bundle.translations.en).toContain('weather');
    // Locale without a name falls back to en, then humanized poi_key.
    expect(bundle.translations.ja).toContain('Udo Island');
  });

  it('humanizes the poi_key when no name exists', () => {
    const bundle = renderSkipCapsule({
      stop: stop({ poi_key: 'seongsan_ilchulbong', status: 'skipped', skip_reason: 'crowd' }),
      reason: 'crowd',
    });
    expect(bundle.translations.en).toContain('Seongsan Ilchulbong');
  });
});
