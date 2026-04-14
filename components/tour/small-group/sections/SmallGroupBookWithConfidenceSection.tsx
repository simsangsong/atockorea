'use client';

import Image from 'next/image';
import {
  BadgeCheck,
  ChevronDown,
  MapPinned,
  Star,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type {
  SmallGroupAfterBookingStep,
  SmallGroupTrustPoint,
  SmallGroupTrustReview,
} from '../smallGroupDetailContent';

const TRUST_MAX = 3;

/** Quiet editorial icons — not a corporate feature grid */
const TRUST_ICONS: Record<string, LucideIcon> = {
  tp1: BadgeCheck,
  tp2: MapPinned,
  tp3: UsersRound,
};

function foldSupportText(
  text: string,
  budget: number,
): { short: true; text: string } | { short: false; preview: string; full: string } {
  const t = text.trim();
  if (!t || t.length <= budget) return { short: true, text: t };
  const first = t.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  if (first.length >= 14 && first.length < t.length && first.length <= budget + 35) {
    return { short: false, preview: first, full: t };
  }
  return { short: false, preview: `${t.slice(0, Math.min(budget, 96)).trim()}…`, full: t };
}

function aggregateLabel(rating: number | null, count: number | null): string | null {
  if (rating != null && count != null && count > 0) {
    return `${Number(rating).toFixed(1)} · ${count} reviews`;
  }
  if (rating != null) {
    return `${Number(rating).toFixed(1)} average`;
  }
  if (count != null && count > 0) {
    return `${count} reviews`;
  }
  return null;
}

export interface SmallGroupBookWithConfidenceSectionProps {
  points: SmallGroupTrustPoint[];
  reviews: SmallGroupTrustReview[];
  aggregateRating: number | null;
  reviewCount: number | null;
  leadSubtitle?: string;
  afterSteps: SmallGroupAfterBookingStep[];
  afterSubtitle?: string;
}

/**
 * Booking & support — Layer 1: trust (max 3, editorial). Layer 2: after-booking timeline (compact).
 * Distinct visual rhythm between layers; reviews sit with trust as social proof.
 */
export default function SmallGroupBookWithConfidenceSection({
  points,
  reviews,
  aggregateRating,
  reviewCount,
  leadSubtitle = 'Credible operation, clear next steps after you reserve.',
  afterSteps = [],
  afterSubtitle = 'A calm sequence from confirmation to day-of—expand only what you need.',
}: SmallGroupBookWithConfidenceSectionProps) {
  const trustLayer = points.slice(0, TRUST_MAX);
  const hasTrustLayer = trustLayer.length > 0;
  const hasReviews = reviews.length > 0;
  const hasAfterLayer = afterSteps.length > 0;

  if (!hasTrustLayer && !hasReviews && !hasAfterLayer) {
    return null;
  }

  const summary = aggregateLabel(aggregateRating, reviewCount);
  const leadSnippet = reviews[0]?.text?.trim() ?? '';
  const showReviewDepth = reviews.length > 1;
  const qFold = leadSnippet ? foldSupportText(leadSnippet, 100) : { short: true as const, text: '' };

  return (
    <section
      id="sg-booking-support"
      className="sg-dp-mid-slot-reassurance sg-dp-section-rule-soft sg-dp-section-band-reassurance sg-dp-page-gutter scroll-mt-[var(--sg-sticky-clear)] font-sans antialiased"
      aria-labelledby="booking-support-heading"
    >
      <div className="sg-dp-page-column-wide">
        <h2
          id="booking-support-heading"
          className="sg-dp-type-section-title m-0 max-w-[min(100%,36rem)] text-pretty"
        >
          Booking &amp; support
        </h2>
        <p className="sg-dp-type-body m-0 mt-2 max-w-xl text-[13px] leading-snug text-neutral-700 sm:mt-2.5 sm:text-[14px] sm:leading-normal">
          {leadSubtitle}
        </p>

        {/* —— Layer 1: Trust summary (editorial column, not a feature grid) —— */}
        {hasTrustLayer || hasReviews ? (
          <div className="mt-6 sm:mt-7">
            {hasTrustLayer ? (
              <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.14em] text-neutral-500">
                Trust summary
              </p>
            ) : null}

            {hasTrustLayer ? (
              <div className="mt-3 max-w-xl border-t border-stone-200/55">
                {trustLayer.map((point: SmallGroupTrustPoint, index: number) => {
                  const Icon = TRUST_ICONS[point.id] ?? BadgeCheck;
                  const desc = foldSupportText(point.description, 88);
                  const isLast = index === trustLayer.length - 1;
                  return (
                    <div
                      key={point.id}
                      className={`flex gap-3 py-4 sm:gap-3.5 sm:py-5 ${!isLast ? 'border-b border-stone-200/45' : ''}`}
                    >
                      <Icon
                        className="mt-0.5 h-[15px] w-[15px] shrink-0 text-stone-500/90 sm:h-4 sm:w-4"
                        strokeWidth={1.65}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="sg-dp-type-subsection m-0 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-stone-900 sm:text-[15.5px]">
                          {point.title}
                        </h3>
                        {desc.short ? (
                          <p className="sg-dp-type-body m-0 mt-1.5 text-[13px] leading-relaxed text-neutral-600 sm:mt-2 sm:text-[13.5px]">
                            {desc.text}
                          </p>
                        ) : (
                          <>
                            <p className="sg-dp-type-body m-0 mt-1.5 text-[13px] leading-snug text-neutral-600 sm:mt-2 sm:text-[13.5px]">
                              {desc.preview}
                            </p>
                            <details className="group mt-2">
                              <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center gap-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                                <ChevronDown
                                  className="h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                Read more
                              </summary>
                              <p className="sg-dp-type-body m-0 mt-1.5 border-t border-stone-200/50 pt-2 text-[13px] leading-relaxed text-neutral-600">
                                {desc.full}
                              </p>
                            </details>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {hasReviews ? (
              <div className={`${hasTrustLayer ? 'mt-6 sm:mt-7' : 'mt-0'} max-w-xl`}>
                <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.14em] text-neutral-500">
                  Guest voices
                </p>
                <div className="mt-2.5 rounded-[var(--sg-card-r-panel)] border border-[color:color-mix(in_oklab,var(--sg-card-stroke)_82%,transparent)] bg-white/88 px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset] sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-0.5" aria-hidden>
                      {([0, 1, 2, 3, 4] as const).map((i: number) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-[var(--dp-fg)]/75 text-[var(--dp-fg)]/75"
                        />
                      ))}
                    </div>
                    {summary ? (
                      <span className="sg-dp-type-meta tabular-nums text-neutral-600">{summary}</span>
                    ) : (
                      <span className="sg-dp-type-meta text-neutral-600">From recent guests</span>
                    )}
                  </div>
                  {leadSnippet ? (
                    qFold.short ? (
                      <p className="sg-dp-type-body-strong sg-dp-pullquote m-0 mt-2 line-clamp-2 max-w-prose text-[13px] leading-snug sm:text-[14px]">
                        &ldquo;{qFold.text}&rdquo;
                      </p>
                    ) : (
                      <div className="mt-2">
                        <p className="sg-dp-type-body-strong sg-dp-pullquote m-0 max-w-prose text-[13px] leading-snug sm:text-[14px]">
                          &ldquo;{qFold.preview}&rdquo;
                        </p>
                        <details className="group mt-1.5">
                          <summary className="sg-dp-disclosure-summary inline-flex list-none items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                            <ChevronDown
                              className="h-3 w-3 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                              strokeWidth={2}
                              aria-hidden
                            />
                            Full quote
                          </summary>
                          <p className="sg-dp-type-body-strong sg-dp-pullquote m-0 mt-1.5 max-w-prose text-[13px] leading-relaxed sm:text-[14px]">
                            &ldquo;{qFold.full}&rdquo;
                          </p>
                        </details>
                      </div>
                    )
                  ) : null}
                </div>

                {showReviewDepth ? (
                  <details className="group mt-3">
                    <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition-colors hover:border-stone-200/80 hover:bg-stone-50/70">
                      <span className="sg-dp-type-meta font-semibold text-neutral-700">
                        All guest reviews ({reviews.length})
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </summary>
                    <div
                      id="trust-review-cards"
                      className="mt-3 grid scroll-mt-[var(--sg-sticky-clear)] gap-3 sm:gap-4 md:grid-cols-2 md:gap-5"
                    >
                      {reviews.map((review: SmallGroupTrustReview) => (
                        <article key={review.id} className="sg-ota-card sg-dp-ota-card--support p-4 lg:p-5">
                          <p className="sg-dp-type-body-strong sg-dp-pullquote mb-3 m-0 text-[13px] leading-relaxed sm:text-[14px]">
                            &ldquo;{review.text}&rdquo;
                          </p>
                          {review.reviewSourceLabel?.trim() ? (
                            <p className="sg-dp-type-caption m-0 mb-2 text-[var(--dp-muted)]">
                              {review.reviewSourceLabel.trim()}
                            </p>
                          ) : review.verifiedBooking ? (
                            <p className="sg-dp-type-label-caps m-0 mb-2">Verified booking</p>
                          ) : null}
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-stone-200">
                              {review.avatarUrl ? (
                                <Image src={review.avatarUrl} alt="" fill className="object-cover" sizes="36px" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="sg-dp-card-title m-0 text-[14px]">{review.name}</p>
                              <p className="sg-dp-type-meta m-0">
                                {review.location} · {review.date}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : reviews.length === 1 ? (
                  <div id="trust-review-cards" className="mt-3 scroll-mt-[var(--sg-sticky-clear)]">
                    {reviews.map((review: SmallGroupTrustReview) => (
                      <article key={review.id} className="sg-ota-card sg-dp-ota-card--support p-4 lg:p-5">
                        <p className="sg-dp-type-body-strong sg-dp-pullquote mb-3 m-0 leading-relaxed">
                          &ldquo;{review.text}&rdquo;
                        </p>
                        {review.reviewSourceLabel?.trim() ? (
                          <p className="sg-dp-type-caption m-0 mb-2 text-[var(--dp-muted)]">
                            {review.reviewSourceLabel.trim()}
                          </p>
                        ) : review.verifiedBooking ? (
                          <p className="sg-dp-type-label-caps m-0 mb-2">Verified booking</p>
                        ) : null}
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-stone-200">
                            {review.avatarUrl ? (
                              <Image src={review.avatarUrl} alt="" fill className="object-cover" sizes="36px" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="sg-dp-card-title m-0">{review.name}</p>
                            <p className="sg-dp-type-meta m-0">
                              {review.location} · {review.date}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* —— Layer 2: After booking (timeline rhythm ≠ trust pillar rhythm) —— */}
        {hasAfterLayer ? (
          <div className="mt-8 border-t border-[color:var(--sg-rule-mid)] pt-7 sm:mt-9 sm:pt-8">
            <p className="sg-dp-type-label-caps m-0 !text-[10px] !tracking-[0.14em] text-neutral-500">After booking</p>
            {afterSubtitle?.trim() ? (
              <p className="sg-dp-type-meta m-0 mt-2 max-w-xl text-[12.5px] leading-snug text-neutral-600 sm:text-[13px]">
                {afterSubtitle.trim()}
              </p>
            ) : null}

            <ol className="m-0 mt-4 list-none space-y-0 p-0 sm:mt-5">
              {afterSteps.map((step: SmallGroupAfterBookingStep, index: number) => {
                const detailTrim = step.detail?.trim() ?? '';
                const bodyTrim = step.description.trim();
                const hasDepth = bodyTrim.length > 0 || detailTrim.length > 0;
                const isLast = index === afterSteps.length - 1;
                return (
                  <li
                    key={step.id}
                    className={`relative flex gap-3 py-3 sm:gap-4 sm:py-3.5 ${!isLast ? 'border-b border-stone-200/40' : ''}`}
                  >
                    <div className="flex w-7 shrink-0 flex-col items-center pt-0.5" aria-hidden>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300/80 bg-white text-[10px] font-semibold tabular-nums text-stone-500">
                        {index + 1}
                      </span>
                      {!isLast ? (
                        <span className="mt-1 min-h-[1rem] w-px flex-1 bg-gradient-to-b from-stone-300/50 to-transparent" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-0.5 pt-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {step.timing ? (
                          <span className="sg-dp-type-meta text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                            {step.timing}
                          </span>
                        ) : null}
                        <span className="sg-dp-type-body-strong text-[14px] leading-snug text-stone-900">{step.title}</span>
                      </div>
                      {hasDepth ? (
                        <details className="group mt-1.5">
                          <summary className="sg-dp-disclosure-summary inline-flex cursor-pointer list-none items-center gap-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 hover:text-neutral-700">
                            <ChevronDown
                              className="h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                              strokeWidth={2}
                              aria-hidden
                            />
                            Step detail
                          </summary>
                          <div className="mt-2 border-l-2 border-stone-200/90 pl-3">
                            {bodyTrim ? (
                              <p className="sg-dp-type-body m-0 text-[13px] leading-relaxed text-neutral-700">{bodyTrim}</p>
                            ) : null}
                            {detailTrim ? (
                              <p className="sg-dp-type-meta m-0 mt-2 text-[12.5px] leading-relaxed text-neutral-600">
                                {detailTrim}
                              </p>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        <p className="sg-dp-type-support-note sg-dp-type-support-note--center-md m-0 mt-6 md:mt-7">
          Questions before booking? <span className="sg-dp-primary font-medium">Message us anytime</span>
        </p>

        <p className="sg-dp-type-support-note sg-dp-type-support-note--center-md m-0 mt-5 max-w-prose border-t border-[color:var(--sg-rule-soft)] pt-4 md:mt-6 md:max-w-2xl md:pt-5 mx-auto md:text-balance">
          Pickup, inclusions, and weather handling — see{' '}
          <a href="#sg-details" className="sg-dp-inline-text-link">
            Practical details
          </a>
          . Common questions —{' '}
          <a href="#sg-faq" className="sg-dp-inline-text-link">
            Questions
          </a>
          .
        </p>
      </div>
    </section>
  );
}
