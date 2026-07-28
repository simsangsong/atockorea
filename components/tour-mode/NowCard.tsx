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
 * No new tokens (I2 × I4). Tone maps onto the palette roles the app already
 * has, so the ops home can reuse this vocabulary without the two drifting.
 */
import {
  IconChevronRight,
  IconPickup,
  IconQuickReply,
  IconTabMap,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import { NOW_CARD_COPY } from '@/lib/tour-room/nowCardCopy';
import type { NowCardChip, NowCardResult } from '@/lib/tour-room/nowCard';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

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

const TONE_INK: Record<NowCardResult['tone'], string> = {
  danger: 'text-[var(--tr-danger)]',
  warn: 'text-[var(--tr-ink)]',
  accent: 'text-[var(--tr-ink)]',
  base: 'text-[var(--tr-ink)]',
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

  const chipLabel = (chip: NowCardChip): string =>
    chip === 'toilet'
      ? copy.chipToilet
      : chip === 'photo_spot'
        ? copy.chipPhoto
        : chip === 'meeting_point'
          ? copy.chipMeeting
          : copy.chipNext;

  let eyebrow: string | null = null;
  let title = '';
  let sub: string | null = null;
  let actionLabel: string | null = null;
  let onAction: (() => void) | null = null;

  switch (result.state) {
    case 'rally_overdue':
      title = copy.rallyTitle;
      sub = result.data.meetingPoint ?? copy.rallySub;
      if (result.action?.kind === 'call') {
        const phone = result.action.phone;
        actionLabel = copy.rallyCall;
        onAction = () => handlers.onCall(phone);
      } else {
        actionLabel = copy.rallyShare;
        onAction = handlers.onShareLocation;
      }
      break;
    case 'free_time':
      title = copy.freeTitle(result.data.minutesLeft ?? 0);
      sub = result.data.meetingPoint ?? null;
      actionLabel = copy.freeAction;
      onAction = handlers.onRouteBack;
      break;
    case 'arrived':
      eyebrow = copy.arrivedEyebrow;
      title = result.data.spotName ?? '';
      sub =
        typeof result.data.stayMinutes === 'number' ? copy.arrivedStay(result.data.stayMinutes) : null;
      actionLabel = copy.arrivedAction;
      onAction = handlers.onListen;
      break;
    case 'pickup_window':
      title = copy.pickupTitle;
      // Whatever we actually know about the vehicle, in the order a guest
      // standing on a kerb would use it: plate last, because that is what they
      // check against the car in front of them.
      sub =
        [result.data.driverName, result.data.vehicleLabel, result.data.plateTail]
          .filter(Boolean)
          .join(' · ') || result.data.meetingPoint || null;
      actionLabel = copy.pickupAction;
      onAction = handlers.onMeetMeHere;
      break;
    case 'moving': {
      const hasNext = Boolean(result.data.nextStopName);
      // Last stop of the day: there is no 'next', so 'now' takes the title
      // rather than the card going blank.
      eyebrow = hasNext ? copy.movingEyebrow : nowLabel;
      title = hasNext
        ? [result.data.nextStopTime, result.data.nextStopName].filter(Boolean).join(' · ')
        : (result.data.currentStopName ?? '');
      // The card this replaced showed now AND next. Where is next is the more
      // useful of the two in transit, so it takes the title — but "now" stays,
      // because a guest who could read both must not read fewer afterwards.
      sub =
        hasNext && result.data.currentStopName ? `${nowLabel} · ${result.data.currentStopName}` : null;
      actionLabel = copy.movingAction;
      onAction = handlers.onOpenMap;
      break;
    }
    default:
      // lobby / ended are rendered by the cards that already own them
      // (LobbyCard, the ended recap) — this component is not asked for those.
      return null;
  }

  const ActionIcon =
    result.state === 'pickup_window'
      ? IconPickup
      : result.state === 'rally_overdue'
        ? IconQuickReply
        : IconTabMap;

  return (
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
      className={`tr-home-card tr-card-hero tr-now-swap mb-2 border px-4 py-4 ${TONE_CLASS[result.tone]}`}
      /**
       * A guest using a screen reader gets the change announced, and urgency
       * decides how rudely: `assertive` interrupts, which is right when the
       * group is already waiting and wrong for "next stop in 20 minutes".
       */
      aria-live={result.tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {eyebrow && (
        <p className="tr-meta text-cjk-safe font-semibold uppercase tracking-[0.08em] text-[var(--tr-ink-3)]">
          {eyebrow}
        </p>
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
}
