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
import {
  ARRIVED_NUMERAL_MAX_MS,
  MOVING_NUMERAL_MAX_MS,
  PICKUP_NUMERAL_MAX_MS,
  latestArrival,
  nowCard,
  roomNowCardContext,
  scheduleTargetMs,
  type NowCardContext,
} from '@/lib/tour-room/nowCard';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

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

/**
 * SG-1a — numeral targets. SG-D2's rule under test: a target outside its
 * band is OMITTED, never clamped or faked — the row disappears and the
 * title keeps today's format. Bands are exported constants so these edges
 * cannot drift from the resolver.
 */
describe('nowCard — numeral targets (SG-1a)', () => {
  const MIN = 60_000;

  it('moving carries the next stop target inside 90min, and drops it outside', () => {
    const inBand = nowCard(
      base({ nextStop: { name: 'Art Valley', time: '12:30', targetMs: NOW + 89 * MIN } }),
    );
    expect(inBand.data.nextStopTargetMs).toBe(NOW + 89 * MIN);

    const outBand = nowCard(
      base({ nextStop: { name: 'Art Valley', time: '18:00', targetMs: NOW + MOVING_NUMERAL_MAX_MS + MIN } }),
    );
    expect(outBand.state).toBe('moving');
    expect(outBand.data.nextStopTargetMs).toBeUndefined();
    // The title inputs are untouched — the row is what vanishes, not the card.
    expect(outBand.data.nextStopName).toBe('Art Valley');
    expect(outBand.data.nextStopTime).toBe('18:00');
  });

  it('a next stop already behind the clock never gets a numeral', () => {
    const result = nowCard(base({ nextStop: { name: 'Art Valley', targetMs: NOW - MIN } }));
    expect(result.data.nextStopTargetMs).toBeUndefined();
  });

  it('arrived counts down to the notice target inside 180min only', () => {
    const inBand = nowCard(
      base({ arrived: { spotName: '성산일출봉' }, meetingTargetMs: NOW + 40 * MIN }),
    );
    expect(inBand.state).toBe('arrived');
    expect(inBand.data.meetingTargetMs).toBe(NOW + 40 * MIN);

    const outBand = nowCard(
      base({ arrived: { spotName: '성산일출봉' }, meetingTargetMs: NOW + ARRIVED_NUMERAL_MAX_MS + MIN }),
    );
    expect(outBand.data.meetingTargetMs).toBeUndefined();
  });

  it('pickup uses the tighter 120min band — dawn opens the board, not a 445분 numeral', () => {
    const inBand = nowCard(
      base({ pickup: { visible: true }, meetingTargetMs: NOW + 30 * MIN }),
    );
    expect(inBand.state).toBe('pickup_window');
    expect(inBand.data.meetingTargetMs).toBe(NOW + 30 * MIN);

    const outBand = nowCard(
      base({ pickup: { visible: true }, meetingTargetMs: NOW + PICKUP_NUMERAL_MAX_MS + MIN }),
    );
    expect(outBand.data.meetingTargetMs).toBeUndefined();
  });

  it('rally overage counts UP from its target; an untimed rally has no numeral', () => {
    const timed = nowCard(base({ rally: 'overdue', meetingTargetMs: NOW - 4 * MIN }));
    expect(timed.data.rallyTargetMs).toBe(NOW - 4 * MIN);

    const untimed = nowCard(base({ rally: 'overdue', meetingTargetMs: null }));
    expect(untimed.state).toBe('rally_overdue');
    expect(untimed.data.rallyTargetMs).toBeUndefined();
  });

  it('free time carries its end instant for the ticking clock', () => {
    const result = nowCard(base({ freeTimeEndsAtMs: NOW + 18 * MIN }));
    expect(result.data.freeTimeEndsAtMs).toBe(NOW + 18 * MIN);
  });
});

describe('scheduleTargetMs — hand-typed schedule times (SG-1a)', () => {
  const TOUR_DATE = '2026-07-28';
  // 12:30 KST on the tour date, expressed the way the resolver's NOW is.
  const HALF_PAST_NOON = Date.UTC(2026, 6, 28, 3, 30, 0);

  it('parses HH:MM and one-digit H:MM through the same wall clock', () => {
    expect(scheduleTargetMs(TOUR_DATE, '12:30')).toBe(HALF_PAST_NOON);
    expect(scheduleTargetMs(TOUR_DATE, '9:00')).toBe(Date.UTC(2026, 6, 28, 0, 0, 0));
  });

  it('refuses free text and impossible clocks instead of guessing', () => {
    expect(scheduleTargetMs(TOUR_DATE, '≈ 08:30')).toBeNull();
    expect(scheduleTargetMs(TOUR_DATE, '25:00')).toBeNull();
    expect(scheduleTargetMs(TOUR_DATE, '12:75')).toBeNull();
    expect(scheduleTargetMs(TOUR_DATE, null)).toBeNull();
    expect(scheduleTargetMs(null, '12:30')).toBeNull();
  });
});

