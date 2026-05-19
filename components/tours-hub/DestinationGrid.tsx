'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Destination grid — magazine spread, not category tiles.
 *
 * Each city carries the same signature color as its TourCollectionStrip
 * (Jeju → volcano teal · Busan → harbor indigo · Seoul → palace fuchsia),
 * so a traveler scanning the page sees one continuous city identity, not
 * three unrelated chrome buttons.
 *
 * Card composition mirrors the strip cards: 4:5 photo crop, accent hairline,
 * uppercase tagline eyebrow, large city name, description, walk-in CTA.
 * Ken Burns hover (900ms) replaces the old scale-110 jump.
 */

type CityAccent = 'volcano' | 'harbor' | 'palace';

interface DestinationCardData {
  city: 'Jeju' | 'Busan' | 'Seoul';
  label: string;
  /** Short uppercase tagline shown as an eyebrow on the card. */
  tagline: string;
  description: string;
  imageUrl: string;
  href: string;
  accent: CityAccent;
}

const CITY_ACCENT: Record<
  CityAccent,
  {
    eyebrow: string;
    line: string;
    dot: string;
    ringHover: string;
    glow: string;
  }
> = {
  volcano: {
    eyebrow: 'text-teal-200',
    line: 'bg-gradient-to-r from-teal-400 via-teal-300 to-teal-500',
    dot: 'bg-teal-400',
    ringHover: 'group-hover:ring-teal-200/40',
    glow: 'group-hover:shadow-[0_30px_60px_-22px_rgba(13,148,136,0.45)]',
  },
  harbor: {
    eyebrow: 'text-indigo-200',
    line: 'bg-gradient-to-r from-indigo-400 via-indigo-300 to-indigo-500',
    dot: 'bg-indigo-400',
    ringHover: 'group-hover:ring-indigo-200/40',
    glow: 'group-hover:shadow-[0_30px_60px_-22px_rgba(79,70,229,0.45)]',
  },
  palace: {
    eyebrow: 'text-fuchsia-200',
    line: 'bg-gradient-to-r from-fuchsia-400 via-fuchsia-300 to-fuchsia-500',
    dot: 'bg-fuchsia-400',
    ringHover: 'group-hover:ring-fuchsia-200/40',
    glow: 'group-hover:shadow-[0_30px_60px_-22px_rgba(192,38,211,0.45)]',
  },
};

const DESTINATIONS: DestinationCardData[] = [
  {
    city: 'Jeju',
    label: 'Jeju Island',
    tagline: 'Volcanic coast · UNESCO',
    description:
      'Volcanic peaks, UNESCO craters and turquoise coast — Korea’s slowest, most cinematic island.',
    imageUrl:
      'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=900&q=85&fm=jpg&fit=crop',
    href: '/tours/list?destination=Jeju',
    accent: 'volcano',
  },
  {
    city: 'Busan',
    label: 'Busan',
    tagline: 'Harbor · Hillside villages',
    description:
      'Port city of temples, beaches and hillside villages — forty minutes from sea to ridge.',
    imageUrl:
      'https://images.unsplash.com/photo-1538669715315-155098f0fb1d?w=900&q=85&fm=jpg&fit=crop',
    href: '/tours/list?destination=Busan',
    accent: 'harbor',
  },
  {
    city: 'Seoul',
    label: 'Seoul & Day Trips',
    tagline: 'Palaces · Day trips',
    description:
      'Palaces, hanok villages and scenic countryside escapes folded into a single capital day.',
    // TODO: Seoul photo placeholder — replace with a Gyeongbokgung / Bukchon
    // 16:9 OTA-bright image when self-curated photo set lands.
    imageUrl:
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=900&q=85&fm=jpg&fit=crop',
    href: '/tours/list?destination=Seoul',
    accent: 'palace',
  },
];

interface DestinationGridProps {
  counts: { jeju: number; busan: number; seoul: number };
}

export function DestinationGrid({ counts }: DestinationGridProps) {
  const destinations = DESTINATIONS.map((d) => ({
    ...d,
    tourCount:
      d.city === 'Jeju'
        ? counts.jeju
        : d.city === 'Busan'
          ? counts.busan
          : counts.seoul,
  }));

  return (
    <section className="w-full">
      {/* Magazine-spread header — matches TourCollectionStrip language */}
      <div className="mb-6 px-4 sm:mb-7 sm:px-6 lg:mb-8 lg:px-8">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-3">
            <span
              className="h-px w-10 shrink-0 rounded-full bg-gradient-to-r from-slate-600 via-slate-500 to-slate-700"
              aria-hidden
            />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-slate-700">
              A Pocket Atlas · Where to Begin
            </span>
          </div>

          <h2 className="text-[24px] font-bold leading-[1.1] tracking-[-0.025em] text-slate-900 sm:text-[28px] lg:text-[32px]">
            Three cities,{' '}
            <span className="font-serif italic font-medium text-slate-700">
              three distinct days.
            </span>
          </h2>

          <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.6] text-slate-600 sm:text-[14.5px]">
            Each city carries its own pace — Jeju&rsquo;s slow coast, Busan&rsquo;s harbor-and-hillside
            rhythm, Seoul&rsquo;s palaces folded between countryside afternoons. Pick a starting point;
            we&rsquo;ll match the day.
          </p>

          <p className="mt-3 flex items-center gap-2 text-[11.5px] italic text-slate-500">
            <span className="inline-block h-px w-6 bg-slate-300" aria-hidden />
            Mapped by our Korea desk
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 px-4 sm:gap-5 sm:px-6 sm:grid-cols-3 lg:px-8">
        {destinations.map((dest, idx) => {
          const a = CITY_ACCENT[dest.accent];
          return (
            <motion.div
              key={dest.city}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
            >
              <Link
                href={dest.href}
                className={cn(
                  'group relative block overflow-hidden rounded-2xl ring-1 ring-slate-200/40',
                  'shadow-[0_12px_36px_-16px_rgba(15,23,42,0.28)]',
                  'transition-[box-shadow,ring-color] duration-300',
                  'hover:ring-2',
                  a.ringHover,
                  a.glow,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2',
                )}
              >
                {/* Photo — 4:5 magazine crop with slow Ken Burns on hover */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={dest.imageUrl}
                    alt={dest.label}
                    fill
                    sizes="(min-width: 1024px) 460px, (min-width: 640px) 33vw, 100vw"
                    className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
                  />

                  {/* Stacked atmosphere — bottom-heavy gradient for caption legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                  {/* Tour count chip — top-left, glass */}
                  {dest.tourCount > 0 && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                      <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} aria-hidden />
                      {dest.tourCount} curated {dest.tourCount === 1 ? 'tour' : 'tours'}
                    </span>
                  )}

                  {/* Bottom content overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    {/* Eyebrow hairline + tagline */}
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <span
                        className={cn('h-px w-9 shrink-0 rounded-full', a.line)}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'text-[9.5px] font-bold uppercase tracking-[0.22em]',
                          a.eyebrow,
                        )}
                      >
                        {dest.tagline}
                      </span>
                    </div>

                    {/* City name — display weight */}
                    <h3 className="text-[24px] font-bold leading-[1.06] tracking-[-0.03em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] sm:text-[28px]">
                      {dest.label}
                    </h3>

                    {/* Description */}
                    <p className="mt-2 line-clamp-2 max-w-[34ch] text-[12.5px] leading-snug text-white/82 sm:text-[13px]">
                      {dest.description}
                    </p>

                    {/* CTA — magazine TOC-style anchor */}
                    <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 group-hover:gap-2.5">
                      <span>Open the city</span>
                      <span
                        aria-hidden
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
