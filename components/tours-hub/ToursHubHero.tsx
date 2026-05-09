'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const DESTINATION_CHIPS = [
  { label: 'Jeju Island', href: '/tours/list?destinations=Jeju', emoji: '🌋' },
  { label: 'Busan', href: '/tours/list?destinations=Busan', emoji: '⚓' },
  { label: 'Seoul & Day Trips', href: '/tours/list?destinations=Seoul', emoji: '🏯' },
];

const TRUST_BADGES = [
  { icon: '✓', label: 'Licensed agencies' },
  { icon: '✓', label: 'Small groups' },
  { icon: '✓', label: 'English guides' },
];

export function ToursHubHero() {
  return (
    <section className="relative h-[420px] w-full overflow-hidden sm:h-[480px] lg:h-[520px]">
      {/* Background image */}
      <Image
        src="https://images.unsplash.com/photo-1777647978830-1b07f6aed022?w=1920&q=85&fm=jpg&fit=crop"
        alt="Korea Tours — Seongsan Ilchulbong, Jeju"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Dark overlay — gradient top-to-bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/60 to-slate-950/80" />
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />

      {/* Content */}
      <div className="relative flex h-full flex-col items-center justify-center px-4 text-center sm:px-6">
        {/* Pre-headline chip */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
            🇰🇷 Korea Travel Specialists
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="max-w-2xl text-[30px] font-extrabold leading-[1.12] tracking-[-0.04em] text-white drop-shadow-sm sm:text-[38px] lg:text-[44px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          Discover Korea with
          <br />
          <span className="bg-gradient-to-r from-sky-300 to-teal-300 bg-clip-text text-transparent">
            Local Experts
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="mt-3 max-w-md text-[13.5px] leading-relaxed text-white/75 sm:text-[14.5px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.5 }}
        >
          Curated small-group day tours in Jeju, Busan & Seoul — run by licensed
          Korean travel agencies with English-speaking guides.
        </motion.p>

        {/* Trust badges */}
        <motion.div
          className="mt-4 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32, duration: 0.5 }}
        >
          {TRUST_BADGES.map((b) => (
            <span
              key={b.label}
              className="flex items-center gap-1 text-[11px] font-medium text-white/70"
            >
              <span className="text-teal-400">{b.icon}</span>
              {b.label}
            </span>
          ))}
        </motion.div>

        {/* Destination chips */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {DESTINATION_CHIPS.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-[12.5px] font-semibold text-white backdrop-blur-md transition-all duration-200 hover:border-white/45 hover:bg-white/22 hover:shadow-lg"
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </Link>
          ))}

          {/* Browse all */}
          <Link
            href="/tours/list"
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-slate-900 shadow-lg transition-all duration-200 hover:bg-slate-50 hover:shadow-xl"
          >
            Browse all tours →
          </Link>
        </motion.div>
      </div>

      {/* Bottom fade into page bg */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-50 to-transparent" />
    </section>
  );
}
