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
  IconShare,
  TR_ICON,
} from '@/components/tour-mode/icons';
import {
  buildTravelTimeline,
  TIMELINE_COPY,
  type TravelTimelineData,
} from '@/lib/tour-room/timeline';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import {
  buildTimelineShareText,
  shareTimelineText,
  timelineShareHref,
  type ShareOutcome,
} from '@/lib/tour-room/timelineShare';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const CLOSE_LABEL: Record<RoomLocale, string> = {
  en: 'Close',
  ko: '닫기',
  ja: '閉じる',
  es: 'Cerrar',
  zh: '关闭',
  'zh-TW': '關閉',
  fr: 'Fermer',
  de: 'Schließen',
  ru: 'Закрыть',
  it: 'Chiudi',
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
            <IconDone size={TR_ICON.chip} aria-hidden />
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
          <IconReward size={TR_ICON.chip} className="text-[var(--tr-accent-deep)]" aria-hidden />
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
        <IconReward size={TR_ICON.chip} aria-hidden />
        {copy.rewardReadyTitle}
      </p>
      <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">{copy.rewardReadyBody}</p>
      <button
        type="button"
        onClick={() => void claim()}
        disabled={state.phase === 'loading'}
        data-testid="timeline-claim"
        className="tr-label mt-2.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
      >
        <IconReward size={TR_ICON.meta} aria-hidden />
        {state.phase === 'loading' ? copy.claiming : copy.claim}
      </button>
    </div>
  );
}

/**
 * X17 — "take this day with you" (§H-3 gap 5).
 *
 * Text only, and that is a constraint rather than a shortcut: since the storage
 * change the room's photos sit in a private bucket behind short-lived signed
 * URLs, so putting one in a shared message would paste a capability URL to a
 * guest's private photo into a group chat AND be dead within hours.
 *
 * The destination link is whatever `reviewPolicy` already decided for this
 * booking — direct guests get our tour page, OTA guests get their own
 * platform's listing, and an OTA booking with no known listing shares the recap
 * with no link at all. Writing a second rule here is how the two would drift.
 */
function ShareBlock({
  data,
  copy,
  reviewPolicy,
  tourTitle,
}: {
  data: TravelTimelineData;
  copy: (typeof TIMELINE_COPY)[RoomLocale];
  reviewPolicy: RoomReviewPolicy;
  tourTitle?: string | null;
}) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  const onShare = async () => {
    const href = timelineShareHref(
      reviewPolicy,
      typeof window === 'undefined' ? null : window.location.origin,
    );
    const text = buildTimelineShareText({ data, copy, tourTitle, href, formatTime });
    const result = await shareTimelineText(
      typeof navigator === 'undefined' ? undefined : navigator,
      { title: copy.title, text },
    );
    setOutcome(result);
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void onShare()}
        data-testid="timeline-share"
        className="tr-label flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-[var(--tr-hairline)] font-semibold text-[var(--tr-ink)]"
      >
        <IconShare size={TR_ICON.chip} className="text-[var(--tr-accent-deep)]" aria-hidden />
        {copy.shareCta}
      </button>
      {/*
        Say which of the two things happened. A native share sheet is obvious;
        a silent clipboard write is not, and an unexplained "nothing visible
        occurred" is worse than not offering the button. `aria-live` so it is
        announced rather than only seen.
      */}
      {outcome === 'copied' && (
        <p className="tr-meta mt-1.5 text-center text-[var(--tr-ink-3)]" role="status" aria-live="polite">
          {copy.shareCopied}
        </p>
      )}
      {outcome === 'unavailable' && (
        <p className="tr-meta mt-1.5 text-center text-[var(--tr-ink-3)]" role="status" aria-live="polite">
          {copy.shareUnavailable}
        </p>
      )}
    </div>
  );
}

