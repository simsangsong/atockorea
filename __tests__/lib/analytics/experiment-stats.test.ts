import { aggregateExperimentVariants, type ExperimentEvent } from '@/lib/analytics/experiment-stats';

const EXP = 'hero_cta';

function ev(partial: Partial<ExperimentEvent> & { session_id: string; variant: string }): ExperimentEvent {
  const { variant, ...rest } = partial;
  return {
    event_name: 'view',
    experiment_assignments: { [EXP]: variant },
    ...rest,
  };
}

const variants = [
  { key: 'control', weight: 1, label: 'Control' },
  { key: 'treat', weight: 1, label: 'Treatment' },
];

describe('aggregateExperimentVariants', () => {
  it('counts distinct sessions per variant (deduped)', () => {
    const events: ExperimentEvent[] = [
      ev({ session_id: 's1', variant: 'control' }),
      ev({ session_id: 's1', variant: 'control' }), // dup session
      ev({ session_id: 's2', variant: 'control' }),
      ev({ session_id: 's3', variant: 'treat' }),
    ];
    const { variant_stats } = aggregateExperimentVariants(events, EXP, variants, null);
    expect(variant_stats.find((v) => v.key === 'control')!.sessions).toBe(2);
    expect(variant_stats.find((v) => v.key === 'treat')!.sessions).toBe(1);
  });

  it('applies the conversion step filter (D-15: filter was previously dropped)', () => {
    const conversionStep = { event_name: 'purchase', filter: { tour_id: 'jeju-1' } };
    const events: ExperimentEvent[] = [
      ev({ session_id: 's1', variant: 'control', event_name: 'purchase', payload: { tour_id: 'jeju-1' } }), // counts
      ev({ session_id: 's2', variant: 'control', event_name: 'purchase', payload: { tour_id: 'busan-2' } }), // filtered OUT
      ev({ session_id: 's3', variant: 'treat', event_name: 'purchase', payload: { tour_id: 'jeju-1' } }), // counts
    ];
    const { variant_stats } = aggregateExperimentVariants(events, EXP, variants, conversionStep);
    const control = variant_stats.find((v) => v.key === 'control')!;
    const treat = variant_stats.find((v) => v.key === 'treat')!;
    expect(control.sessions).toBe(2);
    expect(control.conversions).toBe(1); // only s1 matched the filter, NOT s2
    expect(treat.conversions).toBe(1);
  });

  it('without the fix an event-name-only count would over-count — guard the rate', () => {
    const conversionStep = { event_name: 'purchase', filter: { tour_id: 'jeju-1' } };
    const events: ExperimentEvent[] = [
      ev({ session_id: 's1', variant: 'control', event_name: 'purchase', payload: { tour_id: 'jeju-1' } }),
      ev({ session_id: 's2', variant: 'control', event_name: 'purchase', payload: { tour_id: 'OTHER' } }),
    ];
    const { variant_stats } = aggregateExperimentVariants(events, EXP, variants, conversionStep);
    const control = variant_stats.find((v) => v.key === 'control')!;
    expect(control.conversion_rate).toBe(0.5); // 1 of 2, not 1.0
  });

  it('dedupes conversions per session (repeat conversion events count once)', () => {
    const conversionStep = { event_name: 'purchase' };
    const events: ExperimentEvent[] = [
      ev({ session_id: 's1', variant: 'control', event_name: 'purchase' }),
      ev({ session_id: 's1', variant: 'control', event_name: 'purchase' }),
    ];
    const { variant_stats } = aggregateExperimentVariants(events, EXP, variants, conversionStep);
    expect(variant_stats.find((v) => v.key === 'control')!.conversions).toBe(1);
  });

  it('ignores events with no assignment for this experiment', () => {
    const events: ExperimentEvent[] = [
      { event_name: 'view', session_id: 's1', experiment_assignments: { other_exp: 'a' } },
      { event_name: 'view', session_id: 's2', experiment_assignments: null },
    ];
    const { variant_stats } = aggregateExperimentVariants(events, EXP, variants, null);
    expect(variant_stats.every((v) => v.sessions === 0)).toBe(true);
  });

  it('emits backward-compatible chi_square (control vs first challenger) + pairwise for 3+ variants', () => {
    const v3 = [
      { key: 'control', weight: 1 },
      { key: 'b', weight: 1 },
      { key: 'c', weight: 1 },
    ];
    const conversionStep = { event_name: 'purchase' };
    const events: ExperimentEvent[] = [];
    // control: 10 sessions, 2 conv; b: 10 sessions, 6 conv; c: 10 sessions, 1 conv
    const seed = (variant: string, n: number, conv: number) => {
      for (let i = 0; i < n; i++) {
        const sid = `${variant}-${i}`;
        events.push(ev({ session_id: sid, variant }));
        if (i < conv) events.push(ev({ session_id: sid, variant, event_name: 'purchase' }));
      }
    };
    seed('control', 10, 2);
    seed('b', 10, 6);
    seed('c', 10, 1);
    const { variant_stats, chi_square, pairwise_chi_square } = aggregateExperimentVariants(
      events,
      EXP,
      v3,
      conversionStep,
    );
    expect(variant_stats.map((v) => v.conversions)).toEqual([2, 6, 1]);
    expect(pairwise_chi_square).toHaveLength(2);
    expect(pairwise_chi_square.map((p) => p.challenger)).toEqual(['b', 'c']);
    // primary chi_square mirrors the first pairwise entry (control vs b)
    expect(chi_square).toEqual({ chi2: pairwise_chi_square[0].chi2, p: pairwise_chi_square[0].p });
  });

  it('returns null chi_square when there is no conversion step', () => {
    const { chi_square, pairwise_chi_square } = aggregateExperimentVariants(
      [ev({ session_id: 's1', variant: 'control' })],
      EXP,
      variants,
      null,
    );
    expect(chi_square).toBeNull();
    expect(pairwise_chi_square).toEqual([]);
  });
});
