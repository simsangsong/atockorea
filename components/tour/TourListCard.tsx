'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { TourCardViewModel, JoinVisibleStatus } from '@/src/types/tours';
import { COPY } from '@/src/design/copy';

const JOIN_STATUS_COPY: Record<JoinVisibleStatus, string> = {
  waiting: COPY.joinStatus.waiting,
  balance_open: COPY.joinStatus.balanceOpen,
  confirmed: COPY.joinStatus.confirmed,
  missed_deadline: COPY.joinStatus.missedDeadline,
  private_only: COPY.joinStatus.privateOnly,
  join_unavailable: COPY.joinStatus.joinUnavailable,
};

const TYPE_BADGE_COPY = {
  private: COPY.detail.badgePrivate,
  join: COPY.detail.badgeSmallGroup,
  bus: COPY.detail.badgeClassicBus,
} as const;

const MATCH_QUALITY_COPY = {
  great: COPY.pickupMatch.great,
  good: COPY.pickupMatch.good,
  slight: COPY.pickupMatch.slight,
} as const;

function formatPrice(priceFrom: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(priceFrom).toLocaleString('ko-KR')}`;
  return `₩${Math.round(priceFrom).toLocaleString('ko-KR')}`;
}

export interface TourListCardProps {
  tour: TourCardViewModel;
  detailHref: string;
  formatPriceFn?: (price: number) => string;
}

function TourListCard({ tour, detailHref, formatPriceFn }: TourListCardProps) {
  const priceStr = formatPriceFn ? formatPriceFn(tour.priceFrom) : formatPrice(tour.priceFrom, tour.currency);
  const typeLabel = TYPE_BADGE_COPY[tour.type];
  const matchLabel = tour.matchQuality ? MATCH_QUALITY_COPY[tour.matchQuality] : null;
  const joinStatusLabel = tour.joinStatus ? JOIN_STATUS_COPY[tour.joinStatus] : null;
  const imageUrl = tour.imageUrl || '';

  const cardInner = (
    <article className="mx-auto mb-4 w-[90%] max-w-3xl">
      <div
        className="group flex flex-col gap-3 sm:gap-4 rounded-3xl bg-white/95 border border-[#e5e5ea] shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-shadow duration-200 px-3 py-3 sm:px-4 sm:py-4"
      >
        <div className="flex flex-row gap-2 sm:gap-4">
          <div className="relative w-[46%] sm:w-[43%] aspect-[4/3] overflow-hidden rounded-xl sm:rounded-2xl bg-[#f2f2f7] flex-shrink-0 max-h-[120px] sm:max-h-none">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={tour.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 46vw, 43vw"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-[#e5e5ea]" aria-hidden />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
            <span
              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                tour.type === 'private'
                  ? 'bg-violet-100 text-violet-700'
                  : tour.type === 'join'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {typeLabel}
            </span>
            {tour.tags.length > 0 && (
              <p className="text-[11px] text-[#6e6e73] line-clamp-1">
                {tour.tags.slice(0, 3).join(' · ')}
              </p>
            )}
            <p className="text-[11px] text-[#3a3a3c]">{tour.pickup.areaLabel}</p>
            {matchLabel && (
              <p className="text-[10px] font-medium text-emerald-600">{matchLabel}</p>
            )}
            {tour.type === 'join' && joinStatusLabel && (
              <p className="text-[10px] font-medium text-[#0c66ff]">{joinStatusLabel}</p>
            )}
            {tour.type === 'join' && tour.travelersJoined != null && tour.maxTravelers != null && (
              <p className="text-[11px] text-[#6e6e73]">
                {tour.travelersJoined} / {tour.maxTravelers} travelers
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="line-clamp-2 text-[14px] sm:text-[15px] font-semibold text-[#111111]">
            {tour.title}
          </h3>
          {tour.pickup.surchargeLabel && (
            <p className="mt-0.5 text-[11px] text-[#6e6e73]">{tour.pickup.surchargeLabel}</p>
          )}
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">{COPY.listDetail.depositBalanceNote}</p>
          <div className="mt-1 flex items-baseline justify-end">
            <span className="text-[13px] sm:text-[14px] font-semibold text-[#0c66ff]">
              {priceStr}
            </span>
          </div>
          <div className="mt-2 flex justify-end">
            <span className="text-[12px] font-medium text-[#0c66ff]">
              {tour.type === 'join' ? COPY.listDetail.joinThisTour : COPY.listDetail.viewDetails}
            </span>
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <Link href={detailHref} className="block">
      {cardInner}
    </Link>
  );
}

export default memo(TourListCard);
