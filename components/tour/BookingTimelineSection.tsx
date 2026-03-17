'use client';

import React from 'react';
import { BookingTimeline } from '@/src/components/ui/timeline';
import { buildBookingTimelineViewModelClientFallback } from '@/src/lib/adapters/tours-adapter';
import type { BookingTimelineViewModel } from '@/src/types/tours';
import { COPY } from '@/src/design/copy';

export interface BookingTimelineSectionProps {
  /** Server-provided timeline (from TourDetailViewModel.bookingTimeline or API). When present, this is used; do not use client fallback as source of truth. */
  serverTimeline?: BookingTimelineViewModel | null;
  /** Used only when serverTimeline is not available and allowClientFallback is true (e.g. tour detail page). Ignored on checkout/my-tour. */
  selectedDateForFallback?: Date | null;
  /** When false (checkout, my-tour): never use client-computed timeline for deadlines/countdowns; show server timeline or static copy only. Default true for backward compatibility on detail page. */
  allowClientFallback?: boolean;
}

export function BookingTimelineSection({
  serverTimeline,
  selectedDateForFallback,
  allowClientFallback = true,
}: BookingTimelineSectionProps) {
  const hasServerTimeline =
    serverTimeline &&
    typeof serverTimeline.now === 'string' &&
    typeof serverTimeline.tourStartAt === 'string';

  if (hasServerTimeline) {
    return (
      <BookingTimeline
        now={serverTimeline!.now}
        refundDeadlineAt={serverTimeline!.refundDeadlineAt}
        balanceOpensAt={serverTimeline!.balanceOpensAt}
        balanceDueAt={serverTimeline!.balanceDueAt}
        tourStartAt={serverTimeline!.tourStartAt}
      />
    );
  }

  if (!allowClientFallback) {
    return (
      <div className="rounded-design-lg border border-gray-200 bg-white p-5 shadow-design-sm">
        <div className="mb-4 text-sm font-semibold text-gray-900">{COPY.timeline.title}</div>
        <p className="text-sm text-gray-500">{COPY.checkout.timelineStaticCopy}</p>
      </div>
    );
  }

  const timeline = buildBookingTimelineViewModelClientFallback(selectedDateForFallback ?? null);

  if (!timeline) {
    return (
      <div className="rounded-design-lg border border-gray-200 bg-white p-5 shadow-design-sm">
        <div className="mb-4 text-sm font-semibold text-gray-900">{COPY.timeline.title}</div>
        <p className="text-sm text-gray-500">{COPY.detail.selectDateToSeeTimeline}</p>
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
    />
  );
}
