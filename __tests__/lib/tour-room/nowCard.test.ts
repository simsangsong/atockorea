/**
 * @jest-environment node
 *
 * I1 — the seven states and their edges.
 *
 * The plan puts this before any UI on purpose: it is a pure function, so all
 * seven states and every boundary can be checked without a screen, and in this
 * app UI bugs have only ever been caught by screenshots, never by reading code.
 * Whatever is settled here does not need a screenshot to settle again.
 *
 * The edges below are the ones §I-4 names — rally at T+5, both ends of the
 * pickup window, arrived versus moving, and the end of the day — plus the two
 * that would hurt most if they were wrong: the fallback must never be blank,
 * and a missing phone number must never render a dead button.
 */
import { nowCard, type NowCardContext } from '@/lib/tour-room/nowCard';

const NOW = Date.UTC(2026, 6, 28, 3, 0, 0); // 2026-07-28 12:00 KST

const base = (over: Partial<NowCardContext> = {}): NowCardContext => ({
  lifecycle: 'live',
  rally: null,
  nowMs: NOW,
  ...over,
});

describe('nowCard — the ladder', () => {
  it('🔴 a waiting group outranks everything else that is true at once', () => {
    // Every lower state is simultaneously true here. Urgency, not frequency,
    // decides — a guest whose group is waiting must not scroll past an ETA.
    const result = nowCard(
      base({
        rally: 'overdue',
        freeTimeEndsAtMs: NOW + 10 * 60_000,
        arrived: { spotName: '성산일출봉' },
        pickup: { visible: true },
        nextStop: { name: 'Art Valley' },
        contactPhone: '+821012345678',
      }),
    );
    expect(result.state).toBe('rally_overdue');
    expect(result.tone).toBe('danger');
    expect(result.action).toEqual({ kind: 'call', phone: '+821012345678' });
  });

  it('🔴 falls back to sharing a location rather than a dead call button', () => {
    // H-e's lesson: three surfaces shipped a "call ops" affordance with no
    // number behind it. A button that cannot do its job is worse than one that
    // is not there.
    const result = nowCard(base({ rally: 'contact', contactPhone: null }));
    expect(result.action).toEqual({ kind: 'share_location' });
  });

  it('free time beats arrival — the countdown is the whole message', () => {
    const result = nowCard(
      base({ freeTimeEndsAtMs: NOW + 25 * 60_000, arrived: { spotName: '협재해변' } }),
    );
    expect(result.state).toBe('free_time');
    expect(result.data.minutesLeft).toBe(25);
  });

  it('arrival beats the pickup board and the next stop', () => {
    const result = nowCard(
      base({
        arrived: { spotName: '천지연폭포', stayMinutes: 40 },
        pickup: { visible: true },
        nextStop: { name: 'Art Valley' },
      }),
    );
    expect(result.state).toBe('arrived');
    expect(result.action).toEqual({ kind: 'listen' });
    expect(result.data).toMatchObject({ spotName: '천지연폭포', stayMinutes: 40 });
  });

  it('pickup beats moving', () => {
    const result = nowCard(
      base({ pickup: { visible: true, plateTail: '1234' }, nextStop: { name: 'Art Valley' } }),
    );
    expect(result.state).toBe('pickup_window');
    expect(result.data.plateTail).toBe('1234');
  });
});

describe('nowCard — boundaries', () => {
  it('🔴 rally: set/remind/due stay quiet, overdue and contact do not', () => {
    // rallyStage crosses to `overdue` at T+5. Below that the guest is not late
    // and a red card would be crying wolf — the app would stop being believed.
    for (const stage of ['set', 'remind', 'due'] as const) {
      expect(nowCard(base({ rally: stage, nextStop: { name: 'x' } })).state).toBe('moving');
    }
    for (const stage of ['overdue', 'contact'] as const) {
      expect(nowCard(base({ rally: stage })).state).toBe('rally_overdue');
    }
  });

  it('🔴 free time ends exactly when it ends, not a minute later', () => {
    expect(nowCard(base({ freeTimeEndsAtMs: NOW + 1 })).state).toBe('free_time');
    // At the target and past it, the countdown is over — showing "0 minutes
    // left" forever is how a timer stops meaning anything.
    expect(nowCard(base({ freeTimeEndsAtMs: NOW, nextStop: { name: 'x' } })).state).toBe('moving');
    expect(nowCard(base({ freeTimeEndsAtMs: NOW - 1, nextStop: { name: 'x' } })).state).toBe('moving');
  });

  it('rounds the countdown up, so it never reads zero while time remains', () => {
    expect(nowCard(base({ freeTimeEndsAtMs: NOW + 1 })).data.minutesLeft).toBe(1);
    expect(nowCard(base({ freeTimeEndsAtMs: NOW + 61_000 })).data.minutesLeft).toBe(2);
  });

  it('pickup window is the caller’s to decide, and false means false', () => {
    // pickupBoardState already owns T−60/T+15 and the day check. Re-deriving it
    // here would be a second copy of a rule that has an owner.
    expect(nowCard(base({ pickup: { visible: false }, nextStop: { name: 'x' } })).state).toBe('moving');
  });

  it('🔴 moving requires a live tour AND somewhere to be going', () => {
    expect(nowCard(base({ lifecycle: 'live', nextStop: null })).state).toBe('lobby');
    expect(nowCard(base({ lifecycle: 'lobby', nextStop: { name: 'x' } })).state).toBe('lobby');
  });

  it('ended wins once the day is over', () => {
    const result = nowCard(base({ lifecycle: 'ended' }));
    expect(result.state).toBe('ended');
    expect(result.action).toEqual({ kind: 'open_timeline' });
  });

  it('🔴 an arrival still on screen outranks `ended` — the guest is standing there', () => {
    // Lifecycle flips on the calendar; a guest who just arrived somewhere has
    // not stopped being there because midnight passed.
    expect(nowCard(base({ lifecycle: 'ended', arrived: { spotName: '용머리해안' } })).state).toBe(
      'arrived',
    );
  });
});

