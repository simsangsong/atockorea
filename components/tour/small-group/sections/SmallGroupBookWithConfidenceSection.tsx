'use client';

import Image from 'next/image';
import {
  Award,
  ChevronDown,
  MessageCircle,
  Shield,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SmallGroupAfterBookingStep, SmallGroupTrustPoint, SmallGroupTrustReview } from '../smallGroupDetailContent';

const POINT_ICONS: Record<string, LucideIcon> = {
  tp1: Shield,
  tp2: Award,
  tp3: Users,
  tp4: MessageCircle,
};

const TRUST_PRIMARY_VISIBLE = 3;

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

function primaryTrustGridClass(count: number): string {
  if (count >= 3) return 'sm:grid-cols-3';
  if (count === 2) return 'sm:grid-cols-2';
  return 'sm:grid-cols-1';
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
 * Trust stack — Layer 1: three scan-first promises (+ optional extra in disclosure).
 * Layer 2: compact after-book grid. Layer 3: FAQ / Practical via page anchors + review depth.
 */
export default function SmallGroupBookWithConfidenceSection({
  points,
  reviews,
  aggregateRating,
  reviewCount,
  leadSubtitle = 'Trusted by thousands of travelers',
  afterSteps,
  afterSubtitle = 'The support you receive before, during, and after your experience',
}: SmallGroupBookWithConfidenceSectionProps) {
  const hasTrust = points.length > 0 || reviews.length > 0;
  const hasAfter = afterSteps.length > 0;

  if (!hasTrust && !hasAfter) {
    return null;
  }

  const summary = aggregateLabel(aggregateRating, reviewCount);
  const leadSnippet = reviews[0]?.text?.trim() ?? '';
  const primaryTrust = points.slice(0, TRUST_PRIMARY_VISIBLE);
  const extraTrust = points.slice(TRUST_PRIMARY_VISIBLE);
  const gridClass = primaryTrustGridClass(primaryTrust.length);
  const showReviewDepth = reviews.length > 1;

  return (
    <section
      id="trust-reviews"
      className="sg-dp-mid-slot-reassurance sg-dp-section-rule-soft sg-dp-section-band-reassurance sg-dp-page-gutter scroll-mt-[var(--sg-sticky-clear)] font-sans antialiased"
      aria-labelledby="book-confidence-heading"
    >
      <div className="sg-dp-page-column-wide">
        {hasTrust ? (
          <div>
            <p className="sg-dp-type-utility-section-eyebrow m-0 mb-1.5">Know before you book</p>
            <h2 id="book-confidence-heading" className="sg-dp-type-section-title m-0 max-w-[min(100%,36rem)] text-pretty">
              Book with confidence
            </h2>
            <p className="sg-dp-type-body m-0 mt-2 max-w-xl sm:mt-2.5">
              {leadSubtitle}
            </p>

            {primaryTrust.length > 0 ? (
              <div className="sg-dp-expand-shell sg-dp-trust-pillars-shell sg-dp-trust-pillars-shell--layered mt-4 overflow-hidden p-0 sm:mt-5">
                <div
                  className={`grid grid-cols-1 gap-px bg-[color:var(--sg-rule-mid)] ${gridClass}`}
                >
                  {primaryTrust.map((point: SmallGroupTrustPoint) => {
                    const Icon = POINT_ICONS[point.id] ?? Shield;
                    return (
                      <div
                        key={point.id}
                        className="sg-dp-trust-pillar-cell sg-dp-trust-pillar-cell--promise flex min-h-0 flex-col items-start gap-2 text-left"
                      >
                        <div className="sg-dp-icon-well sg-dp-icon-well--sm shrink-0" aria-hidden>
                          <Icon className="h-3.5 w-3.5 text-neutral-600" strokeWidth={1.75} />
                        </div>
                        <h3 className="sg-dp-card-title m-0 text-[14px] sm:text-[14.5px]">
                          {point.title}
                        </h3>
                        <p className="sg-dp-type-body m-0 max-w-[20rem] text-[12.5px] sm:text-[13px] sm:leading-relaxed">
                          {point.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {extraTrust.length > 0 ? (
                  <details className="group border-t border-[color:var(--sg-rule-mid)] bg-[color:color-mix(in_oklab,var(--dp-secondary)_18%,white)]">
                    <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-3.5">
                      <span className="sg-dp-type-label-caps">
                        {extraTrust.length === 1
                          ? 'One more assurance'
                          : `More assurances (${extraTrust.length})`}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </summary>
                    <div className="grid grid-cols-1 gap-px border-t border-[color:var(--sg-rule-mid)] bg-[color:var(--sg-rule-mid)] sm:grid-cols-2">
                      {extraTrust.map((point: SmallGroupTrustPoint) => {
                        const Icon = POINT_ICONS[point.id] ?? Shield;
                        return (
                          <div
                            key={point.id}
                            className="sg-dp-trust-pillar-cell sg-dp-trust-pillar-cell--promise flex min-h-0 flex-col items-start gap-2 bg-[linear-gradient(180deg,#fcfcfa_0%,#f7f7f4_100%)] p-4 text-left sm:p-4"
                          >
                            <div className="sg-dp-icon-well sg-dp-icon-well--sm shrink-0" aria-hidden>
                              <Icon className="h-3.5 w-3.5 text-neutral-600" strokeWidth={1.75} />
                            </div>
                            <h3 className="sg-dp-card-title m-0 text-[14px]">{point.title}</h3>
                            <p className="sg-dp-type-body m-0 max-w-prose text-[12.5px] sm:text-[13px]">
                              {point.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {reviews.length > 0 ? (
              <div className="mt-5 sm:mt-6 md:mt-6">
                <p className="sg-dp-label-row mb-0">Guest reviews</p>
                <div className="mt-2.5 rounded-[var(--sg-card-r-panel)] border border-[color:color-mix(in_oklab,var(--sg-card-stroke)_85%,transparent)] bg-white/90 px-3.5 py-3 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_1px_2px_rgba(15,23,42,0.03)] sm:px-4 sm:py-3.5">
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <div className="flex items-center gap-1" aria-hidden>
                      {([0, 1, 2, 3, 4] as const).map((i: number) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-[var(--dp-fg)]/80 text-[var(--dp-fg)]/80"
                        />
                      ))}
                    </div>
                    {summary ? (
                      <span className="sg-dp-type-meta tabular-nums">{summary}</span>
                    ) : (
                      <span className="sg-dp-type-meta">From recent guests</span>
                    )}
                  </div>
                  {leadSnippet ? (
                    <p className="sg-dp-type-body-strong sg-dp-pullquote mt-2.5 m-0 line-clamp-2 max-w-prose text-[13px] leading-relaxed sm:text-[14px]">
                      &ldquo;{leadSnippet}&rdquo;
                    </p>
                  ) : null}
                </div>

                {showReviewDepth ? (
                  <details className="group mt-3">
                    <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition-colors hover:border-neutral-200/80 hover:bg-stone-50/80">
                      <span className="sg-dp-type-meta font-semibold">
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
                ) : (
                  <div
                    id="trust-review-cards"
                    className="mt-3 grid scroll-mt-[var(--sg-sticky-clear)] gap-3 md:grid-cols-2"
                  >
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
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasAfter ? (
          <div
            className={
              hasTrust
                ? 'mt-6 border-t border-[color:var(--sg-rule-mid)] pt-6 sm:mt-7 sm:pt-7 md:pt-8'
                : ''
            }
          >
            <div className="sg-dp-page-column">
              {hasTrust ? (
                <p className="sg-dp-type-utility-section-eyebrow m-0 mb-1">After you reserve</p>
              ) : null}
              {hasTrust ? (
                <h3 className="sg-dp-type-subsection m-0 mb-0.5 font-medium tracking-tight text-[var(--dp-muted-strong)]">
                  What happens next
                </h3>
              ) : (
                <h2 id="book-confidence-heading" className="sg-dp-section-h2 mb-2">
                  What happens next
                </h2>
              )}
              <p className="sg-dp-type-body m-0 mb-3 max-w-prose md:mb-4">
                {afterSubtitle}
              </p>

              <div className="sg-dp-after-book-compact-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-3.5">
                {afterSteps.map((step: SmallGroupAfterBookingStep, index: number) => {
                  const detailTrim = step.detail?.trim() ?? '';
                  return (
                    <div
                      key={step.id}
                      className="relative flex min-h-0 flex-col rounded-[var(--sg-card-r-nested)] border border-[color:color-mix(in_oklab,var(--sg-card-stroke)_82%,transparent)] bg-gradient-to-b from-white to-stone-50/50 p-3.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset] sm:p-4"
                    >
                      <span
                        className="absolute right-3 top-3 font-mono text-[10px] font-semibold tabular-nums text-neutral-300 sm:right-3.5 sm:top-3.5"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {step.timing ? (
                        <p className="sg-dp-type-meta m-0 mb-1 max-w-[85%] tabular-nums">{step.timing}</p>
                      ) : null}
                      <h4 className="sg-dp-card-title m-0 pr-7 text-[14px] leading-snug">{step.title}</h4>
                      <p className="sg-dp-type-body m-0 mt-1.5 flex-1 text-[13px] leading-snug">
                        {step.description}
                      </p>
                      {detailTrim ? (
                        <details className="group mt-2.5 border-t border-neutral-100/90 pt-2">
                          <summary className="sg-dp-disclosure-summary inline-flex items-center gap-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-neutral-700">
                            <ChevronDown
                              className="h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                              strokeWidth={2}
                              aria-hidden
                            />
                            More detail
                          </summary>
                          <p className="sg-dp-type-meta m-0 mt-1.5 leading-relaxed">
                            {detailTrim}
                          </p>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <p className="sg-dp-type-support-note sg-dp-type-support-note--center-md m-0 mt-6 md:mt-7">
                Questions before booking? <span className="sg-dp-primary font-medium">Message us anytime</span>
              </p>
            </div>
          </div>
        ) : null}

        <p className="sg-dp-type-support-note sg-dp-type-support-note--center-md m-0 mt-6 max-w-prose border-t border-[color:var(--sg-rule-soft)] pt-5 md:mt-7 md:max-w-2xl md:pt-6 mx-auto md:text-balance">
          Pickup windows, inclusions, and policies — see{' '}
          <a href="#tour-detail-practical" className="sg-dp-inline-text-link">
            Practical details
          </a>{' '}
          and{' '}
          <a href="#tour-detail-faq" className="sg-dp-inline-text-link">
            Questions
          </a>
          .
        </p>
      </div>
    </section>
  );
}
