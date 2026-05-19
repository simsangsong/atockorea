'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

/**
 * Hub hero treated as a magazine cover, not a marketplace banner.
 *
 * Composition language (mirrors home v2 + TourCollectionStrip):
 *  • Masthead top-left (issue · season)
 *  • Section index ribbon top-right (the catalogue's table of contents)
 *  • Bottom-anchored eyebrow → display H1 (italic-serif accent) → sub → curator
 *  • Warm amber accent for type, mirroring home v2's signature amber-700/200
 *  • Bottom fade dissolves into the page's warm ivory bg — no hard edge
 *  • Slow Ken Burns on the photo (12s), zero parallax to keep first paint calm
 */

const SECTION_INDEX = [
  'Jeju',
  'Busan',
  'Seoul',
  'Cruise',
  'Heritage',
  'In-season',
];

export function ToursHubHero() {
  return (
    <section className="relative h-[560px] w-full overflow-hidden sm:h-[640px] lg:h-[720px]">
      {/* Hero photograph — full-bleed, slow Ken Burns drift */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1.12 }}
        transition={{ duration: 16, ease: 'linear' }}
      >
        <Image
          src="https://images.unsplash.com/photo-1777647978830-1b07f6aed022?w=1920&q=85&fm=jpg&fit=crop"
          alt="Korea Tours — Seongsan Ilchulbong, Jeju"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>

      {/* Layered atmosphere — two gradients stacked to give depth without flattening into black */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/25 to-slate-950/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_20%,transparent_35%,rgba(15,23,42,0.55)_100%)]" />
      {/* Warm amber wash on the bottom-left — picks up the page's amber language */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_95%,rgba(217,119,6,0.18)_0%,transparent_45%)]" />

      {/* Masthead — top-left */}
      <motion.div
        className="absolute left-4 top-6 z-10 flex items-center gap-3 sm:left-6 sm:top-8 lg:left-8 lg:top-10"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span
          className="h-px w-10 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"
          aria-hidden
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/95">
          Issue 14 · Spring 2026
        </span>
      </motion.div>

      {/* Section index ribbon — top-right, desktop only (magazine TOC ribbon) */}
      <motion.div
        className="absolute right-8 top-10 z-10 hidden items-center gap-2 lg:flex"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {SECTION_INDEX.map((item, i) => (
          <React.Fragment key={item}>
            {i > 0 && (
              <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
            )}
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/65">
              {item}
            </span>
          </React.Fragment>
        ))}
      </motion.div>

      {/* Main composition — bottom-anchored */}
      <div className="relative flex h-full flex-col justify-end px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="max-w-[820px]">
          {/* Eyebrow row */}
          <motion.div
            className="mb-4 flex items-center gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="h-px w-12 shrink-0 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"
              aria-hidden
            />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-amber-200">
              Korea · A Curated Field Guide
            </span>
          </motion.div>

          {/* Display headline — sans for "Korea," + italic serif for the accent */}
          <motion.h1
            className="font-bold leading-[1.04] tracking-[-0.03em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.35)] text-[40px] sm:text-[56px] lg:text-[72px]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            Korea,{' '}
            <span className="font-serif italic font-medium text-amber-200">
              hand-picked.
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            className="mt-5 max-w-[560px] text-[14.5px] leading-[1.65] text-white/85 sm:text-[16px] sm:leading-[1.6]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.32 }}
          >
            The same operators travelers find on the world&rsquo;s largest platforms — chosen
            by our Korea team, first. Day tours across Jeju, Busan &amp; Seoul, reviewed
            by humans we know by name.
          </motion.p>

          {/* Curator signature */}
          <motion.p
            className="mt-4 flex items-center gap-2 text-[11.5px] italic text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.42 }}
          >
            <span className="inline-block h-px w-6 bg-white/40" aria-hidden />
            Edited from Seoul, since 2014
          </motion.p>

          {/* CTA row — primary + secondary in language of the rest of the page */}
          <motion.div
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href="/tours/list"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[13px] font-bold text-slate-900 shadow-[0_14px_38px_-14px_rgba(0,0,0,0.55)] transition-all duration-200 hover:gap-3 hover:bg-amber-50 hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.6)]"
            >
              Browse the catalogue
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <Link
              href="/itinerary-builder"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/90 underline-offset-[6px] transition-colors hover:text-amber-200 hover:underline"
            >
              Or build a private day
              <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade — dissolves into the page's warm ivory bg, no hard edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#faf9f7] via-[#faf9f7]/85 to-transparent" />
    </section>
  );
}