describe('nowCard — the honesty rule', () => {
  it('🔴 never returns nothing', () => {
    // §I-2: a blank slot turns the home screen back into something you have to
    // choose from, which is the entire problem this resolver removes.
    const result = nowCard({ lifecycle: 'lobby', rally: null, nowMs: NOW });
    expect(result.state).toBe('lobby');
    expect(result.tone).toBe('base');
    expect(result.action).not.toBeNull();
  });

  it('offers the planner only on D−1', () => {
    expect(nowCard(base({ lifecycle: 'lobby', daysUntil: 1 })).action).toEqual({ kind: 'open_plan' });
    expect(nowCard(base({ lifecycle: 'lobby', daysUntil: 5 })).action).toEqual({ kind: 'open_map' });
    expect(nowCard(base({ lifecycle: 'lobby', daysUntil: 0 })).action).toEqual({ kind: 'open_map' });
  });
});

describe('nowCard — chips are derived, not listed', () => {
  it('each state suggests at most two, and they follow the moment', () => {
    const cases: Array<[NowCardContext, string[]]> = [
      [base({ arrived: { spotName: 'x' } }), ['toilet', 'photo_spot']],
      [base({ freeTimeEndsAtMs: NOW + 60_000 }), ['toilet', 'meeting_point']],
      [base({ nextStop: { name: 'x' } }), ['next_stop']],
      [base({ rally: 'overdue' }), ['meeting_point']],
      [base({ lifecycle: 'ended' }), []],
    ];
    for (const [ctx, expected] of cases) {
      const result = nowCard(ctx);
      expect(result.chips).toEqual(expected);
      expect(result.chips.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('nowCard — every state is reachable', () => {
  it('all seven, from realistic inputs', () => {
    // A resolver with an unreachable branch is a resolver with a bug nobody has
    // met yet. This enumerates them so a future edit cannot orphan one silently.
    const states = new Set([
      nowCard(base({ rally: 'overdue' })).state,
      nowCard(base({ freeTimeEndsAtMs: NOW + 60_000 })).state,
      nowCard(base({ arrived: { spotName: 'x' } })).state,
      nowCard(base({ pickup: { visible: true } })).state,
      nowCard(base({ nextStop: { name: 'x' } })).state,
      nowCard(base({ lifecycle: 'lobby' })).state,
      nowCard(base({ lifecycle: 'ended' })).state,
    ]);
    expect([...states].sort()).toEqual(
      ['arrived', 'ended', 'free_time', 'lobby', 'moving', 'pickup_window', 'rally_overdue'].sort(),
    );
  });
});

describe('nowCard — the last stop of the day', () => {
  it('🔴 still has a card when there is no next stop left', () => {
    // Found by a walk, not by these tests: every fixture here had a stop
    // remaining, so requiring `nextStop` looked correct until a real room whose
    // schedule had run out fell through to the lobby fallback — and the hero
    // card disappeared for the last hour of the tour.
    const result = nowCard(base({ lifecycle: 'live', nextStop: null, currentStop: { name: '용머리해안' } }));
    expect(result.state).toBe('moving');
    expect(result.data.currentStopName).toBe('용머리해안');
    expect(result.data.nextStopName).toBeUndefined();
    // and no chip promising a next stop the day does not have
    expect(result.chips).toEqual(['meeting_point']);
  });

  it('still needs SOMETHING — a live tour with no schedule at all is lobby', () => {
    expect(nowCard(base({ lifecycle: 'live', nextStop: null, currentStop: null })).state).toBe('lobby');
  });
});
