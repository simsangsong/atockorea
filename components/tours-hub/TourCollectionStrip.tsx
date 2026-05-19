'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { HubTourItem } from '@/app/api/tours/hub/route';
import { cn } from '@/lib/utils';
import { ACCENT, type StripAccent } from '@/lib/tours-hub-accents';

// `StripAccent` + `ACCENT` were extracted to `lib/tours-hub-accents.ts` in
// Phase 0.1 of the `/tours/list` UI/UX upgrade so the catalogue page's
// `ContextualVignetteBand` (Phase 3) shares the same palette. Re-exported here
// to keep existing imports (`@/components/tours-hub/TourCollectionStrip`)
// working without touching call sites.
export { type StripAccent } from '@/lib/tours-hub-accents';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80';

interface TourCollectionStripProps {
  /** Small uppercase identifier above the headline — e.g. "BY ISLAND · JEJU". */
  eyebrow: string;
  title: string;
  /** Optional italic-serif accent continuation, rendered in the strip's signature color. */
  titleAccent?: string;
  /** 2–3 sentence editorial note from the Korea team — why this collection exists. */
  editorNote?: string;
  /** Italic signature line below the editor's note, e.g. "— Curated by Min · Lead Jeju editor". */
  curator?: string;
  tours: HubTourItem[];
  seeAllHref?: string;
  seeAllLabel?: string;
  accent?: StripAccent;
}

