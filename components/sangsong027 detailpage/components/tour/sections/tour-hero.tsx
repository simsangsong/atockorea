'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Clock, MapPin, Star } from 'lucide-react';

/** Tiny neutral blur — matches SmallGroupHeroSection LCP placeholder. */
const HERO_IMAGE_BLUR_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmQAAAAAAAA/9k=';

export interface TourHeroProps {
  title: string;
  subtitle: string;
  /** e.g. `4.9 (128)` — empty hides the star row */
  ratingLine: string;
  durationLine: string;
  stopsLine: string;
  imageSrc: string;
  /** Top-left pill; omit for no badge */
  eyebrow?: string;
  routePreviewLine?: string;
  policyChips?: string[];
  /** In-app anchor (e.g. `#desktop-booking`) — safe from Server Components */
  availabilityHref?: string;
}

/**
 * Hero — pixel-structural parity with `SmallGroupHeroSection`
 * (cinematic frame, dp-bg gradient scrim, overlapping glass editorial card).
 */
export function TourHero({
  title,
  subtitle,
  ratingLine,
  durationLine,
  stopsLine,
  imageSrc,
  eyebrow,
  routePreviewLine,
  policyChips = [],
  availabilityHref,
}: TourHeroProps) {
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
    if (reduceMotion) return undefined;
    const onScroll = () => {
      const y = Math.min(window.scrollY * 0.1, 56);
      setParallaxY(y);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduceMotion]);

  return (
    <header className="relative w-full">
      <div className="relative h-[56vh] min-h-[400px] lg:h-[62vh] lg:min-h-[520px] overflow-hidden bg-stone-300">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 will-change-transform"
            style={
              reduceMotion ? undefined : { transform: `translate3d(0, ${parallaxY}px, 0) scale(1.06)` }
            }
          >
            <Image
              src={imageSrc}
              alt={`${title} — hero`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
              placeholder="blur"
              blurDataURL={HERO_IMAGE_BLUR_DATA_URL}
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--dp-bg)] via-transparent to-transparent opacity-90" />

        {eyebrow ? (
          <div className="absolute top-5 left-4 md:top-6 md:left-6">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-lg text-[10px] font-medium tracking-[0.04em] text-[var(--dp-fg)]/80">
              {eyebrow}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative -mt-32 px-4 pb-6 md:px-6 lg:-mt-40 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-3xl">
          <div className="sg-dp-glass-elevated rounded-2xl p-5 md:p-7 lg:p-8">
            {ratingLine.trim() ? (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i: number) => (
                    <Star key={i} className="h-3 w-3 fill-[var(--dp-fg)]/70 text-[var(--dp-fg)]/70" />
                  ))}
                </div>
                <span className="text-[12px] sg-dp-text-muted">{ratingLine}</span>
              </div>
            ) : null}

            <h1 className="sg-dp-serif text-[24px] leading-[1.15] font-normal text-[var(--dp-fg)] md:text-[30px] lg:text-[34px] text-balance tracking-[-0.01em]">
              {title}
            </h1>

            {subtitle ? (
              <p className="mt-4 text-[14px] sg-dp-text-muted leading-[1.6] md:text-[15px] max-w-xl">
                {subtitle}
              </p>
            ) : null}

            {durationLine || stopsLine ? (
              <div className="mt-5 pt-5 border-t border-[var(--dp-border)]/50">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--dp-fg)]/60">
                  {durationLine ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden />
                      <span>{durationLine}</span>
                    </div>
                  ) : null}
                  {stopsLine ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden />
                      <span>{stopsLine}</span>
                    </div>
                  ) : null}
                  <span className="text-[var(--dp-border)]">|</span>
                  <span>Small group</span>
                </div>
              </div>
            ) : null}

            {policyChips.length > 0 ? (
              <div className="mt-5 pt-5 border-t border-[var(--dp-border)]/50" aria-label="Policy highlights">
                <ul className="flex flex-wrap gap-2 list-none m-0 p-0" role="list">
                  {policyChips.map((text: string) => (
                    <li key={text} className="min-w-0 max-w-full">
                      <span
                        className="sg-dp-policy-chip inline-block max-w-[min(100%,20rem)] truncate align-middle"
                        title={text}
                      >
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {routePreviewLine ? (
              <div className="mt-5 pt-5 border-t border-[var(--dp-border)]/50">
                <p className="sg-dp-label-row mb-3 opacity-80">Route</p>
                <p className="text-[13px] text-[var(--dp-fg)]/70 leading-relaxed">{routePreviewLine}</p>
              </div>
            ) : null}

            {availabilityHref ? (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <a
                  href={availabilityHref}
                  className="inline-flex justify-center items-center w-full sm:w-auto rounded-xl bg-[var(--dp-fg)] text-[var(--dp-bg)] text-[13px] font-medium px-8 py-3 tracking-wide hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dp-primary)] focus-visible:ring-offset-2 no-underline"
                >
                  Check availability
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
