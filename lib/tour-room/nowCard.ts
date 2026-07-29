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
import { activeNotice, rallyStage, wallClockToMs, type RallyStage } from '@/lib/tour-room/notices';
import type { RoomLifecycle } from '@/lib/tour-room/time';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

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

/**
 * SG-D2 — a numeral outside its band is noise, so the resolver simply omits
 * the target and the row never renders. Bands are policy, and policy lives
 * here where a test can reach it, not in the component.
 *
 * moving: a schedule ETA further out than 90min is a plan, not a countdown.
 * pickup: the board is visible from KST midnight; without a ceiling a guest
 * checking at dawn would meet a "445분" numeral.
 * arrived: past three hours the ARRIVAL_TTL below has almost certainly
 * rotated the state anyway; the ceiling makes it a contract.
 */
export const MOVING_NUMERAL_MAX_MS = 90 * 60 * 1000;
export const PICKUP_NUMERAL_MAX_MS = 120 * 60 * 1000;
export const ARRIVED_NUMERAL_MAX_MS = 180 * 60 * 1000;

/** In-band future target or undefined — the "no number beats a wrong row" rule. */
function bandedTarget(
  targetMs: number | null | undefined,
  nowMs: number,
  maxMs: number,
): number | undefined {
  if (typeof targetMs !== 'number') return undefined;
  const distance = targetMs - nowMs;
  return distance > 0 && distance <= maxMs ? targetMs : undefined;
}

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
    currentStopName?: string;
    nextStopTime?: string;
    minutesLeft?: number;
    meetingPoint?: string;
    vehicleLabel?: string;
    driverName?: string;
    plateTail?: string;
    daysUntil?: number;
    meetingTime?: string;
    /**
     * SG-1a — numeral targets for NumeralClock, present ONLY when a real,
     * in-band target exists (SG-D2: a missing number removes the row, it is
     * never faked). Which field a state carries is part of the state's
     * meaning: rally counts UP from its target, the others count DOWN.
     */
    rallyTargetMs?: number;
    freeTimeEndsAtMs?: number;
    meetingTargetMs?: number;
    nextStopTargetMs?: number;
  };
}

export interface NowCardContext {
  lifecycle: RoomLifecycle;
  /** From `rallyStage()` — null when no rally notice is live. */
  rally: RallyStage | null;
  meetingPoint?: string | null;
  meetingTime?: string | null;
  /**
   * SG-1a — the active notice's target instant (meeting or free-time end),
   * null when untimed or cancelled. Feeds the arrived/pickup countdowns and
   * the rally overage; the adapter is the only writer.
   */
  meetingTargetMs?: number | null;
  /** Ops line for the rally escalation; null hides the call action. */
  contactPhone?: string | null;

  /** Free-time countdown target (the existing free_time_timer contract). */
  freeTimeEndsAtMs?: number | null;

  /** Latest arrival that is still the guest's current place. */
  arrived?: { spotName: string; stayMinutes?: number | null; arrivedAtMs?: number | null } | null;

  /** Pickup board, already resolved by `pickupBoardState()`. */
  pickup?: { visible: boolean; vehicleLabel?: string | null; driverName?: string | null; plateTail?: string | null } | null;

  /** Next scheduled stop, if the day has one left. */
  nextStop?: { name: string; time?: string | null; targetMs?: number | null } | null;

