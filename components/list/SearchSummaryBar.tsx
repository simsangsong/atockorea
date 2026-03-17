'use client';

import React from 'react';
import Link from 'next/link';
import { COPY } from '@/src/design/copy';

export interface SearchSummaryBarProps {
  /** Number of tours found */
  count: number;
  /** e.g. "Jeju" or null for "All" */
  destination?: string | null;
  /** Optional keyword/search query */
  keyword?: string | null;
  /** Optional: link to refine/edit search (e.g. /custom-join-tour or /search) */
  refineHref?: string | null;
  /** Optional: hotel area from builder */
  hotelArea?: string | null;
  /** Optional: date from builder */
  date?: string | null;
  /** Optional: guests from builder */
  guests?: number | null;
}

export function SearchSummaryBar({
  count,
  destination = null,
  keyword = null,
  refineHref = null,
  hotelArea = null,
  date = null,
  guests = null,
}: SearchSummaryBarProps) {
  const countStr = COPY.listDetail.summaryToursFound.replace('{{count}}', String(count));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white/80 px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] font-medium text-[#3a3a3c]">
        {countStr}
      </span>
      <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#3a3a3c]">
        {COPY.listDetail.destination}: {destination ?? COPY.listDetail.destinationAll}
      </span>
      {hotelArea != null && hotelArea !== '' && (
        <span className="rounded-full bg-[#0c66ff]/10 px-2.5 py-1 text-[11px] font-medium text-[#0c66ff]">
          {COPY.listDetail.hotelArea}: {hotelArea}
        </span>
      )}
      {keyword != null && keyword !== '' && (
        <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#6e6e73]">
          Keyword: <strong>{keyword}</strong>
        </span>
      )}
      {date != null && date !== '' && (
        <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#6e6e73]">
          {COPY.listDetail.date}: {date}
        </span>
      )}
      {guests != null && guests > 0 && (
        <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#6e6e73]">
          {COPY.listDetail.guests}: {guests}
        </span>
      )}
      {refineHref && (
        <Link
          href={refineHref}
          className="rounded-full bg-[#0c66ff]/10 px-2.5 py-1 text-[11px] font-medium text-[#0c66ff] hover:bg-[#0c66ff]/20"
        >
          {COPY.listDetail.refine}
        </Link>
      )}
    </div>
  );
}
