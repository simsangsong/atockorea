import { walkFunnel, type FunnelWalkEvent } from '@/lib/analytics/funnel-walk';

type E = FunnelWalkEvent & { session_id: string; anonymous_id: string | null; locale?: string | null };

const steps = [{ event_name: 'view' }, { event_name: 'add_to_cart' }, { event_name: 'purchase' }];

function e(p: Partial<E> & { event_name: string; server_ts: string; session_id: string; anonymous_id: string | null }): E {
  return p as E;
}

const visitorKey = (ev: E) => ev.anonymous_id ?? ev.session_id;

describe('walkFunnel', () => {
  it('completes a funnel that spans TWO sessions of one visitor (D-15 fix)', () => {
    // Same visitor (anon-1), two sessions, steps split across them, within window.
    const events: E[] = [
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'anon-1' }),
      e({ event_name: 'add_to_cart', server_ts: '2026-06-01T10:05:00Z', session_id: 's1', anonymous_id: 'anon-1' }),
      e({ event_name: 'purchase', server_ts: '2026-06-01T10:20:00Z', session_id: 's2', anonymous_id: 'anon-1' }),
    ];
    const { groups_considered, rollups } = walkFunnel(events, steps, 1800_000, { groupKey: visitorKey });
    expect(groups_considered).toBe(1);
    expect(rollups[0].counts).toEqual([1, 1, 1]); // reached all 3 steps despite 2 sessions
  });

  it('session-only grouping would FAIL the same multi-session funnel', () => {
    const events: E[] = [
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'anon-1' }),
      e({ event_name: 'add_to_cart', server_ts: '2026-06-01T10:05:00Z', session_id: 's1', anonymous_id: 'anon-1' }),
      e({ event_name: 'purchase', server_ts: '2026-06-01T10:20:00Z', session_id: 's2', anonymous_id: 'anon-1' }),
    ];
    const { rollups } = walkFunnel(events, steps, 1800_000, { groupKey: (ev) => ev.session_id });
    // s1 reaches steps 0,1 but not purchase; s2 has only purchase (never matched step 0)
    const all = rollups.find((r) => r.bucket === 'all')!;
    expect(all.counts).toEqual([1, 1, 0]); // purchase never counted under session grouping
  });

  it('short-circuits when a later step falls outside the conversion window', () => {
    const events: E[] = [
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'a' }),
      e({ event_name: 'add_to_cart', server_ts: '2026-06-01T10:05:00Z', session_id: 's1', anonymous_id: 'a' }),
      e({ event_name: 'purchase', server_ts: '2026-06-01T12:00:00Z', session_id: 's1', anonymous_id: 'a' }), // >30m after view
    ];
    const { rollups } = walkFunnel(events, steps, 1800_000, { groupKey: visitorKey });
    expect(rollups[0].counts).toEqual([1, 1, 0]);
  });

  it('enforces step ORDER — out-of-order events do not advance', () => {
    const events: E[] = [
      e({ event_name: 'purchase', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'a' }),
      e({ event_name: 'view', server_ts: '2026-06-01T10:01:00Z', session_id: 's1', anonymous_id: 'a' }),
    ];
    const { rollups } = walkFunnel(events, steps, 1800_000, { groupKey: visitorKey });
    // purchase before view: only step 0 (view) reached, no step 1/2
    expect(rollups[0].counts).toEqual([1, 0, 0]);
  });

  it('sorts within a group defensively (unordered input)', () => {
    const events: E[] = [
      e({ event_name: 'add_to_cart', server_ts: '2026-06-01T10:05:00Z', session_id: 's1', anonymous_id: 'a' }),
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'a' }),
      e({ event_name: 'purchase', server_ts: '2026-06-01T10:06:00Z', session_id: 's1', anonymous_id: 'a' }),
    ];
    const { rollups } = walkFunnel(events, steps, 1800_000, { groupKey: visitorKey });
    expect(rollups[0].counts).toEqual([1, 1, 1]);
  });

  it('buckets by a caller-provided key and counts groups, not events', () => {
    const events: E[] = [
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'a', locale: 'en' }),
      e({ event_name: 'view', server_ts: '2026-06-01T10:01:00Z', session_id: 's1', anonymous_id: 'a', locale: 'en' }), // dup
      e({ event_name: 'view', server_ts: '2026-06-01T10:00:00Z', session_id: 's2', anonymous_id: 'b', locale: 'ko' }),
    ];
    const { groups_considered, rollups } = walkFunnel(events, steps, 1800_000, {
      groupKey: visitorKey,
      bucketKey: (ev) => ev.locale ?? '(none)',
    });
    expect(groups_considered).toBe(2);
    const en = rollups.find((r) => r.bucket === 'en')!;
    const ko = rollups.find((r) => r.bucket === 'ko')!;
    expect(en.counts[0]).toBe(1); // one visitor, not two events
    expect(ko.counts[0]).toBe(1);
  });

  it('drops groups that never match step 0', () => {
    const events: E[] = [
      e({ event_name: 'add_to_cart', server_ts: '2026-06-01T10:00:00Z', session_id: 's1', anonymous_id: 'a' }),
    ];
    const { groups_considered, rollups } = walkFunnel(events, steps, 1800_000, { groupKey: visitorKey });
    expect(groups_considered).toBe(1); // group existed
    expect(rollups).toEqual([]); // but contributed nothing
  });
});
