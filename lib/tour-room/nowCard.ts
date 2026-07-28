/**
 * I1 — "지금 카드": one resolver that answers the only question a guest opens
 * this app to ask.
 *
 * §H-3's finding was that the app waits for the guest instead of meeting them.
 * The home screen offers 7 tiles + 5 tabs + 3 header actions = 15 choices, and
 * the guest solves that puzzle every time, even though at any given moment
 * exactly one thing matters: the coach is coming, or you are standing in front
 * of a waterfall, or your group is waiting for you.
 *
 * Everything this needs already exists — `roomLifecycle`, `rallyStage`,
 * `secondaryCard`, `pickupBoardState`, `inPostTourWindow`, the schedule index,
 * arrival events. No new data, no new endpoint. What was missing is a single
 * place that decides which of them wins.
 *
 * 🔴 Two deliberate boundaries.
 *
 * It takes DERIVED inputs, not raw messages. The ladder is the thing being
 * tested here; re-deriving delay TTLs and rally thresholds inside it would make
 * a second copy of rules that already have owners, and this repo's recurring
 * failure is the second copy.
 *
 * And it returns SEMANTICS, not sentences — a state, a tone, an action kind and
 * the values to interpolate. Ten locales of copy belong with the component that
 * renders them (I2); a resolver that also owned the wording would be the one
 * place a locale could go missing without tsc noticing (U-D10).
 */
import type { RallyStage } from '@/lib/tour-room/notices';
import type { RoomLifecycle } from '@/lib/tour-room/time';

export type NowCardState =
  | 'rally_overdue'
  | 'free_time'
  | 'arrived'
  | 'pickup_window'
  | 'moving'
  | 'lobby'
  | 'ended';

/** Maps to the palette's existing roles; no new tokens (U-D23, I2 × I4). */
export type NowCardTone = 'danger' | 'warn' | 'accent' | 'base';

/** What the single primary button does. The label is the caller's business. */
export type NowCardAction =
  | { kind: 'call'; phone: string }
  | { kind: 'share_location' }
  | { kind: 'route_back' }
  | { kind: 'listen' }
  | { kind: 'meet_me_here' }
  | { kind: 'open_map' }
  | { kind: 'open_plan' }
  | { kind: 'open_timeline' };

/**
 * Chips are DERIVED from the state, never a fixed list — U-D23 again: two
 * suggestions that follow the moment read as help, six that follow nothing read
 * as a menu.
 */
export type NowCardChip = 'toilet' | 'photo_spot' | 'meeting_point' | 'next_stop';

export interface NowCardResult {
  state: NowCardState;
  tone: NowCardTone;
  action: NowCardAction | null;
  chips: NowCardChip[];
  /** Values for the caller to interpolate into its own localized copy. */
  data: {
    spotName?: string;
    stayMinutes?: number;
    nextStopName?: string;
    nextStopTime?: string;
    minutesLeft?: number;
    meetingPoint?: string;
    vehicleLabel?: string;
    driverName?: string;
    plateTail?: string;
    daysUntil?: number;
    meetingTime?: string;
  };
}

export interface NowCardContext {
  lifecycle: RoomLifecycle;
  /** From `rallyStage()` — null when no rally notice is live. */
  rally: RallyStage | null;
  meetingPoint?: string | null;
  meetingTime?: string | null;
  /** Ops line for the rally escalation; null hides the call action. */
  contactPhone?: string | null;

  /** Free-time countdown target (the existing free_time_timer contract). */
  freeTimeEndsAtMs?: number | null;

  /** Latest arrival that is still the guest's current place. */
  arrived?: { spotName: string; stayMinutes?: number | null } | null;

  /** Pickup board, already resolved by `pickupBoardState()`. */
  pickup?: { visible: boolean; vehicleLabel?: string | null; driverName?: string | null; plateTail?: string | null } | null;

  /** Next scheduled stop, if the day has one left. */
  nextStop?: { name: string; time?: string | null } | null;

  /** Whole days until the tour; used only by the lobby state. */
  daysUntil?: number | null;