  /**
   * The stop the SCHEDULE says the guest is at, which is not the same claim as
   * `arrived`: that one needs an operator to have tapped 도착, this one is
   * wall-clock arithmetic. It never wins a state on its own — a schedule is a
   * plan, and a plan is not evidence — but dropping it entirely was a
   * regression: the card it replaces showed now AND next, and a guest who could
   * see both could see one fewer thing afterwards.
   */
  currentStop?: { name: string } | null;

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
      data: {
        meetingPoint,
        meetingTime: ctx.meetingTime ?? undefined,
        // Overage counts UP from the target; an untimed rally has no numeral.
        ...(typeof ctx.meetingTargetMs === 'number' ? { rallyTargetMs: ctx.meetingTargetMs } : {}),
      },
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
        freeTimeEndsAtMs: ctx.freeTimeEndsAtMs,
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
        // "10:40까지" — the notice's own commitment, never a nominal duration
        // (stay_minutes has readers but no writer anywhere in this repo).
        ...(bandedTarget(ctx.meetingTargetMs, nowMs, ARRIVED_NUMERAL_MAX_MS) !== undefined
          ? { meetingTargetMs: ctx.meetingTargetMs as number }
          : {}),
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
        ...(bandedTarget(ctx.meetingTargetMs, nowMs, PICKUP_NUMERAL_MAX_MS) !== undefined
          ? { meetingTargetMs: ctx.meetingTargetMs as number }
          : {}),
      },
    };
  }

  // 5. Between stops — the commonest state, and the quietest.
  //
  // 🔴 `nextStop || currentStop`, not `nextStop` alone. A guest at the LAST
  // stop of the day has no next one, and requiring it dropped them out of every
  // state into the lobby fallback — which on a live tour meant the hero card
  // vanished for the last hour of the tour. Caught by a walk against a seeded
  // room whose schedule had run out, not by a unit test, because the fixtures
  // all had a stop left.
  if (ctx.lifecycle === 'live' && (ctx.nextStop || ctx.currentStop)) {
    return {
      state: 'moving',
      tone: 'base',
      action: { kind: 'open_map' },
      // On the last stop there is no next one, and a chip labelled "next stop"
      // that opens a finished schedule is a promise the day cannot keep.
      chips: ctx.nextStop ? ['next_stop'] : ['meeting_point'],
      data: {
        nextStopName: ctx.nextStop?.name,
        nextStopTime: ctx.nextStop?.time ?? undefined,
        currentStopName: ctx.currentStop?.name,
        ...(bandedTarget(ctx.nextStop?.targetMs, nowMs, MOVING_NUMERAL_MAX_MS) !== undefined
          ? { nextStopTargetMs: ctx.nextStop?.targetMs as number }
          : {}),
      },
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

// ---------------------------------------------------------------------------
// Adapter: room state → NowCardContext
//
// Kept here rather than in the component for the same reason the resolver takes
// derived inputs: HomeTab is 840 lines and growing, and a derivation that lives
// in a component cannot be tested without rendering one. Everything below is
// pure and reads only what the room already broadcasts.
// ---------------------------------------------------------------------------

/**
 * How long an arrival keeps being "where the guest is".
 *
 * There is no departure event to close it — the operator taps 도착 and nothing
 * else. Without a bound, a guest who arrived at 10:00 would still be told they
 * are at that waterfall at 18:00. Three hours is longer than any single stop on
 * these tours and short enough that a stale card cannot survive the day; a later
 * arrival supersedes it immediately regardless.
 */
export const ARRIVAL_TTL_MS = 3 * 60 * 60 * 1000;

const ARRIVAL_KINDS = new Set(['spot_arrival', 'arrival_bundle']);

/** The spot the guest is standing at, if any. Newest wins. */
export function latestArrival(
  messages: readonly RoomMessage[],
  nowMs = Date.now(),
): { spotName: string; stayMinutes?: number | null; arrivedAtMs: number } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const meta = message.metadata as { kind?: string; spot_title?: string; stay_minutes?: number } | null | undefined;
    if (!meta?.kind || !ARRIVAL_KINDS.has(meta.kind)) continue;
    const at = new Date(message.created_at).getTime();
    if (!Number.isFinite(at) || nowMs - at > ARRIVAL_TTL_MS) return null;
    const spotName = typeof meta.spot_title === 'string' ? meta.spot_title.trim() : '';
    if (!spotName) return null;
    return {
      spotName,
      stayMinutes: typeof meta.stay_minutes === 'number' ? meta.stay_minutes : null,
      // SG-1a — when the guest got here; the say queue's durable arrived
      // source (SG-D11) reads this instead of volatile geofence state.
      arrivedAtMs: at,
    };
  }
  return null;
}

