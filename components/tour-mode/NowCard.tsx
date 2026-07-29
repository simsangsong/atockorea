'use client';

/**
 * I2 — the one card the home screen is now built around.
 *
 * §I-3's before/after: the guest used to land on 7 tiles + a status strip and
 * had to work out which of them applied to the minute they were living in. The
 * resolver (`lib/tour-room/nowCard.ts`) now answers that, and this renders its
 * answer as the screen's protagonist — one card, one action, at most two chips.
 *
 * U-D23, applied literally: photography and accent live HERE and nowhere else
 * on this screen. When everything is emphasised nothing is, which is how the
 * old grid ended up with seven equally loud doors and a status line thinner
 * than any of them.
 *
 * SG-1b — the four-row grammar (마스터 플랜 v1.2 §D). Each row answers one
 * question: eyebrow WHAT is happening, numeral HOW LONG, title WHERE, sub
 * what to DO. The numeral is a NumeralClock target from the resolver — when
 * the resolver omitted the target (out of band, unknown, cancelled) the row
 * simply does not exist, and the title keeps the pre-SG format. Everything
 * rides the kill switch NEXT_PUBLIC_TR_NUMERAL_V1 (SG-D19): '0' restores
 * the exact pre-SG render, because this ships straight to live guests.
 *
 * No new tokens (I2 × I4). Tone maps onto the palette roles the app already
 * has, so the ops home can reuse this vocabulary without the two drifting.
 */
