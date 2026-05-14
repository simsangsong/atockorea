'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface DestinationCardData {
  city: string;
  label: string;
  description: string;
  imageUrl: string;
  tourCount: number;
  href: string;
  accentFrom: string;
  accentTo: string;
}

const DESTINATIONS: DestinationCardData[] = [
  {
    city: 'Jeju',
    label: 'Jeju Island',
    description: 'Volcanic peaks, UNESCO craters & turquoise coasts',
    imageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=800&q=80',
    tourCount: 0,
    href: '/tours/list?destination=Jeju',
    accentFrom: 'from-teal-900/80',
    accentTo: 'to-teal-600/20',
  },
  {
    city: 'Busan',
    label: 'Busan',
    description: 'Port city with ancient temples, beaches & street food',
    imageUrl: 'https://images.unsplash.com/photo-1538669715315-155098f0fb1d?w=800&q=80',
    tourCount: 0,
    href: '/tours/list?destination=Busan',
    accentFrom: 'from-blue-950/80',
    accentTo: 'to-blue-600/20',
  },
  {
    city: 'Seoul',
    label: 'Seoul & Day Trips',
    description: 'Palaces, hanok villages & scenic countryside escapes',
    imageUrl: 'https://images.unsplash.com/photo-1538669715315-155098f0fb1d?w=800&q=80',
    tourCount: 0,
    href: '/tours/list?destination=Seoul',
    accentFrom: 'from-indigo-950/80',
    accentTo: 'to-indigo-600/20',
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
    <section className="w-full px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[18px] font-bold tracking-[-0.03em] text-slate-900 sm:text-[20px]">
          📍 Explore by Destination
        </h2>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          Choose your city and find the perfect tour
        </p>
      </div>

      {/* Grid: 1 col mobile → 3 col desktop */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {destinations.map((dest, idx) => (
          <motion.div
            key={dest.city}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4, scale: 1.01 }}
          >
            <Link
              href={dest.href}
              className="group relative block h-[180px] overflow-hidden rounded-2xl sm:h-[220px]"
            >
              {/* Background image */}
              <Image
                src={dest.imageUrl}
                alt={dest.label}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />

              {/* Gradient overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${dest.accentFrom} ${dest.accentTo} via-transparent`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
                {dest.tourCount > 0 && (
                  <span className="mb-1.5 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
                    {dest.tourCount} {dest.tourCount === 1 ? 'tour' : 'tours'}
                  </span>
                )}
                <h3 className="text-[20px] font-bold tracking-[-0.03em] text-white sm:text-[22px]">
                  {dest.label}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/80">
                  {dest.description}
                </p>

                {/* CTA */}
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-white/90 transition-all duration-200 group-hover:gap-2">
                  <span>Explore tours</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