function HubTourCard({ tour, accent }: { tour: HubTourItem; accent: StripAccent }) {
  const a = ACCENT[accent];
  const detailHref = tour.slug ? `/tour-product/${tour.slug}` : `/tour/${tour.id}`;
  const hasRating = tour.rating >= 4.0 && tour.reviewCount > 0;
  const hasPrice = tour.price > 0;
  const mainBadge = tour.badges[0];

  return (
    <motion.div
      className="w-[280px] shrink-0 sm:w-[300px]"
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <Link
        href={detailHref}
        className={cn(
          'group relative block overflow-hidden rounded-2xl border border-white/85 bg-white',
          'shadow-[0_12px_36px_-16px_rgba(15,23,42,0.24),0_2px_8px_-4px_rgba(15,23,42,0.10)]',
          'ring-1 ring-slate-200/40 transition-[box-shadow,border-color] duration-300',
          'hover:ring-2 hover:border-slate-200/80',
          'hover:shadow-[0_32px_64px_-22px_rgba(15,23,42,0.32),0_10px_24px_-10px_rgba(15,23,42,0.18)]',
          a.ringHover,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2',
        )}
      >
        {/* Photo — 4:5 magazine crop, taller than the old 4:3 to push photography forward */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
          <Image
            src={tour.imageUrl ?? FALLBACK_IMAGE}
            alt={tour.title}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 300px, 280px"
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
            loading="lazy"
          />

          {/* Subtle bottom gradient keeps the photo edge readable against the card body */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/30 to-transparent" />

          {/* Top-left main badge — always visible */}
          {mainBadge && (
            <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/40 bg-slate-950/55 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-md">
              {mainBadge}
            </span>
          )}

          {/* Top-right "Korea team's pick" reveal on hover — the brand promise as surprise/delight */}
          <span
            className={cn(
              'absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full',
              'border border-white/40 bg-white/95 px-2.5 py-1',
              'text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-900',
              'opacity-0 scale-90 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              'group-hover:opacity-100 group-hover:scale-100',
              'shadow-[0_4px_12px_-2px_rgba(15,23,42,0.18)]',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} aria-hidden />
            Korea team&rsquo;s pick
          </span>
        </div>

        {/* Content below photo — eyebrow · title · editorial line · price row */}
        <div className="p-4">
          {/* City + duration eyebrow */}
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <span>{tour.city}</span>
            {tour.duration && (
              <>
                <span className="text-slate-300" aria-hidden>·</span>
                <span className="font-medium tracking-[0.1em] text-slate-400">{tour.duration}</span>
              </>
            )}
          </p>

          {/* Title */}
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-[1.28] tracking-[-0.02em] text-slate-900">
            {tour.title}
          </h3>

          {/* Editorial line — rating + review count (★ 4.9 · 234 reviews) when data exists,
              otherwise fall back to the brand-voice italic so every card has a signature line. */}
          {hasRating ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-slate-600">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.034 3.182a1 1 0 0 0 .95.69h3.347c.969 0 1.371 1.24.588 1.81l-2.708 1.967a1 1 0 0 0-.364 1.118l1.034 3.182c.3.922-.755 1.688-1.538 1.118l-2.708-1.967a1 1 0 0 0-1.176 0l-2.708 1.967c-.783.57-1.838-.196-1.539-1.118l1.035-3.182a1 1 0 0 0-.364-1.118L2.18 8.609c-.783-.57-.38-1.81.588-1.81h3.347a1 1 0 0 0 .951-.69l1.034-3.182Z" />
              </svg>
              <span className="font-semibold text-slate-800">{tour.rating.toFixed(1)}</span>
              <span className="text-slate-300" aria-hidden>·</span>
              <span className="italic text-slate-500">{tour.reviewCount.toLocaleString()} reviews</span>
            </div>
          ) : (
            <p className="mt-1.5 text-[11.5px] italic text-slate-500">
              Hand-picked by our Korea team
            </p>
          )}

          {/* Price row — confident, From · $XX · / person */}
          <div className="mt-3 flex items-baseline gap-1.5">
            {hasPrice ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">From</span>
                <span className="text-[18px] font-bold tracking-[-0.03em] text-slate-950">
                  ${tour.price.toFixed(0)}
                </span>
                <span className="text-[11px] text-slate-500">/ person</span>
              </>
            ) : (
              <span className="text-[11.5px] italic text-slate-500">Contact for price</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TourCollectionStrip({
  eyebrow,
  title,
  titleAccent,
  editorNote,
  curator,
  tours,
  seeAllHref,
  seeAllLabel = 'See all',
  accent: accentKey = 'signature',
}: TourCollectionStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const a = ACCENT[accentKey];

  if (tours.length === 0) return null;

  return (
    <section className="w-full">
      {/* Magazine-spread section header — eyebrow · headline · editor's note · curator */}
      <div className="mb-6 px-4 sm:mb-7 sm:px-6 lg:mb-8 lg:px-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            {/* Eyebrow row — accent hairline + uppercase identifier */}
            <div className="mb-3 flex items-center gap-3">
              <span className={cn('h-px w-10 shrink-0 rounded-full', a.line)} aria-hidden />
              <span
                className={cn(
                  'text-[10.5px] font-bold uppercase tracking-[0.22em]',
                  a.eyebrow,
                )}
              >
                {eyebrow}
              </span>
            </div>

            {/* Headline — large display weight, slight negative tracking */}
            <h2 className="text-[24px] font-bold leading-[1.1] tracking-[-0.025em] text-slate-900 sm:text-[28px] lg:text-[32px]">
              {title}
              {titleAccent && (
                <>
                  {' '}
                  <span className={cn('font-serif italic font-medium', a.eyebrow)}>
                    {titleAccent}
                  </span>
                </>
              )}
            </h2>

            {/* Editor's note — Korea-team voice */}
            {editorNote && (
              <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.6] text-slate-600 sm:text-[14.5px]">
                {editorNote}
              </p>
            )}

            {/* Curator signature */}
            {curator && (
              <p className="mt-3 flex items-center gap-2 text-[11.5px] italic text-slate-500">
                <span className="inline-block h-px w-6 bg-slate-300" aria-hidden />
                {curator}
              </p>
            )}
          </div>

          {/* See-all link (desktop) — magazine TOC-style anchor */}
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className={cn(
                'hidden shrink-0 self-start items-center gap-1.5 pt-1 text-[12.5px] font-semibold underline-offset-4 hover:underline lg:inline-flex',
                a.seeAll,
              )}
            >
              {seeAllLabel} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:gap-5 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {tours.map((tour) => (
          <div key={tour.id} className="snap-start">
            <HubTourCard tour={tour} accent={accentKey} />
          </div>
        ))}

        {/* "See all" tail card */}
        {seeAllHref && tours.length >= 4 && (
          <div className="flex w-[140px] shrink-0 snap-start items-center justify-center">
            <Link
              href={seeAllHref}
              className={cn(
                'group flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center transition-colors',
                'hover:border-slate-400 hover:bg-slate-50/70',
              )}
            >
              <span
                className={cn('text-2xl transition-transform group-hover:translate-x-1', a.eyebrow)}
                aria-hidden
              >
                →
              </span>
              <span
                className={cn('text-[11px] font-bold uppercase tracking-[0.14em]', a.seeAll)}
              >
                {seeAllLabel}
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Mobile see-all (desktop hidden) */}
      {seeAllHref && (
        <div className="px-4 pb-2 pt-1 sm:px-6 lg:hidden">
          <Link
            href={seeAllHref}
            className={cn(
              'inline-flex items-center gap-1.5 text-[12.5px] font-semibold underline-offset-4 hover:underline',
              a.seeAll,
            )}
          >
            {seeAllLabel} <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
