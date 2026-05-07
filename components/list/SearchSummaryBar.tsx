'use client';

import React from 'react';
import Link from 'next/link';
import { useCopy } from '@/lib/i18n';

export interface SearchSummaryBarProps {
  /** Number of tours found */
  count: number;
  /** e.g. "Jeju" or null for "All" */
  destination?: string | null;
  /** Optional keyword/search query */
  keyword?: string | null;
  /** Optional: link to refine/edit search (e.g. /search). */
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
  const copy = useCopy();
  const countStr = copy.listDetail.summaryToursFound.replace('{{count}}', String(count));
  const pillClass =
    'inline-flex items-center rounded-full border border-slate-200/80 bg-white/88 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-[0_8px_22px_-18px_rgba(15,23,42,0.32)]';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(248,250,252,0.7)_100%)] px-3 py-2.5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.34)] backdrop-blur-md">
      <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
        {countStr}
      </span>
      <span className={pillClass}>
        {copy.listDetail.destination}: {destination ?? copy.listDetail.destinationAll}
      </span>
      {hotelArea != null && hotelArea !== '' && (
        <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/92 px-3 py-1.5 text-[11px] font-medium text-sky-700">
          {copy.listDetail.hotelArea}: {hotelArea}
        </span>
      )}
      {keyword != null && keyword !== '' && (
        <span className={pillClass}>
          Keyword: <strong>{keyword}</strong>
        </span>
      )}
      {date != null && date !== '' && (
        <span className={pillClass}>
          {copy.listDetail.date}: {date}
        </span>
      )}
      {guests != null && guests > 0 && (
        <span className={pillClass}>
          {copy.listDetail.guests}: {guests}
        </span>
      )}
      {refineHref && (
        <Link
          href={refineHref}
          className="inline-flex items-center rounded-full border border-slate-200/85 bg-slate-50/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300/90 hover:bg-white"
        >
          {copy.listDetail.refine}
        </Link>
      )}
    </div>
  );
}
