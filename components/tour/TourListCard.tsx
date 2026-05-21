'use client';

import React, { memo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { TourCardViewModel } from '@/src/types/tours';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { formatTourDurationForCard } from '@/lib/tour-duration-display';
import { isInWishlistLocal, toggleWishlistLocal } from '@/lib/wishlist';
import { cn } from '@/lib/utils';

function formatBookingCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString();
}

function fallbackPrice(priceFrom: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(priceFrom).toLocaleString('ko-KR')}`;
  return `₩${Math.round(priceFrom).toLocaleString('ko-KR')}`;
}

export interface TourListCardProps {
  tour: TourCardViewModel;
  detailHref: string;
  formatPriceFn?: (price: number) => string;
  /**
   * `sizes` for the card's `next/image`. Must match the call site's actual
   * column layout — too small a value ships an upscaled, blurry thumbnail.
   * Default `"50vw"` is the safe-sharp choice (2-up grids); pass a precise
   * value where the layout differs (e.g. 3-up home rail).
   */
  imageSizes?: string;
  /**
   * Next image quality for card thumbnails. Dense lists keep the default lean;
   * large editorial home cards can opt into a sharper encode.
   */
  imageQuality?: number;
  /**
   * `vertical` (default): image on top, content below — used in home/3-up rails.
   * `horizontal`: GYG-style square image on left, content on right — for list/search.
   */
  layout?: 'vertical' | 'horizontal';
}

function TourListCard({
  tour,
  detailHref,
  formatPriceFn,
  imageSizes,
  imageQuality = 75,
  layout = 'vertical',
}: TourListCardProps) {
  const isHorizontal = layout === 'horizontal';
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const typeBadgeCopy = {
    private: copy.detail.badgePrivate,
    join: copy.detail.badgeSmallGroup,
    bus: copy.detail.badgeClassicBus,
  } as const;
  const tourKey = tour.id;
  const [saved, setSaved] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const syncWishlistState = window.setTimeout(() => {
      setSaved(tourKey ? isInWishlistLocal(tourKey) : false);
    }, 0);

    return () => window.clearTimeout(syncWishlistState);
  }, [tourKey]);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tourKey) return;
    setSaved(toggleWishlistLocal(tourKey));
  };

  const priceStr = formatPriceFn ? formatPriceFn(tour.priceFrom) : fallbackPrice(tour.priceFrom, tour.currency);
  const original = tour.originalPrice;
  const hasDiscount =
    original != null && original > tour.priceFrom && tour.priceFrom > 0;
  const discountPct =
    hasDiscount && original != null
      ? Math.round(((original - tour.priceFrom) / original) * 100)
      : 0;
  const showDiscountBadge = discountPct > 0;
  const originalStr =
    hasDiscount && original != null
      ? formatPriceFn
        ? formatPriceFn(original)
        : fallbackPrice(original, tour.currency)
      : null;

  const typeLabel = typeBadgeCopy[tour.type];
  const editorialBadge = typeLabel;
  const supportBadgeCandidate = tour.tags[0] ? String(tour.tags[0]).trim() : '';
  const supportBadge =
    supportBadgeCandidate && supportBadgeCandidate !== editorialBadge ? supportBadgeCandidate : null;
  const displayLocation = tour.city ?? tour.pickup.areaLabel ?? '';
  const displayTitle = tour.title;
  const displayImage =
    tour.imageUrl || 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80';
  // Show rating only when we actually have one. Previously this defaulted
  // to 4.5 when null — that printed a fake star on every card.
  const displayRating = typeof tour.rating === 'number' && tour.rating > 0 ? tour.rating : null;
  const displayReviewCount = tour.reviewCount ?? 0;
  const showRating = displayRating !== null;
  const displayDuration = formatTourDurationForCard(tour.duration, locale);
  const showBookingCount = tour.bookingCount != null && tour.bookingCount > 0;

  const tapTransition = {
    type: 'spring' as const,
    stiffness: 560,
    damping: 22,
    mass: 0.72,
  };
  const tapTarget = reduceMotion
    ? { scale: 1 }
    : {
        scale: 0.958,
        y: 4,
        filter: 'brightness(0.94)',
      };

  return (
    <div className="relative h-full [-webkit-tap-highlight-color:transparent]">
      <motion.div
        className="h-full origin-center"
        initial={false}
        whileTap={tapTarget}
        transition={tapTransition}
      >
        <Link
          href={detailHref}
          className={cn(
            'group h-full touch-manipulation overflow-hidden rounded-[1.6rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_16px_38px_-24px_rgba(15,23,42,0.34),0_4px_16px_-12px_rgba(15,23,42,0.16)]',
            'transition-[transform,box-shadow,border-color,filter,background-color] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-blue-200/80 hover:shadow-[0_30px_64px_-22px_rgba(15,23,42,0.42),0_16px_34px_-16px_rgba(59,130,246,0.22)]',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50',
            'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[0_16px_38px_-24px_rgba(15,23,42,0.34),0_4px_16px_-12px_rgba(15,23,42,0.16)]',
            isHorizontal ? 'flex flex-row' : 'block',
          )}
        >
          <div
            className={cn(
              'relative shrink-0 overflow-hidden',
              isHorizontal
                ? 'm-2.5 aspect-square w-[36%] min-w-[112px] max-w-[168px] rounded-2xl sm:m-3 sm:max-w-[188px]'
                : 'aspect-[4/3.15] w-full sm:aspect-[4/3.35]',
            )}
          >
            <Image
              src={displayImage}
              alt={displayTitle}
              fill
              sizes={imageSizes ?? (isHorizontal ? '180px' : '50vw')}
              /* The default stays lean for dense lists; large home cards
                 can opt into a sharper encode via imageQuality. */
              quality={imageQuality}
              className={cn(
                'object-cover transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100',
                'motion-reduce:transition-none',
              )}
              /* Editorial polish (atmosphere gallery / hero / drawer와 동일) — Vogue subtle filter.
                 inline filter는 Tailwind --tw-filter 변수 시스템을 override. */
              style={{ filter: 'saturate(1.08) contrast(1.06) brightness(0.99)' }}
              loading="lazy"
            />
            {/* S Tier #1 — Film grain noise (Kodak Portra 400 입자감, mix-blend overlay 0.12) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                opacity: 0.12,
              }}
            />
            {/* S Tier #2 — Soft vignette (radial corner darkening — 작은 카드라 0.15로 약하게) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)',
              }}
            />
            {!isHorizontal ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.375rem] bg-[linear-gradient(to_top,rgb(248,250,252)_0%,rgba(248,250,252,0.94)_18%,rgba(248,250,252,0.55)_42%,rgba(248,250,252,0.2)_68%,rgba(248,250,252,0.05)_88%,transparent_100%)] sm:h-6"
                aria-hidden
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-500/0 transition-colors duration-500 group-hover:to-blue-500/10" />
            <div
              className={cn(
                'absolute left-2 top-2 flex flex-col items-start gap-0.5',
                isHorizontal ? 'max-w-[calc(100%-16px)]' : 'max-w-[calc(100%-48px)]',
              )}
            >
          <div className="flex flex-wrap items-center gap-0.5">
            {editorialBadge ? (
              <span
                className={cn(
                  'inline-flex max-w-full items-center truncate rounded-full font-semibold uppercase shadow-sm',
                  isHorizontal
                    ? 'h-[16px] border border-white/15 bg-slate-900/95 px-1.5 text-[7px] font-bold tracking-[0.08em] text-white backdrop-blur-md'
                    : 'h-[18px] border border-orange-200 bg-orange-50 px-1.5 text-[8px] tracking-[0.04em] text-stone-800',
                )}
              >
                {editorialBadge}
              </span>
            ) : null}
            {showDiscountBadge && !isHorizontal ? (
              <span className="inline-flex h-[18px] items-center rounded-full border border-rose-700 bg-rose-600 px-1.5 text-[8px] font-bold uppercase tracking-[0.04em] text-white shadow-sm">
                {t('tourCard.discountOff', { percent: discountPct })}
              </span>
            ) : null}
          </div>
          {supportBadge ? (
            <span
              className={cn(
                'inline-flex max-w-full items-center truncate rounded-full leading-none shadow-sm',
                isHorizontal
                  ? 'h-[16px] border border-slate-200/60 bg-white/95 px-1.5 text-[7px] font-bold tracking-[0.02em] text-slate-900 backdrop-blur-md'
                  : 'h-[18px] border border-sky-200 bg-sky-50 px-1.5 text-[8px] font-semibold text-sky-950',
              )}
            >
              {supportBadge}
            </span>
          ) : null}
            </div>
          </div>
          <div
            className={cn(
              'relative z-[1] flex flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,252,0.96)_100%)]',
              isHorizontal
                ? 'min-w-0 flex-1 px-3 py-3 sm:px-4 sm:py-3.5'
                : '-mt-1 px-3 pb-3 pt-3 sm:-mt-1.5 sm:px-3.5 sm:pt-4',
            )}
          >
        <div
          className={cn(
            'flex items-center justify-between gap-2',
            isHorizontal ? 'mb-1 pr-9 sm:pr-10' : 'mb-1.5',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white/88 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.26)]">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 2.5a5.5 5.5 0 0 0-5.5 5.5c0 3.744 4.34 8.313 5.054 9.034a.625.625 0 0 0 .892 0C11.16 16.313 15.5 11.744 15.5 8A5.5 5.5 0 0 0 10 2.5Zm0 7.188A1.688 1.688 0 1 1 10 6.31a1.688 1.688 0 0 1 0 3.377Z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{displayLocation}</span>
          </span>
          {showBookingCount && !isHorizontal ? (
            <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50/90 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {formatBookingCount(tour.bookingCount!)} {t('tourCard.booked')}
            </span>
          ) : null}
        </div>
        <h3
          className={cn(
            'line-clamp-2 font-semibold tracking-[-0.026em] text-slate-950 transition-colors duration-300 group-hover:text-blue-700',
            isHorizontal
              ? 'text-[13.5px] leading-[1.4] sm:text-[15px]'
              : 'min-h-[2.84em] text-[12.5px] leading-[1.42] sm:text-[13.5px]',
          )}
        >
          {displayTitle}
        </h3>
        <div className={cn(isHorizontal && 'mt-auto')}>
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-600',
            isHorizontal ? 'mt-2' : 'mt-1.5',
          )}
        >
          {showRating ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50/90 px-2 py-0.5 font-medium text-amber-700">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.034 3.182a1 1 0 0 0 .95.69h3.347c.969 0 1.371 1.24.588 1.81l-2.708 1.967a1 1 0 0 0-.364 1.118l1.034 3.182c.3.922-.755 1.688-1.538 1.118l-2.708-1.967a1 1 0 0 0-1.176 0l-2.708 1.967c-.783.57-1.838-.196-1.539-1.118l1.035-3.182a1 1 0 0 0-.364-1.118L2.18 8.609c-.783-.57-.38-1.81.588-1.81h3.347a1 1 0 0 0 .951-.69l1.034-3.182Z" />
              </svg>
              <span className="font-semibold text-slate-900">{displayRating!.toFixed(1)}</span>
              {displayReviewCount > 0 ? (
                <span className="text-amber-700/80">({displayReviewCount.toLocaleString()})</span>
              ) : null}
            </span>
          ) : null}
          {displayDuration ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/85 bg-white/90 px-2 py-0.5 font-medium text-slate-600">
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.625-11.75a.625.625 0 1 0-1.25 0v4.009c0 .166.066.325.183.442l2.5 2.5a.625.625 0 1 0 .884-.884l-2.317-2.317V6.25Z" clipRule="evenodd" />
              </svg>
              <span>{displayDuration}</span>
            </span>
          ) : null}
          {showBookingCount && isHorizontal ? (
            <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50/90 px-2 py-0.5 font-medium text-slate-500">
              {formatBookingCount(tour.bookingCount!)} {t('tourCard.booked')}
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <div className="min-w-0">
            {originalStr ? (
              <p className={cn('font-medium text-slate-400 line-through', isHorizontal ? 'text-[11px]' : 'text-[10px]')}>{originalStr}</p>
            ) : null}
            <div className="flex items-baseline gap-1.5">
              <p
                className={cn(
                  'truncate font-semibold tracking-[-0.04em] text-slate-950',
                  isHorizontal ? 'text-[16px] sm:text-[18px]' : 'text-[14px] sm:text-[15px]',
                )}
              >
                {priceStr}
              </p>
              {showDiscountBadge ? (
                <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-[1px] text-[10.5px] font-bold leading-[1.2] text-rose-600 ring-1 ring-inset ring-rose-200">
                  -{discountPct}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
        </div>
          </div>
        </Link>
      </motion.div>

      {tourKey ? (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          <div data-tour-card-wishlist className="pointer-events-auto absolute right-2 top-2">
            <button
              type="button"
              onClick={handleWishlistClick}
              className="flex h-[27.6px] w-[27.6px] !min-h-0 !min-w-0 touch-manipulation items-center justify-center rounded-full bg-white/70 text-slate-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_2px_8px_rgba(0,0,0,0.22)] backdrop-blur-md transition-colors hover:bg-white/92 hover:text-rose-500"
              aria-label={saved ? t('tour.removeFromWishlist') : t('tourCard.save')}
            >
              {saved ? (
                <svg className="h-[13.8px] w-[13.8px] fill-current text-rose-500" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="h-[13.8px] w-[13.8px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(TourListCard);
