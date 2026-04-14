'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock, Footprints, MapPin, type LucideIcon } from 'lucide-react';
import type { SmallGroupRelatedTourCard } from '../smallGroupDetailContent';

export interface SmallGroupRelatedToursSectionProps {
  cards: SmallGroupRelatedTourCard[];
  formatPrice: (amount: number) => string;
}

function relatedMetaChips(tour: SmallGroupRelatedTourCard): Array<{ key: string; Icon: LucideIcon; text: string }> {
  const chips: Array<{ key: string; Icon: LucideIcon; text: string }> = [];
  if (tour.duration?.trim()) {
    chips.push({ key: 'dur', Icon: Clock, text: tour.duration.trim() });
  }
  if (tour.stopCount != null && tour.stopCount > 0) {
    chips.push({ key: 'stops', Icon: MapPin, text: `${tour.stopCount} stops` });
  }
  if (tour.difficulty?.trim()) {
    chips.push({ key: 'diff', Icon: Footprints, text: tour.difficulty.trim() });
  }
  return chips.slice(0, 3);
}

/**
 * (J) Related experiences — discovery rail: strong image hierarchy, route focus line, meta chips, clear from-price.
 */
export default function SmallGroupRelatedToursSection({ cards, formatPrice }: SmallGroupRelatedToursSectionProps) {
  if (cards.length === 0) {
    return (
      <section
        id="sg-explore-next"
        className="sg-dp-related-section sg-dp-narrative-related-anchor w-full min-w-0 scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter pb-20 font-sans antialiased md:pb-24 lg:mx-auto lg:max-w-[1400px] lg:pb-[5.75rem]"
        aria-label="Similar tours"
      >
        <div className="sg-dp-page-column min-w-0">
          <p className="sg-dp-related-lead sg-dp-type-body m-0 max-w-prose" role="status">
            Suggestions will appear here when we have a thoughtful match for this route.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="sg-explore-next"
      className="sg-dp-related-section sg-dp-narrative-related-anchor w-full min-w-0 scroll-mt-[var(--sg-sticky-clear)] bg-transparent sg-dp-page-gutter pb-20 font-sans antialiased md:pb-24 lg:mx-auto lg:max-w-[1400px] lg:pb-[5.75rem]"
      aria-labelledby="related-tours-heading"
    >
      <div className="min-w-0 w-full">
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5 sm:gap-6 md:mb-6">
          <div className="min-w-0 max-w-[min(100%,30rem)] md:max-w-[34rem]">
            <p className="sg-dp-type-utility-section-eyebrow m-0 mb-0.5 tracking-wide">Explore next</p>
            <h2
              id="related-tours-heading"
              className="sg-dp-type-section-heading-support m-0 text-pretty tracking-[-0.02em]"
            >
              You might also like
            </h2>
            <p className="sg-dp-related-lead sg-dp-type-body m-0 mt-1.5 max-w-prose leading-snug text-[color:color-mix(in_oklab,var(--dp-muted)_55%,var(--dp-fg)_45%)] sm:mt-2 sm:leading-relaxed">
              Alternates with different pacing and emphasis—each route is intentionally distinct.
            </p>
          </div>
          <Link
            href="/tours"
            className="sg-dp-type-meta sg-dp-related-view-all hidden shrink-0 items-center gap-2 font-semibold md:inline-flex"
          >
            <span>View all</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div
          className="sg-dp-related-rail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x sm:gap-5 md:mx-0 md:grid md:grid-cols-3 md:items-stretch md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:gap-7 [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((tour: SmallGroupRelatedTourCard) => {
            const chips = relatedMetaChips(tour);
            const hasPrice = tour.priceFrom != null && !Number.isNaN(Number(tour.priceFrom));
            return (
              <article
                key={tour.id}
                className="sg-dp-related-card-article flex w-[min(86vw,320px)] shrink-0 snap-start sm:w-[300px] md:w-auto md:min-w-0 md:max-w-none"
              >
                <Link
                  href={tour.href}
                  className="group sg-dp-related-card-link flex h-full min-h-0 flex-1 flex-col rounded-[var(--sg-card-r-step)] focus:outline-none"
                >
                  <div className="sg-dp-surface-step sg-dp-surface-step--link sg-dp-related-discovery-card relative flex min-h-0 flex-1 flex-col overflow-hidden transition-[box-shadow,border-color] duration-200 ease-out">
                    <div className="sg-dp-related-card-media">
                      {tour.imageUrl ? (
                        <Image
                          src={tour.imageUrl}
                          alt=""
                          fill
                          className="sg-dp-related-card-image h-full w-full object-cover object-[center_42%] transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.02]"
                          sizes="(max-width:768px) 320px, 33vw"
                          loading="lazy"
                        />
                      ) : null}
                      {tour.badge?.trim() ? (
                        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-end justify-start gap-1.5 sm:bottom-3 sm:left-3 sm:right-3 sm:gap-2">
                          <span className="sg-dp-related-route-badge inline-flex max-w-full truncate rounded-full border border-white/25 bg-white/88 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_4px_14px_-6px_rgba(0,0,0,0.25)] backdrop-blur-[6px] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.08em]">
                            {tour.badge.trim()}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="sg-dp-related-card-body">
                      <h3 className="sg-dp-related-card-title text-pretty">{tour.title}</h3>

                      {tour.subtitle?.trim() ? (
                        <div className="sg-dp-related-card-route">
                          <p className="sg-dp-type-label-caps m-0 mb-1 !text-[0.5625rem] !tracking-[0.14em]">
                            Route focus
                          </p>
                          <p className="sg-dp-type-body m-0 text-[13px] leading-snug sm:text-[13.5px] sm:leading-relaxed">
                            {tour.subtitle.trim()}
                          </p>
                        </div>
                      ) : null}

                      {chips.length > 0 ? (
                        <ul className="sg-dp-related-meta-row" aria-label="Tour summary">
                          {chips.map((c) => (
                            <li key={`${tour.id}-${c.key}`} className="sg-dp-related-meta-pill">
                              <c.Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                              {c.text}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="sg-dp-related-card-spacer" aria-hidden />

                      <div className="sg-dp-related-card-footer">
                        {hasPrice ? (
                          <div className="min-w-0 flex-1">
                            <p className="sg-dp-type-label-caps sg-dp-related-price-label !text-[0.5625rem]">From</p>
                            <p className="sg-dp-related-price">{formatPrice(tour.priceFrom!)}</p>
                          </div>
                        ) : (
                          <p className="sg-dp-type-meta m-0 flex-1 font-medium">View route</p>
                        )}
                        <span className="sg-dp-related-arrow" aria-hidden>
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center border-t border-[color:color-mix(in_oklab,var(--sg-rule-mid)_22%,var(--sg-rule-soft)_78%)] pt-7 md:hidden">
          <Link
            href="/tours"
            className="sg-dp-type-meta sg-dp-related-view-all flex items-center gap-2 font-semibold"
          >
            <span>View all experiences</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