/**
 * Gate ⑦ — the adapter actually THREADS the targets. The 2차 감사's finding
 * class was "resolver ready, caller passes null, tests green on fixtures":
 * this block feeds the adapter what HomeTab feeds it and asserts the data
 * comes out the other end, so a silent un-threading fails in CI.
 */
describe('roomNowCardContext — adapter threading (gate ⑦)', () => {
  const TOUR_DATE = '2026-07-28';

  const systemMessage = (metadata: Record<string, unknown>, createdAtMs: number): RoomMessage =>
    ({
      id: `m-${createdAtMs}`,
      sender_role: 'system',
      created_at: new Date(createdAtMs).toISOString(),
      source_text: '',
      metadata,
    }) as unknown as RoomMessage;

  it('threads a schedule time into nextStop.targetMs', () => {
    const ctx = roomNowCardContext({
      messages: [],
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      nextStop: { name: 'Art Valley', time: '12:30' },
      nowMs: NOW,
    });
    expect(ctx.nextStop?.targetMs).toBe(Date.UTC(2026, 6, 28, 3, 30, 0));
    const result = nowCard(ctx);
    expect(result.state).toBe('moving');
    expect(result.data.nextStopTargetMs).toBe(Date.UTC(2026, 6, 28, 3, 30, 0));
  });

  it('threads the active free-time notice into meetingTargetMs and the countdown', () => {
    const messages = [
      systemMessage(
        { kind: 'free_time_timer', until_time: '12:45', meeting_point: 'Blue gate' },
        NOW - 5 * 60_000,
      ),
    ];
    const ctx = roomNowCardContext({
      messages,
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      nowMs: NOW,
    });
    expect(ctx.freeTimeEndsAtMs).toBe(Date.UTC(2026, 6, 28, 3, 45, 0));
    expect(ctx.meetingTargetMs).toBe(Date.UTC(2026, 6, 28, 3, 45, 0));
  });

  it('a cancelled timer feeds NO numeral target', () => {
    const messages = [
      systemMessage({ kind: 'free_time_timer', until_time: '12:45' }, NOW - 10 * 60_000),
      systemMessage({ kind: 'free_time_timer', cancelled: true }, NOW - 60_000),
    ];
    const ctx = roomNowCardContext({
      messages,
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      nowMs: NOW,
    });
    expect(ctx.meetingTargetMs).toBeNull();
  });

  it('SG-2d — a solo driver return timer escalates to the rally hero at T+5', () => {
    // The driver-solo scenario (this track's target) never saw the overage
    // card: the adapter derived rally from meeting_notice only. The rung is
    // UNCHANGED — due stays quiet (crying wolf) — so entry is T+5, not T0.
    const timer = systemMessage(
      { kind: 'free_time_timer', until_time: '11:54' },
      NOW - 40 * 60_000,
    );
    const ctx = roomNowCardContext({
      messages: [timer],
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      nowMs: NOW, // 12:00 KST = T+6 past an 11:54 target
    });
    expect(ctx.rally).toBe('overdue');
    const result = nowCard(ctx);
    expect(result.state).toBe('rally_overdue');
    expect(result.data.rallyTargetMs).toBe(Date.UTC(2026, 6, 28, 2, 54, 0));
  });

  it("SG-2d — the server's 'the vehicle' sentinel never reaches a hero", () => {
    const timer = systemMessage(
      { kind: 'free_time_timer', until_time: '11:54', meeting_point: 'the vehicle' },
      NOW - 40 * 60_000,
    );
    const ctx = roomNowCardContext({
      messages: [timer],
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      nowMs: NOW,
    });
    expect(ctx.meetingPoint).toBeNull();
  });

  it('SG-5a — with no notice, the pickup board’s SCHEDULED time is the numeral target', () => {
    const ctx = roomNowCardContext({
      messages: [],
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      pickup: { visible: true, pickupTimeMs: NOW + 30 * 60_000 },
      nowMs: NOW,
    });
    expect(ctx.meetingTargetMs).toBe(NOW + 30 * 60_000);
    const result = nowCard(ctx);
    expect(result.state).toBe('pickup_window');
    expect(result.data.meetingTargetMs).toBe(NOW + 30 * 60_000);
    // An invisible board must NOT leak a target into mid-tour states.
    const hidden = roomNowCardContext({
      messages: [],
      lifecycle: 'live',
      tourDate: TOUR_DATE,
      locale: 'en',
      pickup: { visible: false, pickupTimeMs: NOW + 30 * 60_000 },
      nowMs: NOW,
    });
    expect(hidden.meetingTargetMs).toBeNull();
  });

  it('latestArrival stamps when the guest got here (the durable arrived source)', () => {
    const at = NOW - 20 * 60_000;
    const arrival = latestArrival(
      [systemMessage({ kind: 'spot_arrival', spot_title: '성산일출봉' }, at)],
      NOW,
    );
    expect(arrival).toMatchObject({ spotName: '성산일출봉', stayMinutes: null, arrivedAtMs: at });
  });
});
