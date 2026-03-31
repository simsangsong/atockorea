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
  const displayBadge =
    (tour.tags[0] && String(tour.tags[0]).trim()) || typeLabel;
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
      className="group block h-full rounded-2xl overflow-hidden bg-white border border-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.1)] hover:border-gray-200 transition-all duration-300 transform hover:-translate-y-0.5"
    >
      <div className="relative w-full aspect-[4/3.2] sm:aspect-[4/3.5] overflow-hidden shrink-0">
        <Image
          src={displayImage}
          alt={displayTitle}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/80 via-white/25 to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
          {displayBadge ? (
            <span className="px-2 py-1 text-white text-[10px] font-semibold rounded-md shadow-sm leading-none bg-blue-600/95">
              {displayBadge}
            </span>
          ) : null}
          {showDiscountBadge ? (
            <span className="bg-red-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm leading-none">
              {t('tourCard.discountOff', { percent: discountPct })}
            </span>
          ) : null}
        </div>
        {tourKey ? (
          <div className="absolute top-3 right-3">
            <button
              type="button"
              onClick={handleWishlistClick}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md border border-gray-200/80 text-gray-600 hover:text-red-500 transition-colors touch-manipulation"
              aria-label={saved ? t('tour.removeFromWishlist') : t('tourCard.save')}
            >
              {saved ? (
                <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative px-4 pt-2 pb-3 border-l-4 border-l-transparent group-hover:border-l-blue-500/50 transition-colors">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
          <span className="shrink-0" aria-hidden>
            📍
          </span>
          <span className="truncate">{displayLocation}</span>
        </div>
        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug mb-1.5 group-hover:text-blue-700 transition-colors">
          {displayTitle}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mb-1">
          <span className="flex items-center gap-1">
            <span className="text-yellow-500" aria-hidden>
              ⭐
            </span>
            <span className="font-semibold text-gray-900">{displayRating.toFixed(1)}</span>
            {displayReviewCount > 0 ? (
              <span className="text-gray-500">({displayReviewCount.toLocaleString()})</span>
            ) : null}
          </span>
          {displayDuration ? (
            <span className="flex items-center gap-1">
              <span aria-hidden>🕒</span>
              <span>{displayDuration}</span>
            </span>
          ) : null}
        </div>
        {showBookingCount ? (
          <p className="text-[10px] text-gray-500 mb-1">
            {formatBookingCount(tour.bookingCount!)}{' '}
            {t('tourCard.booked')}
          </p>
        ) : null}
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          {originalStr ? (
            <span className="text-[11px] text-gray-400 line-through shrink-0">{originalStr}</span>
          ) : null}
          <span className="text-sm font-bold text-slate-700 truncate">{priceStr}</span>
        </div>
      </div>
    </Link>
  );
}

export default memo(TourListCard);
