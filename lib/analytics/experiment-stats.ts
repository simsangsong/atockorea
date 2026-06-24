// Pure aggregation for the experiment results route (D-15). Extracted so the
// math is golden-testable and so the conversion step's payload/context filter is
// actually applied (the route previously did `void conversionFilter`, counting
// every event-name match as a conversion).

import { chiSquare2x2PValue } from '@/lib/analytics/experiment-assignment';
import { eventMatchesStep, type MatchableEvent, type MatchableStep } from '@/lib/analytics/event-match';

export type ExperimentEvent = MatchableEvent & {
  session_id: string;
  experiment_assignments?: Record<string, string> | null;
};

export type VariantDef = { key: string; weight: number; label?: string };

export type VariantStat = {
  key: string;
  label: string;
  weight: number;
  sessions: number;
  conversions: number;
  conversion_rate: number;
};

export type PairwiseChiSquare = {
  control: string;
  challenger: string;
  chi2: number;
  p: number | null;
};

export type ExperimentAggregate = {
  variant_stats: VariantStat[];
  /** Backward-compatible primary test: control (variant[0]) vs first challenger. */
  chi_square: { chi2: number; p: number | null } | null;
  /** Control vs every other variant — supports 3+ variants. */
  pairwise_chi_square: PairwiseChiSquare[];
};

/**
 * Aggregate assignment + conversion stats per variant.
 *
 * A "session" counts toward a variant if any of its events carry that variant's
 * assignment for `expKey`. A session "converts" if any of its events matches the
 * conversion step (event name AND filter). Conversions are de-duped per session,
 * so a session converts at most once regardless of repeat events.
 */
export function aggregateExperimentVariants(
  events: ExperimentEvent[],
  expKey: string,
  variants: VariantDef[],
  conversionStep: MatchableStep | null,
): ExperimentAggregate {
  const sessionsByVariant = new Map<string, Set<string>>();
  const conversionsByVariant = new Map<string, Set<string>>();

  for (const row of events) {
    const assignments = row.experiment_assignments ?? {};
    const variant = assignments[expKey];
    if (!variant) continue;

    let sset = sessionsByVariant.get(variant);
    if (!sset) {
      sset = new Set();
      sessionsByVariant.set(variant, sset);
    }
    sset.add(row.session_id);

    if (conversionStep && eventMatchesStep(row, conversionStep)) {
      let cset = conversionsByVariant.get(variant);
      if (!cset) {
        cset = new Set();
        conversionsByVariant.set(variant, cset);
      }
      cset.add(row.session_id);
    }
  }

  const variant_stats: VariantStat[] = variants.map((v) => {
    const sessions = sessionsByVariant.get(v.key)?.size ?? 0;
    const conversions = conversionsByVariant.get(v.key)?.size ?? 0;
    return {
      key: v.key,
      label: v.label ?? v.key,
      weight: v.weight,
      sessions,
      conversions,
      conversion_rate: sessions === 0 ? 0 : conversions / sessions,
    };
  });

  const pairwise_chi_square: PairwiseChiSquare[] = [];
  if (conversionStep && variant_stats.length >= 2) {
    const control = variant_stats[0];
    for (let i = 1; i < variant_stats.length; i++) {
      const challenger = variant_stats[i];
      const res = chiSquare2x2PValue(
        control.conversions,
        control.sessions - control.conversions,
        challenger.conversions,
        challenger.sessions - challenger.conversions,
      );
      pairwise_chi_square.push({
        control: control.key,
        challenger: challenger.key,
        chi2: res.chi2,
        p: res.p,
      });
    }
  }

  const chi_square = pairwise_chi_square[0]
    ? { chi2: pairwise_chi_square[0].chi2, p: pairwise_chi_square[0].p }
    : null;

  return { variant_stats, chi_square, pairwise_chi_square };
}
