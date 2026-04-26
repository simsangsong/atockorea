'use client';

import React, { memo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { TourCardViewModel } from '@/src/types/tours';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { formatTourDurationForCard } from '@/lib/tour-duration-display';
import { isInWishlistLocal, toggleWishlistLocal } from '@/lib/wishlist';

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
}

function TourListCard({ tour, detailHref, formatPriceFn }: TourListCardProps) {
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

  useEffect(() => {
    if (!tourKey) return;
    setSaved(isInWishlistLocal(tourKey));
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
  const displayRating = tour.rating ?? 4.5;
  const displayReviewCount = tour.reviewCount ?? 0;
  const displayDuration = formatTourDurationForCard(tour.duration, locale);
  const showBookingCount = tour.bookingCount != null && tour.bookingCount > 0;

  return (
    <Link
      href={detailHref}
      className="group block h-full overflow-hidden rounded-[1.6rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_16px_38px_-24px_rgba(15,23,42,0.34),0_4px_16px_-12px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:shadow-[0_22px_52px_-26px_rgba(15,23,42,0.38),0_12px_26px_-16px_rgba(15,23,42,0.18)]"
    >
      <div className="relative aspect-[4/3.15] w-full shrink-0 overflow-hidden sm:aspect-[4/3.35]">
        <Image
          src={displayImage}
          alt={displayTitle}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/30 via-slate-900/10 to-transparent" />
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-48px)] flex-col items-start gap-0.5">
          <div className="flex flex-wrap items-center gap-0.5">
            {editorialBadge ? (
              <span className="inline-flex h-[18px] max-w-full items-center truncate rounded-full border border-orange-200 bg-orange-50 px-1.5 text-[8px] font-semibold uppercase tracking-[0.04em] text-stone-800 shadow-sm">
                {editorialBadge}
              </span>
            ) : null}
            {showDiscountBadge ? (
              <span className="inline-flex h-[18px] items-center rounded-full border border-rose-700 bg-rose-600 px-1.5 text-[8px] font-bold uppercase tracking-[0.04em] text-white shadow-sm">
                {t('tourCard.discountOff', { percent: discountPct })}
              </span>
            ) : null}
          </div>
          {supportBadge ? (
            <span className="inline-flex h-[18px] max-w-full items-center truncate rounded-full border border-sky-200 bg-sky-50 px-1.5 text-[8px] font-semibold leading-none text-sky-950 shadow-sm">
              {supportBadge}
            </span>
          ) : null}
        </div>
        {tourKey ? (
          <div className="absolute right-2 top-2">
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
        ) : null}
      </div>
      <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,252,0.96)_100%)] px-3 pb-3 pt-2.5 sm:px-3.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white/88 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.26)]">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 2.5a5.5 5.5 0 0 0-5.5 5.5c0 3.744 4.34 8.313 5.054 9.034a.625.625 0 0 0 .892 0C11.16 16.313 15.5 11.744 15.5 8A5.5 5.5 0 0 0 10 2.5Zm0 7.188A1.688 1.688 0 1 1 10 6.31a1.688 1.688 0 0 1 0 3.377Z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{displayLocation}</span>
          </span>
          {showBookingCount ? (
            <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50/90 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {formatBookingCount(tour.bookingCount!)} {t('tourCard.booked')}
            </span>
          ) : null}
        </div>
        <h3 className="line-clamp-2 min-h-[2.84em] text-[12.5px] font-semibold leading-[1.42] tracking-[-0.026em] text-slate-950 transition-colors group-hover:text-slate-700 sm:text-[13.5px]">
          {displayTitle}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50/90 px-2 py-0.5 font-medium text-amber-700">
            <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.034 3.182a1 1 0 0 0 .95.69h3.347c.969 0 1.371 1.24.588 1.81l-2.708 1.967a1 1 0 0 0-.364 1.118l1.034 3.182c.3.922-.755 1.688-1.538 1.118l-2.708-1.967a1 1 0 0 0-1.176 0l-2.708 1.967c-.783.57-1.838-.196-1.539-1.118l1.035-3.182a1 1 0 0 0-.364-1.118L2.18 8.609c-.783-.57-.38-1.81.588-1.81h3.347a1 1 0 0 0 .951-.69l1.034-3.182Z" />
            </svg>
            <span className="font-semibold text-slate-900">{displayRating.toFixed(1)}</span>
            {displayReviewCount > 0 ? (
              <span className="text-amber-700/80">({displayReviewCount.toLocaleString()})</span>
            ) : null}
          </span>
          {displayDuration ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/85 bg-white/90 px-2 py-0.5 font-medium text-slate-600">
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.625-11.75a.625.625 0 1 0-1.25 0v4.009c0 .166.066.325.183.442l2.5 2.5a.625.625 0 1 0 .884-.884l-2.317-2.317V6.25Z" clipRule="evenodd" />
              </svg>
              <span>{displayDuration}</span>
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <div className="min-w-0">
            {originalStr ? (
              <p className="text-[10px] font-medium text-slate-400 line-through">{originalStr}</p>
            ) : null}
            <p className="truncate text-[14px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[15px]">
              {priceStr}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default memo(TourListCard);
