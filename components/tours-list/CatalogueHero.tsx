'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useTranslations } from '@/lib/i18n';

/**
 * Catalogue magazine cover — the entry impression for `/tours/list`.
 *
 * Composition mirrors the hub `/tours` hero (ToursHubHero) but scaled down to
 * a directory-index format:
 *  • Sticky at top, 240px desktop / 200px mobile expanded
 *  • Collapses to 88px as the reader scrolls past 200px (masthead + count survive)
 *  • Ken Burns 16s drift on the photo (matches hub hero cadence)
 *  • Bottom-anchored display headline — sans bold for "The Catalogue," + upright
 *    light serif accent ("every tour, hand-picked.") — italic banned per user
 *    direction 2026-05-20 (§B reversal); upright premium reads Kinfolk/Vogue-cover.
 *  • Warm amber wash bottom-left mirrors the family color promise (§9)
 *  • Hero photo: locally hosted (`public/images/tours-list/catalogue-hero.png`)
 *    — Hallasan framed by hydrangea + wisteria, user-supplied 2026-05-20.
 *
 * Anti-downgrade guards honored:
 *  • B1 — ivory (#faf8f3) page base color + amber accents only (no slate-only)
 *  • B3 — 240→88 collapse (NOT 0px hero)
 *  • B11 — single backdrop-blur layer ceiling (rail provides the only blur); no
 *    stacked blur, no video bg, no new libraries
 *  • B12 — framer-motion useScroll/useTransform (built-in), no carousel libs
 *  • B14 — all copy via 6-locale i18n keys (Phase 0.4 added)
 *  • §9 italic family promise REVERSED 2026-05-20 — upright serif now the rule
 */

const COLLAPSED_HEIGHT = 88;
const EXPANDED_DESKTOP = 240;
const EXPANDED_MOBILE = 200;
const COLLAPSE_SCROLL_RANGE = 200;

const HERO_PHOTO_SRC = '/images/tours-list/catalogue-hero.png';

interface CatalogueHeroProps {
  /** Total tour count — drives the sub line and 88px-mode badge. */
  count: number;
}

export function CatalogueHero({ count }: CatalogueHeroProps) {
  const t = useTranslations();
  const reducedMotion = useReducedMotion() === true;

  // Track viewport so mobile gets the 200px expanded baseline (plan §6.1 1.1).
  const [expandedHeight, setExpandedHeight] = useState(EXPANDED_DESKTOP);
  useEffect(() => {
    const apply = () => {
      setExpandedHeight(window.innerWidth < 640 ? EXPANDED_MOBILE : EXPANDED_DESKTOP);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const { scrollY } = useScroll();
  const height = useTransform(scrollY, [0, COLLAPSE_SCROLL_RANGE], [expandedHeight, COLLAPSED_HEIGHT]);
  // Display block fades out over the first half of the collapse window so the
  // masthead has visual room when the hero reaches its 88px end state.
  const displayOpacity = useTransform(scrollY, [0, COLLAPSE_SCROLL_RANGE * 0.5], [1, 0]);
  // Count badge fades IN as the display fades out — directly readable in 88px mode.
  const countBadgeOpacity = useTransform(
    scrollY,
    [COLLAPSE_SCROLL_RANGE * 0.4, COLLAPSE_SCROLL_RANGE * 0.85],
    [0, 1],
  );

  const heroIssue = t('toursList.heroIssue');
  const heroTitle = t('toursList.heroTitle');
  const heroAccent = t('toursList.heroAccent');
  const heroSub = t('toursList.heroSub', { count });
  const heroCurator = t('toursList.heroCurator');

  return (
    // Not sticky — the parent header in `app/tours/list/page.tsx` is the sticky
    // anchor so hero + filter rail share one sticky context (avoids overlap
    // during the collapse window). The hero's height transform still drives
    // the visual reflow.
    <motion.header
      className="relative isolate w-full overflow-hidden bg-[#0f172a] [padding-top:env(safe-area-inset-top)]"
      // reduce-motion: lock to expanded baseline (CSS height number, no scroll transform).
      style={reducedMotion ? { height: expandedHeight } : { height }}
    >
      {/* Hero photograph — full-bleed, slow Ken Burns drift. */}
      <motion.div
        className="absolute inset-0"
        initial={reducedMotion ? false : { scale: 1.05 }}
        animate={reducedMotion ? undefined : { scale: 1.12 }}
        transition={reducedMotion ? undefined : { duration: 16, ease: 'linear' }}
      >
        <Image
          src={HERO_PHOTO_SRC}
          alt="Korea tour catalogue cover — Hallasan framed by hydrangea and wisteria blooms"
          fill
          priority
          sizes="100vw"
          quality={88}
          className="object-cover object-center"
        />
      </motion.div>

      {/* Layered atmosphere — matches hub hero pattern (dark + radial + amber wash). */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/30 to-slate-950/75"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_20%,transparent_45%,rgba(15,23,42,0.55)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_95%,rgba(217,119,6,0.20)_0%,transparent_50%)]"
        aria-hidden
      />

      {/* Masthead — top-left, always visible (survives the 88px collapse). */}
      <div className="absolute left-4 top-3 z-10 flex items-center gap-3 sm:left-6 sm:top-4 lg:left-8">
        <span
          className="h-px w-10 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"
          aria-hidden
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/95">
          {heroIssue}
        </span>
      </div>

      {/* Tour count badge — top-right. Fades in as display block fades out so 88px
          collapsed state still carries a readable signal (count + masthead).
          reduce-motion: hide the badge (display block stays fully visible at base height). */}
      <motion.div
        className="absolute right-4 top-3 z-10 sm:right-6 sm:top-4 lg:right-8"
        style={reducedMotion ? { opacity: 0 } : { opacity: countBadgeOpacity }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-900/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100 backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-amber-300" aria-hidden />
          {count} tours
        </span>
      </motion.div>

      {/* Display block — sans-bold heroTitle + upright light-serif accent
          + sub + curator. Fades out during the collapse so the 88px state
          is clean. (italic banned 2026-05-20.) */}
      <motion.div
        className="relative z-10 flex h-full flex-col justify-end px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10"
        style={reducedMotion ? undefined : { opacity: displayOpacity }}
      >
        <div className="max-w-[820px]">
          <h1 className="font-bold leading-[1.04] tracking-[-0.03em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.4)] text-[26px] sm:text-[34px] lg:text-[40px]">
            {heroTitle}{' '}
            {/* Upright serif accent (italic banned per user direction 2026-05-20).
                Light serif weight + tight tracking reads premium without italic flair. */}
            <span className="font-serif font-light tracking-[-0.005em] text-amber-100">
              {heroAccent}
            </span>
          </h1>

          <p className="mt-2 max-w-[620px] text-[12.5px] leading-[1.55] text-white/85 sm:mt-2.5 sm:text-[13.5px]">
            {heroSub}
          </p>

          <p className="mt-2 flex items-center gap-2 font-serif text-[10.5px] font-normal tracking-[0.02em] text-white/75 sm:mt-3 sm:text-[11.5px]">
            <span className="inline-block h-px w-6 bg-white/40" aria-hidden />
            {heroCurator}
          </p>
        </div>
      </motion.div>

      {/* Bottom fade — dissolves into the page's ivory bg, no hard edge.
          Mirrors hub hero's bottom dissolve. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#faf8f3] via-[#faf8f3]/70 to-transparent"
        aria-hidden
      />
    </motion.header>
  );
}
