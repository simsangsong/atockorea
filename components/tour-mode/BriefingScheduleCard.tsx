'use client';

/**
 * C-16 card ③ — today's schedule preview (guest-facing).
 *
 * A glance, not a document: times + stop titles straight from the resolver,
 * with the "times shift with traffic" footnote that keeps the promise honest.
 * The full, live schedule stays in the Schedule tab.
 *
 * Titles render verbatim (proper nouns; translating them would need an LLM at
 * send time). Only the chrome is localized.
 */

import { CalendarDays } from 'lucide-react';
import { SCHEDULE_COPY, type BriefingScheduleMeta } from '@/lib/ops/seating/cards/schedule';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function BriefingScheduleCard({
  meta,
  locale,
}: {
  meta: BriefingScheduleMeta;
  locale: RoomLocale;
}) {
  const copy = SCHEDULE_COPY[locale] ?? SCHEDULE_COPY.en;
  const stops = Array.isArray(meta.stops) ? meta.stops : [];
  if (stops.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="briefing-schedule-card"
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
          aria-hidden
        >
          <CalendarDays size={15} strokeWidth={2} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--tr-ink)]">{copy.title}</p>
        <span className="tr-meta shrink-0 text-[var(--tr-ink-3)]" data-testid="briefing-schedule-count">
          {copy.stopCount.replace('{n}', String(stops.length))}
        </span>
      </div>

      <ol className="divide-y divide-[var(--tr-hairline)] border-t border-[var(--tr-hairline)]">
        {stops.map((stop, index) => (
          <li
            key={`${stop.poi_key ?? stop.title}-${index}`}
            className="flex items-baseline gap-3 px-3.5 py-2"
            data-testid="briefing-schedule-stop"
          >
            <span
              className={`w-[46px] shrink-0 tabular-nums text-sm font-bold ${
                stop.time ? 'text-[var(--tr-accent-deep)]' : 'text-[var(--tr-ink-3)]'
              }`}
            >
              {stop.time ?? '·'}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--tr-ink)]">
              {stop.title}
            </span>
          </li>
        ))}
      </ol>

      <p className="tr-meta border-t border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3.5 py-2 leading-relaxed text-[var(--tr-ink-2)]">
        {copy.footnote}
      </p>
    </div>
  );
}
