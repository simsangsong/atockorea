"use client";

import { useCopy } from "@/lib/i18n";

export interface TimelineItem {
  title: string;
  subtitle?: string;
  date: string;
}

export interface TimelineProps {
  title?: string;
  items: TimelineItem[];
  /** Tour detail: match itinerary glass cards */
  variant?: "default" | "glass";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/**
 * Generic timeline for ordered steps with title, subtitle, and date.
 * Use for booking timeline or other step-based flows.
 */
export function Timeline({ title, items, variant = "default" }: TimelineProps) {
  const isGlass = variant === "glass";
  const wrapperClass = isGlass
    ? "rounded-design-lg p-3 sm:p-4 td-card-b font-sans"
    : "rounded-design-lg border border-gray-200 bg-white p-5 shadow-design-sm";
  return (
    <div className={wrapperClass}>
      {title ? (
        <div
          className={
            isGlass
              ? "mb-2 text-[15px] font-semibold tracking-tight text-gray-900"
              : "mb-4 text-sm font-semibold text-gray-900"
          }
        >
          {title}
        </div>
      ) : null}

      <div
        className={
          isGlass
            ? "hidden md:grid md:gap-3 md:grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
            : "hidden md:grid md:gap-4 md:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
        }
      >
        {items.map((item: TimelineItem) => (
          <div key={item.title} className="relative">
            <div className={`${isGlass ? "mb-2" : "mb-3"} h-2 rounded-full bg-gray-200`} />
            <div
              className={
                isGlass
                  ? "text-[13px] font-semibold leading-snug text-gray-900"
                  : "text-sm font-semibold text-gray-900"
              }
            >
              {item.title}
            </div>
            {item.subtitle ? (
              <div
                className={
                  isGlass
                    ? "mt-0.5 text-[12px] leading-snug text-gray-600"
                    : "mt-1 text-sm text-gray-600"
                }
              >
                {item.subtitle}
              </div>
            ) : null}
            <div
              className={
                isGlass
                  ? "mt-1.5 text-[11px] text-gray-500 tabular-nums"
                  : "mt-2 text-xs text-gray-500 tabular-nums"
              }
            >
              {formatDateTime(item.date)}
            </div>
          </div>
        ))}
      </div>

      <div className={isGlass ? "space-y-2.5 md:hidden" : "space-y-4 md:hidden"}>
        {items.map((item: TimelineItem) => (
          <div key={item.title} className="flex gap-2.5">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-hidden />
            <div>
              <div
                className={
                  isGlass
                    ? "text-[13px] font-semibold leading-snug text-gray-900"
                    : "text-sm font-semibold text-gray-900"
                }
              >
                {item.title}
              </div>
              {item.subtitle ? (
                <div
                  className={
                    isGlass
                      ? "text-[12px] leading-snug text-gray-600"
                      : "text-sm text-gray-600"
                  }
                >
                  {item.subtitle}
                </div>
              ) : null}
              <div
                className={
                  isGlass
                    ? "mt-0.5 text-[11px] text-gray-500 tabular-nums"
                    : "mt-1 text-xs text-gray-500 tabular-nums"
                }
              >
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
  variant?: "default" | "glass";
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
  variant = "default",
}: BookingTimelineProps) {
  const copy = useCopy();
  const items: TimelineItem[] = [
    {
      title: copy.timeline.reserveTitle,
      subtitle: copy.timeline.reserveSub,
      date: now,
    },
    {
      title: copy.timeline.refundTitle,
      subtitle: copy.timeline.refundSub,
      date: refundDeadlineAt || balanceOpensAt,
    },
    {
      title: copy.timeline.balanceTitle,
      subtitle: copy.timeline.balanceSub,
      date: balanceDueAt,
    },
    {
      title: copy.timeline.startTitle,
      subtitle: copy.timeline.startSub,
      date: tourStartAt,
    },
  ];

  return <Timeline title={copy.timeline.title} items={items} variant={variant} />;
}
