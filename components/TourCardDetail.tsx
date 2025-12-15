// components/TourCardDetail.tsx
import React, { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { DetailedTour } from "../data/tours";

type Props = {
  tour: DetailedTour;
};

function TourCardDetail({ tour }: Props) {
  // 도시별 상세페이지 라우트 자동 처리
  const basePath =
    tour.city === "Jeju"
      ? "/jeju"
      : tour.city === "Busan"
      ? "/busan"
      : "/seoul";

  const href = tour.slug ? `${basePath}/${tour.slug}` : "#";
  const clickable = Boolean(tour.slug);

  const CardInner = (
    <article className="mx-auto mb-4 w-[90%] max-w-3xl">
      <div
        className="
          group flex flex-col sm:flex-row
          gap-3 sm:gap-4
          rounded-3xl bg-white/95
          border border-[#e5e5ea]
          shadow-[0_8px_24px_rgba(0,0,0,0.03)]
          hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)]
          transition-shadow duration-200
          px-3 py-3 sm:px-4 sm:py-4
        "
      >
        {/* LEFT: 이미지 + 타이틀 + 가격 */}
        <div className="flex w-full flex-col sm:w-[32%]">
          <div className="relative w-full h-[180px] sm:h-[160px] md:h-[180px] overflow-hidden rounded-2xl bg-[#f2f2f7]">
            <Image
              src={tour.imageUrl}
              alt={tour.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, 32vw"
              loading="lazy"
            />
          </div>

          <div className="mt-2 sm:mt-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#86868b]">
              {tour.tag}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[14px] sm:text-[15px] font-semibold text-[#111111]">
              {tour.title}
            </h3>
            <p className="mt-1 text-[12px] sm:text-[13px] font-semibold text-[#0c66ff]">
              {tour.price}
            </p>
          </div>
        </div>

        {/* RIGHT: 정보 카드 + 샘플 일정 */}
        <div className="mt-2 flex-1 text-[11px] text-[#1c1c1e] sm:mt-0 sm:pl-1 sm:text-[13px]">
          {/* 2×2 info cards */}
          <div className="mb-2 grid grid-cols-2 gap-3 sm:mb-3 sm:gap-4">
            {/* Duration */}
            <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#0c66ff]" />
              <div>
                <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                  Duration
                </span>
                <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                  {tour.duration}
                </span>
              </div>
            </div>

            {/* Lunch */}
            <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              <div>
                <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                  Lunch
                </span>
                <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                  {tour.lunchIncluded ? "Included" : "Not included"}
                </span>
              </div>
            </div>

            {/* Tickets */}
            <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#ff9500]" />
              <div>
                <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                  Tickets
                </span>
                <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                  {tour.ticketIncluded ? "Included" : "Not included"}
                </span>
              </div>
            </div>

            {/* Pickup */}
            <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#5856d6]" />
              <div>
                <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                  Pickup
                </span>
                <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                  {tour.pickupInfo}
                </span>
              </div>
            </div>
          </div>

          {tour.notes && (
            <div className="mt-1 text-[11px] text-[#6e6e73] sm:text-[12px]">
              {tour.notes}
            </div>
          )}

          {/* Sample day plan */}
          {tour.schedule && tour.schedule.length > 0 && (
            <div className="mt-3">
              <span className="mb-1.5 block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                Sample day plan
              </span>
              <div className="rounded-2xl bg-[#f5f5f7] px-3 py-2 sm:px-3.5 sm:py-2.5">
                <ol className="space-y-1.5">
                  {tour.schedule.slice(0, 4).map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="flex flex-col items-center">
                        <span className="mt-[2px] h-2 w-2 rounded-full bg-[#0c66ff]" />
                        {index <
                          Math.min(tour.schedule?.length ?? 0, 4) - 1 && (
                          <span className="mt-0.5 h-5 w-px bg-[#d1d1d6]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-medium text-[#111111] sm:text-[12px]">
                            {item.time}
                          </span>
                          <span className="flex-1 text-right text-[11px] font-medium text-[#3a3a3c] sm:text-[12px] sm:text-left">
                            {item.title}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                  {tour.schedule.length > 4 && (
                    <li className="pt-1 text-[11px] text-[#6e6e73]">
                      + {tour.schedule.length - 4} more stops in the full
                      itinerary
                    </li>
                  )}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );

  if (!clickable) return CardInner;

  return (
    <Link href={href} className="block">
      {CardInner}
    </Link>
  );
}

export default memo(TourCardDetail);
