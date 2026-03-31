'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Clock, Footprints, MapPin, Star, Users } from 'lucide-react';
import type { SmallGroupDetailContent, SmallGroupPremiumBadge } from '../smallGroupDetailContent';
import { useTranslations } from '@/lib/i18n';

export interface SmallGroupHeroSectionProps {
  hero: SmallGroupDetailContent['hero'];
  tourTitle: string;
  eyebrow: string;
  /** Shown in hero meta when summary facts omit a stops line. */
  stopCount: number;
  /** Walking / effort level for quick-facts strip. */
  difficulty?: string;
  /** Pickup region line from view model. */
  pickupAreaLabel?: string;
  rating?: number | null;
  reviewCount?: number | null;
}

/** Tiny neutral blur — stabilizes hero LCP frame (Phase 8). */
const HERO_IMAGE_BLUR_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQAAAAAAAA/9k=';

function heroBadgeRow(eyebrow: string, badges: SmallGroupPremiumBadge[]): SmallGroupPremiumBadge[] {
  if (badges.length > 0) return badges.slice(0, 2);
  if (eyebrow.trim()) return [{ id: 'hero-eyebrow', label: eyebrow.trim() }];
  return [];
}

type HeroChip = { key: string; icon: typeof Clock; text: string };

/**
 * Premium product hero: title + route positioning on image; quick facts + rating on bright strip; optional extended tagline card.
 */
