'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ACCENT, mapContextToAccent } from '@/lib/tours-hub-accents';

/**
 * Contextual vignette band — shown when /tours/list is narrowed to a strong
 * context (a destination or a feature). The base page stays site-native
 * (white + slate); this band carries the magazine identity of the shelves
 * view (Phase 7) into the filter view so the catalogue does not flip to a
 * visibly older Phase 4 typography when one filter is applied
 * (user report 2026-05-25 — "옛날 페이지 양식이 나올뿐더러 섹션들이 이상해져").
 *
 * Header structure mirrors `TourShelf`:
 *   - amber hairline + uppercase eyebrow ("Curated · Busan")
 *   - magazine-serif-ko display headline (the context name itself)
 *   - subtitle in stone-500
 *   - "View all tours" reset link
 *
 * The 7-accent token (Jeju→volcano, Busan→harbor, …) still colours the
 * eyebrow + reset link so the destination promise (B6) is preserved.
 */
interface ContextualVignetteBandProps {
  /** Active destination value ("all" = none). */
  destination: string;
  /** Active features CSV ("" = none). */
  features: string;
  /** Localized context label to display (city / feature name). */
  contextLabel: string;
  /** "Curated for {context}" localized line. */
  line: string;
  /** Reset link label. */
  resetLabel: string;
  onReset: () => void;
  /** Optional eyebrow prefix. Default: "Curated" (English) — caller can pass a localized string. */
  eyebrowPrefix?: string;
}

export function ContextualVignetteBand({
  destination,
  features,
  contextLabel,
  line,
  resetLabel,
  onReset,
  eyebrowPrefix = 'Curated',
}: ContextualVignetteBandProps) {
  const hasContext = destination !== 'all' || features.trim() !== '';
  if (!hasContext) return null;

  const accent = mapContextToAccent({ destination, features });
  const tokens = ACCENT[accent];

  return (
    <section className="mx-auto w-full max-w-5xl px-3 pt-6 sm:px-4 sm:pt-8">
      <header className="px-1 sm:px-2">
        {/* Eyebrow row: hairline + uppercase label (matches TourShelf typography). */}
        <div className="flex items-center gap-3">
          <span aria-hidden className={cn('block h-px w-8 sm:w-10', tokens.line)} />
          <p
            className={cn(
              'text-[10.5px] font-bold uppercase tracking-[0.26em]',
              tokens.eyebrow,
            )}
          >
            <span className="opacity-80">{eyebrowPrefix}</span>
            <span aria-hidden className="px-2 opacity-40">·</span>
            <span>{contextLabel}</span>
          </p>
        </div>
        {/* Display headline — serif, large, breathing room (matches shelf h2). */}
        <h2
          className={cn(
            'mt-4 font-magazine-serif-ko font-semibold leading-[1.12] text-stone-900',
            'text-[26px] tracking-[-0.018em] sm:mt-5 sm:text-[30px] sm:tracking-[-0.02em] lg:text-[34px]',
          )}
        >
          {contextLabel}
        </h2>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 sm:mt-4">
          <p className="max-w-2xl text-[13.5px] leading-[1.7] text-stone-500 sm:text-[14.5px]">
            {line}
          </p>
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'shrink-0 text-[12.5px] font-semibold underline-offset-4 hover:underline',
              tokens.seeAll,
            )}
          >
            {resetLabel}
          </button>
        </div>
      </header>
    </section>
  );
}
