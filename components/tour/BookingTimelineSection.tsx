'use client';

import React from 'react';
import { BookingTimeline } from '@/src/components/ui/timeline';
import { buildBookingTimelineViewModelClientFallback } from '@/src/lib/adapters/tours-adapter';
import type { BookingTimelineViewModel } from '@/src/types/tours';
import { useCopy } from '@/lib/i18n';

export interface BookingTimelineSectionProps {
  /** Server-provided timeline (from TourDetailViewModel.bookingTimeline or API). When present, this is used; do not use client fallback as source of truth. */
  serverTimeline?: BookingTimelineViewModel | null;
  /** Used only when serverTimeline is not available and allowClientFallback is true (e.g. tour detail page). Ignored on checkout/my-tour. */
  selectedDateForFallback?: Date | null;
  /** When false (checkout, my-tour): never use client-computed timeline for deadlines/countdowns; show server timeline or static copy only. Default true for backward compatibility on detail page. */
  allowClientFallback?: boolean;
  /** Tour detail: glass card (itinerary-glass-card). Checkout keeps default bordered card. */
  glassCard?: boolean;
}

export function BookingTimelineSection({
  serverTimeline,
  selectedDateForFallback,
  allowClientFallback = true,
  glassCard = false,
}: BookingTimelineSectionProps) {
  const copy = useCopy();
  const hasServerTimeline =
    serverTimeline &&
    typeof serverTimeline.now === 'string' &&
    typeof serverTimeline.tourStartAt === 'string';

  const cardShell = glassCard
    ? 'rounded-design-lg p-3 sm:p-4 td-card-b font-sans'
    : 'rounded-design-lg border border-gray-200 bg-white p-5 shadow-design-sm';

  if (hasServerTimeline) {
    return (
      <BookingTimeline
        now={serverTimeline!.now}
        refundDeadlineAt={serverTimeline!.refundDeadlineAt}
        balanceOpensAt={serverTimeline!.balanceOpensAt}
        balanceDueAt={serverTimeline!.balanceDueAt}
        tourStartAt={serverTimeline!.tourStartAt}
        variant={glassCard ? 'glass' : 'default'}
      />
    );
  }

  if (!allowClientFallback) {
    return (
      <div className={cardShell}>
        <div className={`${glassCard ? 'mb-2 text-[15px]' : 'mb-4 text-sm'} font-semibold tracking-tight text-gray-900`}>{copy.timeline.title}</div>
        <p className={`${glassCard ? 'text-[13px] leading-snug' : 'text-sm'} text-gray-500`}>{copy.checkout.timelineStaticCopy}</p>
      </div>
    );
  }

  const timeline = buildBookingTimelineViewModelClientFallback(selectedDateForFallback ?? null);

  if (!timeline) {
    return (
      <div className={cardShell}>
        <div className={`${glassCard ? 'mb-2 text-[15px]' : 'mb-4 text-sm'} font-semibold tracking-tight text-gray-900`}>{copy.timeline.title}</div>
        <p className={`${glassCard ? 'text-[13px] leading-snug' : 'text-sm'} text-gray-500`}>{copy.detail.selectDateToSeeTimeline}</p>
      </div>
    );
  }

  return (
    <BookingTimeline
      now={timeline.now}
      refundDeadlineAt={timeline.refundDeadlineAt}
      balanceOpensAt={timeline.balanceOpensAt}
      balanceDueAt={timeline.balanceDueAt}
      tourStartAt={timeline.tourStartAt}
      variant={glassCard ? 'glass' : 'default'}
    />
  );
}
