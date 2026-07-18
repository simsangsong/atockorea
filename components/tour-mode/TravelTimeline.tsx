'use client';

/**
 * V4 — Travel Timeline (concierge-uiux-v2 plan §E).
 *
 * A self-contained recap: a compact card in the feed opens a bottom sheet
 * (RoomShell's Sheet primitive — no shell/layout change, §H-1) that replays
 * the arrivals and photos the room already recorded. Two decoupled actions
 * live here:
 *   - "Leave a review" — always shown, never gated on the reward (§E / the
 *     TripAdvisor/Google/Klook incentivised-review policy, §B). The guest
 *     writes it themselves; we never draft it.
 *   - "Claim reward" — only when the timeline is complete (a stop + a photo);
 *     posts to /timeline-coupon which re-checks completion server-side.
 *
 * Zero LLM. Data is aggregated by the shared pure core in lib/tour-room/timeline.
 */

import { useMemo, useState } from 'react';
import Sheet from '@/components/tour-mode/Sheet';
import {
  IconJourney,
  IconReview,
  IconReward,
  IconArrived,
  IconPhotoNote,
  IconChevronRight,
  IconDone,
} from '@/components/tour-mode/icons';
import {
  buildTravelTimeline,
  TIMELINE_COPY,
  type TravelTimelineData,
} from '@/lib/tour-room/timeline';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const CLOSE_LABEL: Record<RoomLocale, string> = {
  en: 'Close',
  ko: '닫기',
  ja: '閉じる',
  es: 'Cerrar',
  zh: '关闭',
};

