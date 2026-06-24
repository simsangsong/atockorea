// Pure funnel-walk aggregation (D-15). Extracted from the funnel route so the
// step-walk math is golden-testable and so grouping can be by VISITOR rather
// than by session — a funnel that spans multiple sessions (within the
// conversion window) could never complete under the old session-only grouping.

import { eventMatchesStep, type MatchableEvent, type MatchableStep } from '@/lib/analytics/event-match';

export type FunnelWalkEvent = MatchableEvent & { server_ts: string };

export type FunnelBucketRollup = {
  bucket: string;
  counts: number[]; // length === steps.length; counts[i] = groups reaching step i
};

export type FunnelWalkResult = {
  groups_considered: number;
  rollups: FunnelBucketRollup[];
};

/**
 * Walk each group's chronological events against the ordered funnel steps.
 *
 * - A group reaches step i if it matched steps 0..i in order.
 * - Step 0's first match starts the conversion window; later steps must occur
 *   within `windowMs` of that first match or the walk short-circuits.
 * - Conversions/steps are counted once per GROUP (caller decides the group key —
 *   pass a visitor id for cross-session funnels, a session id for the legacy
 *   session-scoped behaviour).
 */
export function walkFunnel<E extends FunnelWalkEvent>(
  events: E[],
  steps: MatchableStep[],
  windowMs: number,
  opts: {
    groupKey: (ev: E) => string;
    bucketKey?: (firstStepEv: E) => string;
  },
): FunnelWalkResult {
  const groups = new Map<string, E[]>();
  for (const ev of events) {
    const g = opts.groupKey(ev);
    let arr = groups.get(g);
    if (!arr) {
      arr = [];
      groups.set(g, arr);
    }
    arr.push(ev);
  }

  const bucketRollups = new Map<string, FunnelBucketRollup>();
  const rollupFor = (b: string): FunnelBucketRollup => {
    let r = bucketRollups.get(b);
    if (!r) {
      r = { bucket: b, counts: steps.map(() => 0) };
      bucketRollups.set(b, r);
    }
    return r;
  };

  for (const [, evs] of groups) {
    // Defensive chronological sort within the group (route pre-sorts globally,
    // but grouping must not rely on insertion order).
    const ordered = [...evs].sort(
      (a, b) => new Date(a.server_ts).getTime() - new Date(b.server_ts).getTime(),
    );

    let stepIdx = 0;
    let stepStartTs: number | null = null;
    let firstStepEv: E | null = null;

    for (const ev of ordered) {
      if (stepIdx >= steps.length) break;
      const ts = new Date(ev.server_ts).getTime();
      if (stepIdx > 0 && stepStartTs !== null && ts - stepStartTs > windowMs) break;
      if (eventMatchesStep(ev, steps[stepIdx])) {
        if (stepIdx === 0) {
          stepStartTs = ts;
          firstStepEv = ev;
        }
        stepIdx += 1;
      }
    }

    if (stepIdx === 0) continue;
    const bucket = opts.bucketKey ? opts.bucketKey(firstStepEv ?? ordered[0]) : 'all';
    const roll = rollupFor(bucket);
    for (let i = 0; i < stepIdx; i++) roll.counts[i] += 1;
  }

  return { groups_considered: groups.size, rollups: Array.from(bucketRollups.values()) };
}
