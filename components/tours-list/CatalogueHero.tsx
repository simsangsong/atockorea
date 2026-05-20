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

const HERO_PHOTO_SRC = '/images/tours-list/catalogue-hero.jpg';

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
          alt="Korea tour catalogue cover — hanbok dancer at Gyeongbokgung Palace"
          fill
          priority
          sizes="100vw"
          quality={88}
          // Landscape source — object-center reads the dancer + eaves in the
          // hero band. (Previous portrait crop needed object-[center_top] to
          // hide a source watermark; this landscape variant has none.)
          className="object-cover object-center"
          /* Editorial polish — identical Vogue filter as TourListCard image
             (B2 family). saturate 1.08 contrast 1.06 brightness 0.99 gives
             the photo Kodak Portra warmth without crushing highlights. */
          style={{ filter: 'saturate(1.08) contrast(1.06) brightness(0.99)' }}
        />
      </motion.div>

      {/* Card-identical film grain (Kodak Portra 400 입자감) — fractalNoise SVG
          baseFreq 0.9, octaves 2, stitchTiles + feColorMatrix 0.55, opacity 0.12
          with mix-blend-overlay. Pixel-identical to TourListCard so the hero photo
          and the cards below it read as the same image family. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.12,
        }}
      />
      {/* Card-identical soft vignette — radial corner darkening, transparent 60% → 0.15 alpha.
          Subtle enough to not crush the photo; gives editorial corner roll-off. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)',
        }}
      />
      {/* Atmosphere — very light atmospheric tint to settle the photo. */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-amber-950/5 via-transparent to-amber-950/12"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_95%,rgba(217,119,6,0.14)_0%,transparent_55%)]"
        aria-hidden
      />
      {/*
        LEFT vertical cream wash — Vogue Korea / Bazaar cover convention.
        Width is bounded responsively (mobile 96% · sm 68% · lg 540px hard cap)
        so the cream zone tracks the text container precisely — gradient stops
        are relative to wash width, so the heavy-cream portion always sits
        directly behind the constrained text below.
        User 2026-05-20 9차 진단: B26 max-w-[50%] alone leaked on wide desktops
        (text natural width fit in 50% on >1700px viewports → no wrap → bled
        onto dancer). Fix combines: hard-pixel max-w cap + forced <br /> in h1.
      */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 right-0"
        aria-hidden
        style={{
          // Natural single-layer left overlay (restored per user 2026-05-20 12차:
          // "두세 대화 전 자연스럽게 씌운 그 흰색 오버레이 복구"). This is the B26
          // version — full-width, continuous smooth fade (no hard panel edge).
          // The defined B29 panel read too boxy; this gradual wash dissolves into
          // the photo organically while still seating the small left copy on cream.
          background:
            'linear-gradient(90deg, rgba(250,248,243,0.92) 0%, rgba(250,248,243,0.72) 28%, rgba(250,248,243,0.38) 52%, rgba(250,248,243,0.12) 70%, transparent 82%)',
        }}
      />

      {/* Masthead — top-left, always visible (survives the 88px collapse). */}
      <div className="absolute left-4 top-3 z-10 flex items-center gap-3 sm:left-6 sm:top-4 lg:left-8">
        <span
          className="h-px w-10 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"
          aria-hidden
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_0_8px_rgba(255,252,240,0.55)]">
          {heroIssue}
        </span>
      </div>

      {/* Tour count badge — top-right. Fades in as display block fades out so 88px
          collapsed state still carries a readable signal (count + masthead).
          Cream-tinted pill with dark amber text (B24 dark-text family). */}
      <motion.div
        className="absolute right-4 top-3 z-10 sm:right-6 sm:top-4 lg:right-8"
        style={reducedMotion ? { opacity: 0 } : { opacity: countBadgeOpacity }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/55 bg-[#faf8f3]/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900 backdrop-blur-sm shadow-[0_2px_10px_rgba(120,90,40,0.18)]">
          <span className="h-1 w-1 rounded-full bg-amber-700" aria-hidden />
          {count} tours
        </span>
      </motion.div>

      {/* Display block — sans-bold heroTitle + upright light-serif accent
          + sub + curator. Fades out during the collapse so the 88px state
          is clean. (italic banned 2026-05-20.) */}
      <motion.div
        // "카피 조금 아래로" (2026-05-20) — pb-6/8/10 → pb-3/4/5.
        // Text anchors close to the bottom edge of the photo (Vogue-cover
        // deck feel — display sits ON the image, not above it).
        className="relative z-10 flex h-full flex-col justify-end px-4 pb-3 sm:px-6 sm:pb-4 lg:px-8 lg:pb-5"
        style={reducedMotion ? undefined : { opacity: displayOpacity }}
      >
        {/*
          Text confined INSIDE the cream panel (user 2026-05-20 11차: "카피 사이즈
          확 줄여서 그 흰색 필터 안에 넣어"). Drastically smaller refined serif sits
          fully within the near-solid cream zone — flows naturally, never reaches
          the photo. Tight max-w keeps every line inside the panel's solid portion.
        */}
        <div className="max-w-[80%] sm:max-w-[50%] lg:max-w-[360px]">
          {/* Dark warm typography (B24) + Korean magazine-serif (B25).
              B29: copy sizes cut hard so the whole block nests inside the cream
              panel — small editorial deck, not a banner. */}
          <h1 className="font-magazine-serif-ko font-bold leading-[1.3] tracking-[-0.015em] text-stone-950 [text-shadow:0_1px_2px_rgba(255,255,255,0.95),0_0_14px_rgba(255,252,240,0.6)] text-[15px] sm:text-[17px] lg:text-[20px]">
            {heroTitle}{' '}
            {/* Warm amber light serif accent — flows inline, wraps naturally. */}
            <span className="font-light tracking-[-0.005em] text-amber-800">
              {heroAccent}
            </span>
          </h1>

          <p className="font-magazine-serif-ko mt-1.5 text-[10px] font-normal leading-[1.5] tracking-[-0.005em] text-stone-800 [text-shadow:0_1px_2px_rgba(255,255,255,0.95)] sm:text-[11px]">
            {heroSub}
          </p>

          <p className="font-magazine-serif-ko mt-1.5 flex items-center gap-1.5 text-[9px] font-medium tracking-[0.02em] text-amber-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.95)] sm:mt-2 sm:text-[9.5px]">
            <span className="inline-block h-px w-5 bg-amber-700/65" aria-hidden />
            {heroCurator}
          </p>
        </div>
      </motion.div>

      {/* Slim bottom fade — only the last ~24px dissolves into ivory page bg,
          so the dropped-down copy (pb-3/4/5) sits cleanly on the photo without
          getting washed out by an ivory wash on top of the curator line. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#faf8f3] via-[#faf8f3]/50 to-transparent"
        aria-hidden
      />
    </motion.header>
  );
}
