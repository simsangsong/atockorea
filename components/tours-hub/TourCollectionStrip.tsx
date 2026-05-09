'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { HubTourItem } from '@/app/api/tours/hub/route';
import { cn } from '@/lib/utils';

interface TourCollectionStripProps {
  title: string;
  subtitle?: string;
  icon?: string;
  tours: HubTourItem[];
  seeAllHref?: string;
  seeAllLabel?: string;
  accentColor?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
}

const ACCENT = {
  blue: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    hover: 'group-hover:text-blue-700',
    seeAll: 'text-blue-600 hover:text-blue-700',
    line: 'bg-blue-500',
  },
  emerald: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hover: 'group-hover:text-emerald-700',
    seeAll: 'text-emerald-600 hover:text-emerald-700',
    line: 'bg-emerald-500',
  },
  violet: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    hover: 'group-hover:text-violet-700',
    seeAll: 'text-violet-600 hover:text-violet-700',
    line: 'bg-violet-500',
  },
  amber: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    hover: 'group-hover:text-amber-700',
    seeAll: 'text-amber-600 hover:text-amber-700',
    line: 'bg-amber-500',
  },
  rose: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    hover: 'group-hover:text-rose-700',
    seeAll: 'text-rose-600 hover:text-rose-700',
    line: 'bg-rose-500',
  },
} as const;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80';

function HubTourCard({ tour, accentColor }: { tour: HubTourItem; accentColor: keyof typeof ACCENT }) {
  const accent = ACCENT[accentColor];
  const detailHref = tour.slug ? `/tour-product/${tour.slug}` : `/tour/${tour.id}`;
  const hasRating = tour.rating >= 4.0 && tour.reviewCount > 0;
  const hasPrice = tour.price > 0;
  const mainBadge = tour.badges[0];

  return (
    <motion.div
      className="w-[260px] shrink-0 sm:w-[280px]"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <Link
        href={detailHref}
        className={cn(
          'group block overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_28px_-12px_rgba(15,23,42,0.22),0_2px_8px_-4px_rgba(15,23,42,0.10)]',
          'transition-[box-shadow,border-color] duration-300',
          'hover:border-blue-200/70 hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.32),0_8px_20px_-8px_rgba(59,130,246,0.18)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2',
        )}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <Image
            src={tour.imageUrl ?? FALLBACK_IMAGE}
            alt={tour.title}
            fill
            sizes="280px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          {/* Badge top-left */}
          {mainBadge && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              {mainBadge}
            </span>
          )}
          {/* Rating overlay bottom */}
          {hasRating && (
            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              <svg className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.034 3.182a1 1 0 0 0 .95.69h3.347c.969 0 1.371 1.24.588 1.81l-2.708 1.967a1 1 0 0 0-.364 1.118l1.034 3.182c.3.922-.755 1.688-1.538 1.118l-2.708-1.967a1 1 0 0 0-1.176 0l-2.708 1.967c-.783.57-1.838-.196-1.539-1.118l1.035-3.182a1 1 0 0 0-.364-1.118L2.18 8.609c-.783-.57-.38-1.81.588-1.81h3.347a1 1 0 0 0 .951-.69l1.034-3.182Z" />
              </svg>
              {tour.rating.toFixed(1)}
              <span className="font-normal opacity-80">({tour.reviewCount.toLocaleString()})</span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-3.5">
          {/* Location */}
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500">
            <svg className="h-3 w-3 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 2.5a5.5 5.5 0 0 0-5.5 5.5c0 3.744 4.34 8.313 5.054 9.034a.625.625 0 0 0 .892 0C11.16 16.313 15.5 11.744 15.5 8A5.5 5.5 0 0 0 10 2.5Zm0 7.188A1.688 1.688 0 1 1 10 6.31a1.688 1.688 0 0 1 0 3.377Z" clipRule="evenodd" />
            </svg>
            {tour.city}
            {tour.duration && (
              <span className="ml-auto flex items-center gap-0.5 text-slate-400">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.625-11.75a.625.625 0 1 0-1.25 0v4.009c0 .166.066.325.183.442l2.5 2.5a.625.625 0 1 0 .884-.884l-2.317-2.317V6.25Z" clipRule="evenodd" />
                </svg>
                {tour.duration}
              </span>
            )}
          </p>

          {/* Title */}
          <h3
            className={cn(
              'line-clamp-2 min-h-[2.6em] text-[12.5px] font-semibold leading-[1.38] tracking-[-0.02em] text-slate-900',
              'transition-colors duration-200',
              accent.hover,
            )}
          >
            {tour.title}
          </h3>

          {/* Price */}
          <p className="mt-2.5 text-[13.5px] font-bold tracking-[-0.03em] text-slate-950">
            {hasPrice ? `$${tour.price.toFixed(2)}` : (
              <span className="text-[11px] font-medium text-slate-400 tracking-normal">Contact for price</span>
            )}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export function TourCollectionStrip({
  title,
  subtitle,
  icon,
  tours,
  seeAllHref,
  seeAllLabel = 'See all',
  accentColor = 'blue',
}: TourCollectionStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const accent = ACCENT[accentColor];

  if (tours.length === 0) return null;

  return (
    <section className="w-full">
      {/* Section Header */}
      <div className="mb-5 flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 text-2xl leading-none" aria-hidden>
              {icon}
            </span>
          )}
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.03em] text-slate-900 sm:text-[20px]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12.5px] text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className={cn(
              'shrink-0 text-[12.5px] font-semibold underline-offset-2 hover:underline',
              accent.seeAll,
            )}
          >
            {seeAllLabel} →
          </Link>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-4 sm:gap-4 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {tours.map((tour) => (
          <div key={tour.id} className="snap-start">
            <HubTourCard tour={tour} accentColor={accentColor} />
          </div>
        ))}

        {/* "See all" tail card */}
        {seeAllHref && tours.length >= 4 && (
          <div className="flex w-[120px] shrink-0 snap-start items-center justify-center">
            <Link
              href={seeAllHref}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-slate-300 hover:bg-slate-50',
                'h-full w-full justify-center',
              )}
            >
              <span className="text-2xl">→</span>
              <span className={cn('text-[11px] font-semibold', accent.seeAll)}>
                {seeAllLabel}
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