function TimelineBody({
  data,
  copy,
  bookingId,
  roomSession,
  reviewPolicy,
  tourTitle,
}: {
  data: TravelTimelineData;
  copy: (typeof TIMELINE_COPY)[RoomLocale];
  bookingId: string;
  roomSession: string;
  reviewPolicy: RoomReviewPolicy;
  tourTitle?: string | null;
}) {
  const { reviewHref, reviewExternal, rewardAllowed } = reviewPolicy;
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
                    <div className="tr-meta tr-num w-11 shrink-0 pt-1 text-right text-[var(--tr-ink-3)]">
                      {formatTime(stop.at)}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                        <IconArrived size={TR_ICON.meta} aria-hidden />
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
                <IconPhotoNote size={TR_ICON.meta} aria-hidden />
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

      {/* X17 — 이 하루를 가져갈 수 있게. 기록이 있을 때만 뜬다. */}
      {(data.stopCount > 0 || data.photoCount > 0) && (
        <ShareBlock data={data} copy={copy} reviewPolicy={reviewPolicy} tourTitle={tourTitle} />
      )}

      {/* OTA 예약에는 자사 쿠폰을 제안하지 않는다 (reviewPolicy.ts). 라우트도
          같은 판단으로 발급을 거절하므로 여기는 화면 절제일 뿐이다. */}
      {rewardAllowed && (
        <RewardBlock data={data} copy={copy} bookingId={bookingId} roomSession={roomSession} />
      )}

      {/* V4.3 — review CTA, decoupled from the reward. 2026-07-28: 도착지가
          예약 채널에 따라 갈린다 — 자사 예약은 자사 리뷰 앵커, OTA 예약은 그
          OTA 리스팅. 리스팅 URL이 없으면 CTA 자체가 뜨지 않는다. */}
      {reviewHref && (
        <>
          <a
            href={reviewHref}
            {...(reviewExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            data-testid="timeline-review"
            className="tr-label mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--tr-hairline)] font-semibold text-[var(--tr-ink)]"
          >
            <IconReview size={TR_ICON.chip} className="text-[var(--tr-accent-deep)]" aria-hidden />
            {copy.reviewCta}
          </a>
          <p className="tr-meta mt-1.5 text-center text-[var(--tr-ink-3)]">{copy.reviewHint}</p>
        </>
      )}
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
  reviewPolicy,
  tourTitle,
}: {
  open: boolean;
  onClose: () => void;
  locale: RoomLocale;
  messages: RoomMessage[];
  bookingId: string;
  roomSession: string;
  reviewPolicy: RoomReviewPolicy;
  /** The tour's own name, so a shared recap says which trip it was. */
  tourTitle?: string | null;
}) {
  const data = useMemo(() => buildTravelTimeline(messages), [messages]);
  const copy = TIMELINE_COPY[locale];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel={CLOSE_LABEL[locale]}
      title={
        <span className="flex items-center gap-2 text-[var(--tr-accent-deep)]">
          <IconJourney size={TR_ICON.action} aria-hidden />
          {copy.title}
        </span>
      }
    >
      <TimelineBody
        data={data}
        copy={copy}
        bookingId={bookingId}
        roomSession={roomSession}
        reviewPolicy={reviewPolicy}
        tourTitle={tourTitle}
      />
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
  reviewPolicy,
  variant,
  tourTitle,
}: {
  locale: RoomLocale;
  messages: RoomMessage[];
  bookingId: string;
  roomSession: string;
  reviewPolicy: RoomReviewPolicy;
  variant: 'live' | 'ended';
  /** The tour's own name, so a shared recap says which trip it was. */
  tourTitle?: string | null;
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
          <IconJourney size={TR_ICON.action} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="tr-title block truncate text-[var(--tr-ink)]">{copy.title}</span>
          <span className="tr-meta block text-[var(--tr-ink-3)]">{copy.summary(data.stopCount, data.photoCount)}</span>
        </span>
        <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
      </button>

      <TravelTimelineSheet
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        messages={messages}
        bookingId={bookingId}
        roomSession={roomSession}
        reviewPolicy={reviewPolicy}
        tourTitle={tourTitle}
      />
    </>
  );
}