/**
 * SG-1a — schedule wall clock → epoch ms. Schedules are hand-typed, so a
 * one-digit hour ("9:00") is normalized before the strict parser; anything
 * looser ("≈ 08:30", "afternoon") returns null and the numeral row simply
 * does not exist for that leg — the title keeps today's format instead.
 */
export function scheduleTargetMs(
  tourDate: string | null | undefined,
  time: string | null | undefined,
): number | null {
  if (!tourDate || !time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return wallClockToMs(tourDate, `${match[1].padStart(2, '0')}:${match[2]}`);
}

/** Whole days from today (KST) to the tour date; null when undated. */
export function daysUntilTour(tourDate: string | null | undefined, nowMs = Date.now()): number | null {
  if (!tourDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tourDate);
  if (!match) return null;
  const KST = 9 * 60 * 60 * 1000;
  const startOfTour = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - KST;
  const today = new Date(nowMs + KST);
  const startOfToday =
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - KST;
  return Math.round((startOfTour - startOfToday) / (24 * 60 * 60 * 1000));
}

export interface RoomNowCardInput {
  messages: readonly RoomMessage[];
  lifecycle: RoomLifecycle;
  tourDate: string | null | undefined;
  locale: RoomLocale;
  nextStop?: { name: string; time?: string | null } | null;
  currentStop?: { name: string } | null;
  pickup?: NowCardContext['pickup'];
  contactPhone?: string | null;
  nowMs?: number;
}

/**
 * Build the resolver's context from what the room already has.
 *
 * The notice does double duty and that is not an accident: `activeNotice`
 * already owns "which timer is live", and both the rally ladder and the
 * free-time countdown read it. Deriving them separately here would be the
 * second copy that drifts.
 */
export function roomNowCardContext(input: RoomNowCardInput): NowCardContext {
  const nowMs = input.nowMs ?? Date.now();
  const notice = activeNotice([...input.messages], input.tourDate, nowMs);
  const isFreeTime = notice?.kind === 'free_time_timer' && !notice.cancelled;

  // SG-2d — free_time_timer's server default is the English literal
  // 'the vehicle' with no pointI18n; on the rally hero that would leak to
  // all ten locales, so the sentinel is omitted (the copy's own fallback
  // sentence takes over). Real operator-typed points ride verbatim.
  const rawPoint = notice?.pointI18n?.[input.locale] ?? notice?.point ?? null;
  const meetingPoint = rawPoint === 'the vehicle' ? null : rawPoint;

  return {
    lifecycle: input.lifecycle,
    // SG-2d — the ladder is kind-agnostic now: a solo driver's return timer
    // escalates exactly like a guide's meeting notice. The banner already
    // fired overdue capsules for both kinds; only this hero derivation was
    // still split (the driver-solo scenario — this track's target — never
    // saw the overage card). rallyStage itself handles cancelled → null.
    rally: notice ? rallyStage(notice, nowMs) : null,
    meetingPoint,
    // SG-1a — the notice's target feeds every countdown; a cancelled notice
    // must never feed a numeral, whatever its target says.
    meetingTargetMs: notice && !notice.cancelled ? notice.targetMs : null,
    contactPhone: input.contactPhone ?? null,
    freeTimeEndsAtMs: isFreeTime ? notice?.targetMs ?? null : null,
    arrived: latestArrival(input.messages, nowMs),
    pickup: input.pickup ?? null,
    nextStop: input.nextStop
      ? { ...input.nextStop, targetMs: scheduleTargetMs(input.tourDate, input.nextStop.time) }
      : null,
    currentStop: input.currentStop ?? null,
    daysUntil: daysUntilTour(input.tourDate, nowMs),
    nowMs,
  };
}