import { useRef } from 'react';
import {
  IconChevronRight,
  IconPickup,
  IconQuickReply,
  IconTabMap,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import NumeralClock, {
  type NumeralClockFormat,
  type NumeralClockMode,
} from '@/components/tour-mode/NumeralClock';
import { useRoomClock } from '@/components/tour-mode/roomClock';
import { dayPhase } from '@/lib/tour-room/dayPhase';
import { NOW_CARD_COPY } from '@/lib/tour-room/nowCardCopy';
import { PICKUP_GRACE_MS, RALLY_GRACE_MS, formatTargetTime } from '@/lib/tour-room/notices';
import type { NowCardChip, NowCardResult } from '@/lib/tour-room/nowCard';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** SG-D19 — kill switch, default ON; '0' restores the pre-numeral card. */
const NUMERAL_V1_ON = process.env.NEXT_PUBLIC_TR_NUMERAL_V1 !== '0';

export interface NowCardHandlers {
  onCall: (phone: string) => void;
  onShareLocation: () => void;
  onRouteBack: () => void;
  onListen: () => void;
  onMeetMeHere: () => void;
  onOpenMap: () => void;
  onOpenPlan: () => void;
  onOpenTimeline: () => void;
  onChip: (chip: NowCardChip) => void;
}

/**
 * Tone → the surface treatment. Danger and warn keep their own washes because
 * a late-group card that looked like every other card would be the same defect
 * N1 fixed on the chips: the most urgent thing being the least visible.
 */
const TONE_CLASS: Record<NowCardResult['tone'], string> = {
  danger: 'border-[var(--tr-danger)] bg-[var(--tr-danger-soft)]',
  warn: 'border-[var(--tr-warn)] bg-[var(--tr-warn-soft)]',
  accent: 'border-transparent',
  base: 'border-transparent',
};

/**
 * 🔴 I5 — the danger title is INK, not red.
 *
 * Red-on-red-wash measured 3.95:1 in light across all ten skins, against a 4.5
 * floor. The urgency is carried by the border, the wash and the icon, all of
 * which are non-text and cleared their own bar; making the sentence red as well
 * bought nothing and cost legibility — on the one card a guest reads while
 * their group is already waiting for them.
 *
 * Caught by extending the standing gate before shipping, not by looking at it.
 */
const TONE_INK: Record<NowCardResult['tone'], string> = {
  danger: 'text-[var(--tr-ink)]',
  warn: 'text-[var(--tr-ink)]',
  accent: 'text-[var(--tr-ink)]',
  base: 'text-[var(--tr-ink)]',
};

interface NumeralRow {
  mode: NumeralClockMode;
  format: NumeralClockFormat;
  targetMs: number;
}

/** " · "-joined, skipping the parts we do not actually have. */
const dotJoin = (...parts: Array<string | null | undefined>): string | null => {
  const joined = parts.filter(Boolean).join(' · ');
  return joined || null;
};

export default function NowCard({
  result,
  locale,
  handlers,
  testId,
  nowLabel,
}: {
  result: NowCardResult;
  locale: RoomLocale;
  handlers: NowCardHandlers;
  /** Preserved from the card this replaces, so nothing that watched it breaks. */
  testId?: string;
  /** The room already localizes "Now" for the schedule tab; reuse, never recopy. */
  nowLabel: string;
}) {
  const copy = NOW_CARD_COPY[locale];
  const roomNow = useRoomClock();

  const chipLabel = (chip: NowCardChip): string =>
    chip === 'toilet'
      ? copy.chipToilet
      : chip === 'photo_spot'
        ? copy.chipPhoto
        : chip === 'meeting_point'
          ? copy.chipMeeting
          : copy.chipNext;

  const fmtTime = (ms: number) => formatTargetTime(ms, locale);

  let eyebrow: string | null = null;
  let title = '';
  let sub: string | null = null;
  let numeral: NumeralRow | null = null;
  /** What a screen reader hears on state entry — the numeral is aria-hidden. */
  let srSentence = '';
  let actionLabel: string | null = null;
  let onAction: (() => void) | null = null;

  switch (result.state) {
    case 'rally_overdue': {
      title = copy.rallyTitle;
      srSentence = copy.rallyTitle;
      if (NUMERAL_V1_ON) {
        eyebrow = copy.rallyEyebrow;
        if (typeof result.data.rallyTargetMs === 'number') {
          numeral = { mode: 'up', format: 'clock', targetMs: result.data.rallyTargetMs };
          sub = dotJoin(
            result.data.meetingPoint,
            copy.waitUntil(fmtTime(result.data.rallyTargetMs + RALLY_GRACE_MS)),
          );
        } else {
          sub = result.data.meetingPoint ?? copy.rallySub;
        }
      } else {
        sub = result.data.meetingPoint ?? copy.rallySub;
      }
      if (result.action?.kind === 'call') {
        const phone = result.action.phone;
        actionLabel = copy.rallyCall;
        onAction = () => handlers.onCall(phone);
      } else {
        actionLabel = copy.rallyShare;
        onAction = handlers.onShareLocation;
      }
      break;
    }
    case 'free_time': {
      srSentence = copy.freeTitle(result.data.minutesLeft ?? 0);
      if (NUMERAL_V1_ON) {
        eyebrow = copy.freeEyebrow;
        title = result.data.meetingPoint
          ? copy.freeMeetAt(result.data.meetingPoint)
          : copy.freeTitleNoPoint;
        if (typeof result.data.freeTimeEndsAtMs === 'number') {
          numeral = { mode: 'down', format: 'clock', targetMs: result.data.freeTimeEndsAtMs };
          sub = copy.waitUntil(fmtTime(result.data.freeTimeEndsAtMs + RALLY_GRACE_MS));
        } else {
          // No target survived — fall back to the sentence the room shipped with.
          title = copy.freeTitle(result.data.minutesLeft ?? 0);
          sub = result.data.meetingPoint ?? null;
        }
      } else {
        title = copy.freeTitle(result.data.minutesLeft ?? 0);
        sub = result.data.meetingPoint ?? null;
      }
      actionLabel = copy.freeAction;
      onAction = handlers.onRouteBack;
      break;
    }
    case 'arrived': {
      eyebrow = copy.arrivedEyebrow;
      title = result.data.spotName ?? '';
      srSentence = title;
      if (NUMERAL_V1_ON && typeof result.data.meetingTargetMs === 'number') {
        numeral = {
          mode: 'down',
          format: 'minutes',
          targetMs: result.data.meetingTargetMs,
        };
        sub = copy.arrivedUntil(fmtTime(result.data.meetingTargetMs));
      } else {
        sub =
          typeof result.data.stayMinutes === 'number'
            ? copy.arrivedStay(result.data.stayMinutes)
            : null;
      }
      actionLabel = copy.arrivedAction;
      onAction = handlers.onListen;
      break;
    }
    case 'pickup_window': {
      title = copy.pickupTitle;
      srSentence = copy.pickupTitle;
      // Whatever we actually know about the vehicle, in the order a guest
      // standing on a kerb would use it: plate last, because that is what they
      // check against the car in front of them.
      const vehicleLine =
        [result.data.driverName, result.data.vehicleLabel, result.data.plateTail]
          .filter(Boolean)
          .join(' · ') || null;
      if (NUMERAL_V1_ON) {
        eyebrow = copy.pickupEyebrow;
        if (typeof result.data.meetingTargetMs === 'number') {
          numeral = { mode: 'down', format: 'minutes', targetMs: result.data.meetingTargetMs };
          sub = dotJoin(
            vehicleLine ?? result.data.meetingPoint,
            // Request-phrased, +10 — pickup has no enforcement capsule (F-4).
            copy.pickupWaitUntil(fmtTime(result.data.meetingTargetMs + PICKUP_GRACE_MS)),
          );
        } else {
          sub = vehicleLine ?? result.data.meetingPoint ?? null;
        }
      } else {
        sub = vehicleLine ?? result.data.meetingPoint ?? null;
      }
      actionLabel = copy.pickupAction;
      onAction = handlers.onMeetMeHere;
      break;
    }
    case 'moving': {
      const hasNext = Boolean(result.data.nextStopName);
      // Last stop of the day: there is no 'next', so 'now' takes the title
      // rather than the card going blank.
      eyebrow = hasNext ? copy.movingEyebrow : nowLabel;
      const legacyTitle = hasNext
        ? [result.data.nextStopTime, result.data.nextStopName].filter(Boolean).join(' · ')
        : (result.data.currentStopName ?? '');
      srSentence = legacyTitle;
      if (NUMERAL_V1_ON) {
        if (hasNext && typeof result.data.nextStopTargetMs === 'number') {
          // The minutes carry the time; the title is just the place.
          numeral = { mode: 'down', format: 'minutes', targetMs: result.data.nextStopTargetMs };
          title = result.data.nextStopName ?? '';
        } else {
          title = legacyTitle;
        }
        sub = dotJoin(
          result.data.currentStopName ? `${nowLabel} · ${result.data.currentStopName}` : null,
          // "Nothing to do" is a real state (제로베이스 §D-B question 3).
          copy.movingReassurance,
        );
      } else {
        title = legacyTitle;
        sub =
          hasNext && result.data.currentStopName
            ? `${nowLabel} · ${result.data.currentStopName}`
            : null;
      }
      actionLabel = copy.movingAction;
      onAction = handlers.onOpenMap;
      break;
    }
    default:
      // lobby / ended are rendered by the cards that already own them
      // (LobbyCard, the ended recap) — this component is not asked for those.
      return null;
  }

  /**
   * N2 — the day's arc. The now card already answers WHAT is happening; this
   * lets the surface answer WHEN, with no word spent and so no translation.
   *
   * Derived at render rather than stored: it is a function of the clock, and a
   * card that remounts on every state change (see `key` below) picks the new
   * phase up for free.
   *
   * No lifecycle passed, and tsc is the reason: by this line `result.state` has
   * been narrowed to the five live states, because the switch above returns null
   * for lobby and ended. This component is never the ended card. The settled
   * phase belongs to the recap that owns that moment, and it carries the
   * attribute itself.
   */
  const phase = dayPhase({});

  const ActionIcon =
    result.state === 'pickup_window'
      ? IconPickup
      : result.state === 'rally_overdue'
        ? IconQuickReply
        : IconTabMap;

  /**
   * SG-D18 — the announcer. It lives OUTSIDE the <section> because the card
   * is aria-atomic: an inner update would re-read the whole card. Text
   * changes on state ENTRY (the numeral moved the minutes out of the spoken
   * title — without this a screen-reader guest hears LESS than before) and
   * at the free-time milestones the vibrate ladder also uses (T-10/5/1).
   */
  const minutesLeft = result.data.minutesLeft ?? null;
  const srBucket =
    result.state === 'free_time' && minutesLeft !== null
      ? minutesLeft > 10
        ? 'entry'
        : minutesLeft > 5
          ? 'm10'
          : minutesLeft > 1
            ? 'm5'
            : 'm1'
      : 'entry';
  const srRef = useRef<{ state: string; bucket: string; text: string } | null>(null);
  if (!srRef.current || srRef.current.state !== result.state || srRef.current.bucket !== srBucket) {
    srRef.current = {
      state: result.state,
      bucket: srBucket,
      text:
        result.state === 'free_time' && srBucket !== 'entry'
          ? copy.freeTitle(minutesLeft ?? 0)
          : srSentence,
    };
  }

  const card = (
    <section
      /**
       * I3 / U-D26 — `key` on the state, so React REMOUNTS when the moment
       * changes and the entrance animation actually runs. Without it React
       * reconciles in place, the text swaps with no transition, and the one
       * piece of feedback this screen has is lost.
       *
       * Keyed on state, not on content: a countdown ticking from 25 to 24
       * minutes is the same moment, and re-animating every minute would turn
       * ambient feedback into a distraction.
       */
      key={result.state}
      data-testid={testId ?? 'home-now-card'}
      data-now-state={result.state}
      data-tr-phase={phase}
      className={`tr-home-card tr-card-hero tr-now-swap mb-2 border px-4 py-4 ${TONE_CLASS[result.tone]}`}
      /**
       * A guest using a screen reader gets the change announced, and urgency
       * decides how rudely: `assertive` interrupts, which is right when the
       * group is already waiting and wrong for "next stop in 20 minutes".
       * The ticking numeral is aria-hidden and therefore exempt.
       */
      aria-live={result.tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {eyebrow && (
        <p className="tr-meta text-cjk-safe font-semibold uppercase tracking-[0.08em] text-[var(--tr-ink-3)]">
          {eyebrow}
        </p>
      )}
      {numeral && (
        <NumeralClock
          mode={numeral.mode}
          format={numeral.format}
          targetMs={numeral.targetMs}
          unitLabel={numeral.format === 'minutes' ? copy.minuteUnitLabel : undefined}
          initialNowMs={roomNow()}
          nowMs={roomNow}
          testId="home-now-numeral"
        />
      )}
      <p className={`tr-title text-cjk-body mt-0.5 font-semibold leading-snug ${TONE_INK[result.tone]}`}>
        {title}
      </p>
      {sub && <p className="tr-card-text text-cjk-body mt-1 text-[var(--tr-ink-2)]">{sub}</p>}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          data-testid="home-now-action"
          className="tr-btn-physical text-cjk-safe mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-on-accent)]"
        >
          <ActionIcon size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          {actionLabel}
          <IconChevronRight size={TR_ICON.chip} className="opacity-70" aria-hidden />
        </button>
      )}

      {result.chips.length > 0 && (
        <div className="tr-chiprow mt-2.5 flex gap-1.5" data-testid="home-now-chips">
          {result.chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handlers.onChip(chip)}
              data-testid={`home-now-chip-${chip}`}
              className="tr-chip-tap tr-chip-tap--quiet tr-label text-cjk-safe flex h-9 shrink-0 items-center rounded-full bg-[var(--tr-surface)] px-3 font-semibold text-[var(--tr-ink)]"
            >
              {chipLabel(chip)}
            </button>
          ))}
        </div>
      )}
    </section>
  );

  if (!NUMERAL_V1_ON) return card;

  return (
    <>
      <span
        className="sr-only text-cjk-body"
        role="status"
        aria-live={result.tone === 'danger' ? 'assertive' : 'polite'}
        aria-atomic="true"
        data-testid="home-now-sr"
      >
        {srRef.current.text}
      </span>
      {card}
    </>
  );
}