export default function SmallGroupHeroSection({
  hero,
  tourTitle,
  eyebrow,
  stopCount,
  difficulty,
  pickupAreaLabel,
  rating,
  reviewCount,
}: SmallGroupHeroSectionProps) {
  const t = useTranslations();
  const { title, subtitle, positioningLine, galleryImageUrls, summaryFacts, badges: heroBadges } = hero;
  const lead = galleryImageUrls[0];
  const displayBadges = heroBadgeRow(eyebrow, heroBadges);

  const [reduceMotion, setReduceMotion] = useState(true);
  const [parallaxY, setParallaxY] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || !lead) return undefined;
    const onScroll = () => {
      const y = Math.min(window.scrollY * 0.1, 56);
      setParallaxY(y);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduceMotion, lead]);

  const durationFact = summaryFacts.find((f) => f.id === 'duration');
  const groupFact = summaryFacts.find((f) => f.id === 'groupSize');
  const cityFact = summaryFacts.find((f) => f.id === 'city');
  const durationLine = durationFact?.value?.trim() ?? '';
  const groupLine = groupFact?.value?.trim() ?? '';
  const cityLine = cityFact?.value?.trim() ?? '';
  const stopsLine = stopCount > 0 ? `${stopCount} stops` : '';
  const pickupShort = (pickupAreaLabel ?? '').trim();
  const difficultyLine = (difficulty ?? '').trim();

  const layer2Positioning = useMemo(() => {
    const pos = positioningLine.trim();
    const sub = subtitle.trim();
    if (pos) return pos;
    if (!sub) return '';
    const firstSentence = sub.split(/(?<=[.!?])\s+/)[0]?.trim() ?? sub;
    return firstSentence.length <= 200 ? firstSentence : `${sub.slice(0, 160).trim()}…`;
  }, [positioningLine, subtitle]);

  const showExtendedIntroCard = Boolean(subtitle.trim()) && subtitle.trim() !== layer2Positioning.trim();

  const introCardParagraphs = useMemo(() => {
    const raw = subtitle.trim();
    if (!raw) return [];
    const parts = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [raw];
  }, [subtitle]);

  const quickFactChips: HeroChip[] = useMemo(() => {
    const chips: HeroChip[] = [];
    if (durationLine) chips.push({ key: 'duration', icon: Clock, text: durationLine });
    if (cityLine) chips.push({ key: 'city', icon: MapPin, text: cityLine });
    if (stopsLine) chips.push({ key: 'stops', icon: MapPin, text: stopsLine });
    if (groupLine) chips.push({ key: 'group', icon: Users, text: groupLine });
    if (difficultyLine) chips.push({ key: 'walk', icon: Footprints, text: difficultyLine });
    if (pickupShort) chips.push({ key: 'pickup', icon: MapPin, text: pickupShort.length > 48 ? `${pickupShort.slice(0, 45)}…` : pickupShort });
    return chips;
  }, [durationLine, cityLine, stopsLine, groupLine, difficultyLine, pickupShort]);

  const numericRating = rating != null && !Number.isNaN(Number(rating)) ? Number(rating) : null;
  const reviewsN = reviewCount != null && reviewCount > 0 ? reviewCount : 0;
  const fullStars =
    numericRating != null
      ? Math.min(5, Math.floor(numericRating) + (numericRating % 1 >= 0.5 ? 1 : 0))
      : 0;

  const hasStripContent = quickFactChips.length > 0 || numericRating != null;

  return (
    <header className="relative w-full font-sans">
      {/*
        Negative margin pulls the hero under the sticky bar; image starts at the top of this
        box (no padding letterbox). Poster uses .sg-dp-hero-poster-stack for header clearance.
      */}
      <div className="sg-dp-hero-media-root relative h-[min(46dvh,52vh)] min-h-[300px] sm:min-h-[320px] md:h-[56vh] md:min-h-[400px] lg:h-[62vh] lg:min-h-[520px] overflow-hidden bg-stone-900">
        {lead ? (
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 will-change-transform"
              style={
                reduceMotion
                  ? undefined
                  : { transform: `translate3d(0, ${parallaxY}px, 0) scale(1.06)` }
              }
            >
              <Image
                src={lead}
                alt={`${tourTitle} — hero`}
                fill
                className="object-cover"
                sizes="100vw"
                priority
                placeholder="blur"
                blurDataURL={HERO_IMAGE_BLUR_DATA_URL}
              />
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-stone-800 text-sm text-white/50"
            role="img"
            aria-label="No tour image"
          >
            Visual coming soon
          </div>
        )}

        <div className="sg-dp-hero-scrim-stack" aria-hidden>
          <div className="sg-dp-hero-scrim-sides" />
          <div className="sg-dp-hero-scrim-top" />
          <div className="sg-dp-hero-scrim-base" />
        </div>

        <div className="sg-dp-hero-canvas-fade" aria-hidden />

        {/*
          Poster stack: one left-aligned measure (mobile), centered md+.
          Title + positioning read as headline block; badges as kicker; facts + rating as a single glass deck.
        */}
        <div className="sg-dp-hero-poster-stack pointer-events-none absolute inset-0 z-[3] flex flex-col justify-end sg-dp-page-gutter pb-[2.75rem] text-left max-md:pb-12 md:items-center md:justify-end md:pb-11 lg:pb-12">
          <div className="sg-dp-hero-poster-column flex min-w-0 w-full max-w-[min(100%,22.5rem)] flex-col sm:max-w-[24.5rem] md:max-w-[28rem] md:items-center md:text-center">
            <div className="flex w-full flex-col gap-2.5 md:gap-3">
              <h1 className="sg-dp-type-hero-title mb-0 w-full text-pretty text-white md:px-1">{title}</h1>

              {layer2Positioning ? (
                <p className="sg-dp-type-hero-meta sg-dp-hero-poster-dek m-0 w-full max-w-prose antialiased md:max-w-[26rem]">
                  {layer2Positioning}
                </p>
              ) : null}
            </div>

            {displayBadges.length > 0 ? (
              <div
                className={`flex w-full flex-wrap items-center gap-1.5 md:justify-center ${layer2Positioning ? 'mt-2.5 sm:mt-3' : 'mt-1 sm:mt-1.5'}`}
              >
                {displayBadges.map((b: SmallGroupPremiumBadge) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center rounded-full border border-white/[0.16] bg-white/[0.08] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/[0.93] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-[10px] sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.11em] md:text-[11px]"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}

            {hasStripContent ? (
              <div className="mt-3.5 w-full sm:mt-4 md:mt-5 md:max-w-[min(100%,28rem)]">
                <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/[0.11] bg-white/[0.065] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-[14px] sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-3 md:items-center">
                  {quickFactChips.length > 0 ? (
                    <div className="flex w-full flex-wrap gap-1.5 sm:gap-2 md:justify-center">
                      {quickFactChips.map((c: HeroChip) => {
                        const Icon = c.icon;
                        return (
                          <span
                            key={c.key}
                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium leading-snug tracking-tight text-white/[0.92] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[6px] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] md:text-[12px]"
                          >
                            <Icon
                              className="h-3 w-3 shrink-0 translate-y-px text-white/52 sm:h-3.5 sm:w-3.5 sm:translate-y-0"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <span className="min-w-0 truncate">{c.text}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  {numericRating != null ? (
                    <div
                      className={`flex w-full flex-wrap items-center gap-1.5 sm:gap-2 md:justify-center ${quickFactChips.length > 0 ? 'border-t border-white/[0.1] pt-2.5 sm:pt-3' : ''}`}
                    >
                      <div className="flex items-center gap-0.5 text-amber-100/88" aria-hidden>
                        {[1, 2, 3, 4, 5].map((i: number) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${
                              i <= fullStars ? 'fill-amber-100/90 text-amber-100/90' : 'fill-transparent text-amber-100/32'
                            }`}
                            strokeWidth={i <= fullStars ? 0 : 1.35}
                          />
                        ))}
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-white/[0.92] sm:text-[13px] md:text-sm">
                        {numericRating.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-medium text-white/[0.7] sm:text-[11px] md:text-[12px]">
                        ({reviewsN} {t('tour.reviews')})
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Intro card — pulled into canvas fade for one continuous first fold */}
      <div className="relative z-20 sg-dp-page-gutter pb-4 pt-1 max-sm:pt-0.5 sm:pb-5 sm:pt-0 md:pb-6 -mt-4 sm:-mt-5 md:-mt-12 lg:-mt-[3.75rem]">
        <div className="sg-dp-page-column min-w-0 space-y-3 md:space-y-3.5">
          {(showExtendedIntroCard || (!layer2Positioning && subtitle.trim())) && subtitle.trim() ? (
            <div className="sg-ota-card sg-dp-hero-intro-card space-y-3 px-5 py-5 md:space-y-3.5 md:px-7 md:py-7 lg:px-8 lg:py-8">
              {introCardParagraphs.map((para: string, i: number) => (
                <p key={i} className="sg-dp-type-hero-card m-0 max-w-prose antialiased">
                  {para.split('\n').map((line: string, j: number) => (
                    <span key={j}>
                      {j > 0 ? <br /> : null}
                      {line.trim()}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
