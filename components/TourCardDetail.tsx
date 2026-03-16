'use client';
// components/TourCardDetail.tsx
import React, { memo, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { DetailedTour, ScheduleItem } from "../data/tours";
import { useTranslations } from "@/lib/i18n";

type Props = {
  tour: DetailedTour;
  /** When provided (e.g. for API tours), use this link instead of city/slug path */
  detailHref?: string;
};

/** 픽업 항목 제외한 일정만 (제목·일정 이름 나열용) */
function isPickupScheduleItem(title: string): boolean {
  const t = (title || "").trim().toLowerCase();
  return (
    /^pickup\s|hotel\s*pickup|픽업|接送|接機|接机|取貨|取货/i.test(t) ||
    t.includes("pickup point") ||
    t.includes("meeting point")
  );
}

const TIMELINE_DOT_COLORS = ["#0EA5E9", "#f97316"] as const;
/** 사진 높이에 맞춰 표시할 일정 개수, 초과분은 "+n more spots"로 요약 */
const MAX_VISIBLE_ITINERARY = 4;

function TourCardDetail({ tour, detailHref }: Props) {
  const t = useTranslations();

  const basePath =
    tour.city === "Jeju"
      ? "/jeju"
      : tour.city === "Busan"
      ? "/busan"
      : "/seoul";

  const href = detailHref ?? (tour.slug ? `${basePath}/${tour.slug}` : "#");
  const clickable = Boolean(detailHref || tour.slug);

  /** 픽업 제외 일정 이름만 (오른쪽 타임라인용) */
  const scheduleNamesOnly = useMemo(() => {
    if (!tour.schedule || tour.schedule.length === 0) return [];
    return tour.schedule
      .filter((item: ScheduleItem) => !isPickupScheduleItem(item.title))
      .map((item: ScheduleItem) => item.title);
  }, [tour.schedule]);

  /** 픽업: 수동 키 → 번역, 수동 문구 → 그대로, 없으면 개수 표시 (다국어) */
  const pickupCount = tour.pickupPointsCount ?? 0;
  const pickupLabel = tour.pickupDisplayKey ? t(`tourCard.${tour.pickupDisplayKey}`) : (tour.pickupDisplay ?? (pickupCount === 1 ? t("tourCard.pickupPointsCountOne", { count: 1 }) : t("tourCard.pickupPointsCountOther", { count: pickupCount })));

  const CardInner = (
    <article className="mx-auto mb-4 w-[90%] max-w-3xl">
      <div
        className="
          group flex flex-col
          gap-3 sm:gap-4
          rounded-3xl bg-white/95
          border border-[#e5e5ea]
          shadow-[0_8px_24px_rgba(0,0,0,0.03)]
          hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)]
          transition-shadow duration-200
          px-3 py-3 sm:px-4 sm:py-4
        "
      >
        {/* 제목 위: 좌 사진(모바일에서도 축소), 우 일정 이름 + 타임라인 */}
        <div className="flex flex-row gap-2 sm:gap-4">
          <div className="relative w-[46%] sm:w-[43%] aspect-[4/3] sm:aspect-[4/3.5] overflow-hidden rounded-xl sm:rounded-2xl bg-[#f2f2f7] flex-shrink-0 max-h-[120px] sm:max-h-none">
            <Image
              src={tour.imageUrl}
              alt={tour.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 46vw, 43vw"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
            {scheduleNamesOnly.length === 0 ? (
              <p className="text-[11px] text-[#6e6e73]">{t("tourCard.noItinerary")}</p>
            ) : (
              <>
                <ul className="flex flex-col">
                  {scheduleNamesOnly
                    .slice(0, MAX_VISIBLE_ITINERARY)
                    .map((name, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                          <span
                            className="w-2 h-2.5 sm:w-2.5 sm:h-3 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: TIMELINE_DOT_COLORS[index % 2],
                            }}
                            aria-hidden
                          />
                          {index < Math.min(scheduleNamesOnly.length, MAX_VISIBLE_ITINERARY) - 1 && (
                            <span
                              className="w-px h-4 sm:h-5 mt-0.5 bg-[#d1d1d6] flex-shrink-0"
                              aria-hidden
                            />
                          )}
                        </div>
                        <span className="text-[11px] sm:text-[12px] font-medium text-[#1c1c1e] pt-px">
                          {name}
                        </span>
                      </li>
                    ))}
                </ul>
                {scheduleNamesOnly.length > MAX_VISIBLE_ITINERARY && (
                  <p className="text-[11px] text-[#6e6e73] mt-1.5 pl-[22px] sm:pl-7">
                    {t("tourCard.moreSpots", { count: scheduleNamesOnly.length - MAX_VISIBLE_ITINERARY })}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* 제목 + 가격 (가격은 오른쪽 정렬, 할인전·할인후·할인율) */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#86868b]">
            {tour.tag}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[14px] sm:text-[15px] font-semibold text-[#111111]">
            {tour.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
            {tour.originalPrice && (
              <span className="text-[12px] sm:text-[13px] text-[#86868b] line-through">
                {tour.originalPrice}
              </span>
            )}
            <span className="text-[13px] sm:text-[14px] font-semibold text-[#0c66ff]">
              {tour.price}
            </span>
            {tour.discountPercent != null && tour.discountPercent > 0 && (() => {
              const label = t("tourCard.discountOff", { percent: tour.discountPercent });
              const display = (label && label !== "tourCard.discountOff") ? label : `${tour.discountPercent}% OFF`;
              return (
                <span className="text-[11px] sm:text-[12px] font-semibold text-red-500">
                  {display}
                </span>
              );
            })()}
          </div>
        </div>

        {/* 제목 밑: Duration, Lunch, Tickets, Pickup 지역 갯수 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
            <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#0c66ff] shrink-0" />
            <div>
              <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                {t("tourCard.duration")}
              </span>
              <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                {tour.duration}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
            <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#34c759] shrink-0" />
            <div>
              <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                {t("tourCard.lunch")}
              </span>
              <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                {tour.lunchIncluded ? t("tourCard.included") : t("tourCard.notIncluded")}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
            <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#ff9500] shrink-0" />
            <div>
              <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                {t("tourCard.tickets")}
              </span>
              <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                {tour.ticketIncluded ? t("tourCard.included") : t("tourCard.notIncluded")}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2.5 sm:px-3.5 sm:py-3">
            <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#5856d6] shrink-0" />
            <div>
              <span className="block text-[11px] font-semibold text-[#3a3a3c] sm:text-[12px]">
                {t("tourCard.pickup")}
              </span>
              <span className="text-[11px] text-[#1c1c1e] sm:text-[13px]">
                {pickupLabel}
              </span>
            </div>
          </div>
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