type ClaimState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; granted: boolean; reason?: string; code?: string; alreadyHad?: boolean }
  | { phase: 'error' };

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function RewardBlock({
  data,
  copy,
  bookingId,
  roomSession,
}: {
  data: TravelTimelineData;
  copy: (typeof TIMELINE_COPY)[RoomLocale];
  bookingId: string;
  roomSession: string;
}) {
  const [state, setState] = useState<ClaimState>({ phase: 'idle' });

  const claim = async () => {
    setState({ phase: 'loading' });
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/timeline-coupon`, {
        method: 'POST',
        headers: { 'x-tour-room-auth': roomSession },
      });
      const json = (await res.json().catch(() => ({}))) as {
        granted?: boolean;
        reason?: string;
        code?: string;
        alreadyHad?: boolean;
      };
      setState({
        phase: 'done',
        granted: Boolean(json.granted),
        reason: json.reason,
        code: json.code,
        alreadyHad: json.alreadyHad,
      });
    } catch {
      setState({ phase: 'error' });
    }
  };

  // Result surface after a claim attempt.
  if (state.phase === 'done') {
    if (state.granted) {
      return (
        <div className="tr-card mt-3 bg-[var(--tr-accent-soft)] px-4 py-3" data-testid="timeline-reward">
          <p className="tr-title flex items-center gap-1.5 text-[var(--tr-accent-deep)]">
            <IconDone size={16} aria-hidden />
            {copy.rewardDoneTitle}
          </p>
          <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">
            {state.alreadyHad ? copy.rewardAlready : copy.rewardDoneBody(state.code ?? '')}
          </p>
        </div>
      );
    }
    const message =
      state.reason === 'login_required'
        ? copy.rewardLogin
        : state.reason === 'not_available'
          ? copy.rewardUnavailable
          : copy.rewardError;
    return (
      <div className="tr-card mt-3 bg-[var(--tr-surface-2)] px-4 py-3" data-testid="timeline-reward">
        <p className="tr-card-text text-[var(--tr-ink-2)]">{message}</p>
      </div>
    );
  }

  // Not yet complete — show progress, no button.
  if (!data.complete) {
    return (
      <div className="tr-card mt-3 bg-[var(--tr-surface-2)] px-4 py-3" data-testid="timeline-reward-progress">
        <p className="tr-title flex items-center gap-1.5 text-[var(--tr-ink)]">
          <IconReward size={16} className="text-[var(--tr-accent-deep)]" aria-hidden />
          {copy.rewardProgressTitle}
        </p>
        <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.rewardProgressBody}</p>
      </div>
    );
  }

  // Complete — offer the claim.
  return (
    <div className="tr-card mt-3 bg-[var(--tr-accent-soft)] px-4 py-3" data-testid="timeline-reward-ready">
      <p className="tr-title flex items-center gap-1.5 text-[var(--tr-accent-deep)]">
        <IconReward size={16} aria-hidden />
        {copy.rewardReadyTitle}
      </p>
      <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.rewardReadyBody}</p>
      <button
        type="button"
        onClick={() => void claim()}
        disabled={state.phase === 'loading'}
        data-testid="timeline-claim"
        className="tr-label mt-2.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
      >
        <IconReward size={14} aria-hidden />
        {state.phase === 'loading' ? copy.claiming : copy.claim}
      </button>
    </div>
  );
}

function TimelineBody({
  data,
  copy,
  bookingId,
  roomSession,
  reviewHref,
}: {
  data: TravelTimelineData;
  copy: (typeof TIMELINE_COPY)[RoomLocale];
  bookingId: string;
  roomSession: string;
  reviewHref: string;
}) {
  return (
    <div data-testid="timeline-panel">
      {data.stopCount === 0 && data.photoCount === 0 ? (
        <p className="tr-card-text py-6 text-center text-[var(--tr-ink-3)]">{copy.empty}</p>
      ) : (
        <>
          {data.stops.length > 0 && (
            <section className="pt-1">
              <p className="tr-label font-semibold text-[var(--tr-ink-2)]">{copy.stopsHeading}</p>
              <ol className="mt-2">
                {data.stops.map((stop, index) => (
                  <li key={stop.id} className="relative flex gap-3">
                    <div className="tr-meta w-11 shrink-0 pt-1 text-right tabular-nums text-[var(--tr-ink-3)]">
                      {formatTime(stop.at)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                        <IconArrived size={12} aria-hidden />
                      </span>
                      {index < data.stops.length - 1 && (
                        <span className="w-px flex-1 bg-[var(--tr-hairline)]" aria-hidden />
                      )}
                    </div>
                    <div className={`min-w-0 flex-1 ${index < data.stops.length - 1 ? 'pb-4' : ''}`}>
                      <div className="tr-card-text font-medium text-[var(--tr-ink)]">{stop.title}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.photos.length > 0 && (
            <section className="mt-4">
              <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
                <IconPhotoNote size={13} aria-hidden />
                {copy.photosHeading}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {data.photos.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    loading="lazy"
                    className="aspect-square w-full rounded-[var(--tr-radius-tail)] object-cover"
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <RewardBlock data={data} copy={copy} bookingId={bookingId} roomSession={roomSession} />

      {/* V4.3 — review CTA, always shown, decoupled from the reward. */}
      <a
        href={reviewHref}
        data-testid="timeline-review"
        className="tr-label mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--tr-hairline)] font-semibold text-[var(--tr-ink)]"
      >
        <IconReview size={15} className="text-[var(--tr-accent-deep)]" aria-hidden />
        {copy.reviewCta}
      </a>
      <p className="tr-meta mt-1.5 text-center text-[var(--tr-ink-3)]">{copy.reviewHint}</p>
    </div>
  );
}

/**
 * H2 — the timeline sheet as a controlled surface, so entries other than the
 * feed card (the home dashboard tile) can open the same recap.
 */
export function TravelTimelineSheet({
  open,
  onClose,
  locale,
  messages,
  bookingId,
  roomSession,
  tourSlug,
}: {
  open: boolean;
  onClose: () => void;
  locale: RoomLocale;
  messages: RoomMessage[];
  bookingId: string;
  roomSession: string;
  tourSlug?: string | null;
}) {
  const data = useMemo(() => buildTravelTimeline(messages), [messages]);
  const copy = TIMELINE_COPY[locale];
  const reviewHref = tourSlug ? `/tour-product/${tourSlug}#reviews` : '/mypage';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel={CLOSE_LABEL[locale]}
      title={
        <span className="flex items-center gap-2 text-[var(--tr-accent-deep)]">
          <IconJourney size={18} aria-hidden />
          {copy.title}
        </span>
      }
    >
      <TimelineBody data={data} copy={copy} bookingId={bookingId} roomSession={roomSession} reviewHref={reviewHref} />
    </Sheet>
  );
}

/**
 * Feed entry: a compact card that opens the timeline sheet. Renders whenever
 * the tour has ended (so the recap is always reachable from the ended view)
 * or, mid-tour, once there is any content to show.
 */
export default function TravelTimelineEntry({
  locale,
  messages,
  bookingId,
  roomSession,
  tourSlug,
  variant,
}: {
  locale: RoomLocale;
  messages: RoomMessage[];
  bookingId: string;
  roomSession: string;
  tourSlug?: string | null;
  variant: 'live' | 'ended';
}) {
  const [open, setOpen] = useState(false);
  const data = useMemo(() => buildTravelTimeline(messages), [messages]);
  const copy = TIMELINE_COPY[locale];

  const hasContent = data.stopCount > 0 || data.photoCount > 0;
  if (variant !== 'ended' && !hasContent) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="timeline-open"
        className="tr-card mb-2 flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
          <IconJourney size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="tr-title block truncate text-[var(--tr-ink)]">{copy.title}</span>
          <span className="tr-meta block text-[var(--tr-ink-3)]">{copy.summary(data.stopCount, data.photoCount)}</span>
        </span>
        <IconChevronRight size={18} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
      </button>

      <TravelTimelineSheet
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        messages={messages}
        bookingId={bookingId}
        roomSession={roomSession}
        tourSlug={tourSlug}
      />
    </>
  );
}
