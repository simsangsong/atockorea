"use client";

import { COPY } from "@/src/design/copy";

export interface TimelineItem {
  title: string;
  subtitle?: string;
  date: string;
}

export interface TimelineProps {
  title?: string;
  items: TimelineItem[];
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/**
 * Generic timeline for ordered steps with title, subtitle, and date.
 * Use for booking timeline or other step-based flows.
 */
export function Timeline({ title, items }: TimelineProps) {
  return (
    <div className="rounded-design-lg border border-gray-200 bg-white p-5 shadow-design-sm">
      {title ? (
        <div className="mb-4 text-sm font-semibold text-gray-900">{title}</div>
      ) : null}

      <div className="hidden md:grid md:gap-4 md:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {items.map((item: TimelineItem) => (
          <div key={item.title} className="relative">
            <div className="mb-3 h-2 rounded-full bg-gray-200" />
            <div className="text-sm font-semibold text-gray-900">
              {item.title}
            </div>
            {item.subtitle ? (
              <div className="mt-1 text-sm text-gray-600">{item.subtitle}</div>
            ) : null}
            <div className="mt-2 text-xs text-gray-500 tabular-nums">
              {formatDateTime(item.date)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 md:hidden">
        {items.map((item: TimelineItem) => (
          <div key={item.title} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-hidden />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {item.title}
              </div>
              {item.subtitle ? (
                <div className="text-sm text-gray-600">{item.subtitle}</div>
              ) : null}
              <div className="mt-1 text-xs text-gray-500 tabular-nums">
                {formatDateTime(item.date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Props for booking-specific timeline. Server provides all dates. */
export interface BookingTimelineProps {
  now: string;
  refundDeadlineAt: string;
  balanceOpensAt: string;
  balanceDueAt: string;
  tourStartAt: string;
}

/**
 * Booking timeline with copy from design/copy. Consume timeline data from adapter/ViewModel only.
 */
export function BookingTimeline({
  now,
  refundDeadlineAt,
  balanceOpensAt,
  balanceDueAt,
  tourStartAt,
}: BookingTimelineProps) {
  const items: TimelineItem[] = [
    {
      title: COPY.timeline.depositTitle,
      subtitle: COPY.timeline.depositSub,
      date: now,
    },
    {
      title: COPY.timeline.refundTitle,
      subtitle: COPY.timeline.refundSub,
      date: refundDeadlineAt || balanceOpensAt,
    },
    {
      title: COPY.timeline.balanceTitle,
      subtitle: COPY.timeline.balanceSub,
      date: balanceDueAt,
    },
    {
      title: COPY.timeline.startTitle,
      subtitle: COPY.timeline.startSub,
      date: tourStartAt,
    },
  ];

  return <Timeline title={COPY.timeline.title} items={items} />;
}