  nowMs?: number;
}

/**
 * The ladder. First true wins, and exactly one card renders — P-D8's "one card"
 * invariant, which the secondary banner already respects.
 *
 * Ordering is by urgency, not by frequency: `moving` is the commonest state and
 * sits fifth, because a guest whose group is waiting must not have to scroll
 * past a travel-time estimate to find the phone number.
 */
export function nowCard(ctx: NowCardContext): NowCardResult {
  const nowMs = ctx.nowMs ?? Date.now();
  const meetingPoint = ctx.meetingPoint ?? undefined;

  // 1. The group is waiting. Nothing outranks this.
  if (ctx.rally === 'overdue' || ctx.rally === 'contact') {
    return {
      state: 'rally_overdue',
      tone: 'danger',
      // A phone number we do not have must not become a dead button; sharing a
      // location is the next most useful thing a late guest can do.
      action: ctx.contactPhone ? { kind: 'call', phone: ctx.contactPhone } : { kind: 'share_location' },
      chips: ['meeting_point'],
      data: { meetingPoint, meetingTime: ctx.meetingTime ?? undefined },
    };
  }

  // 2. Free time — a countdown is the whole message.
  if (typeof ctx.freeTimeEndsAtMs === 'number' && ctx.freeTimeEndsAtMs > nowMs) {
    return {
      state: 'free_time',
      tone: 'warn',
      action: { kind: 'route_back' },
      chips: ['toilet', 'meeting_point'],
      data: {
        minutesLeft: Math.max(0, Math.ceil((ctx.freeTimeEndsAtMs - nowMs) / 60_000)),
        meetingPoint,
      },
    };
  }

  // 3. Standing somewhere worth hearing about.
  if (ctx.arrived) {
    return {
      state: 'arrived',
      tone: 'accent',
      action: { kind: 'listen' },
      chips: ['toilet', 'photo_spot'],
      data: {
        spotName: ctx.arrived.spotName,
        stayMinutes: ctx.arrived.stayMinutes ?? undefined,
      },
    };
  }

  // 4. The vehicle is on its way to this guest.
  if (ctx.pickup?.visible) {
    return {
      state: 'pickup_window',
      tone: 'accent',
      action: { kind: 'meet_me_here' },
      chips: ['meeting_point'],
      data: {
        vehicleLabel: ctx.pickup.vehicleLabel ?? undefined,
        driverName: ctx.pickup.driverName ?? undefined,
        plateTail: ctx.pickup.plateTail ?? undefined,
        meetingPoint,
      },
    };
  }

  // 5. Between stops — the commonest state, and the quietest.
  if (ctx.lifecycle === 'live' && ctx.nextStop) {
    return {
      state: 'moving',
      tone: 'base',
      action: { kind: 'open_map' },
      chips: ['next_stop'],
      data: { nextStopName: ctx.nextStop.name, nextStopTime: ctx.nextStop.time ?? undefined },
    };
  }

  // 6. After the day. `inPostTourWindow` is the caller's to evaluate; by the
  // time lifecycle says ended, the record is what is left.
  if (ctx.lifecycle === 'ended') {
    return {
      state: 'ended',
      tone: 'base',
      action: { kind: 'open_timeline' },
      chips: [],
      data: {},
    };
  }

  // 7. Fallback, and it is a real state rather than a blank.
  //
  // 🔴 The honesty rule (§I-2): when nothing else resolves we do NOT hide the
  // card. An empty slot turns the home screen back into a screen you have to
  // choose from, which is the entire problem this resolver exists to remove.
  return {
    state: 'lobby',
    tone: 'base',
    // D−1 is when the planner is worth offering; earlier it is noise, and on the
    // day itself the map is what the guest reaches for.
    action: ctx.daysUntil === 1 ? { kind: 'open_plan' } : { kind: 'open_map' },
    chips: ['meeting_point'],
    data: {
      daysUntil: ctx.daysUntil ?? undefined,
      meetingPoint,
      meetingTime: ctx.meetingTime ?? undefined,
    },
  };
}
