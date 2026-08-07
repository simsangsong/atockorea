"use client";

/**
 * "You might also like" — restyled to the My-page recommendation grid
 * (`components/mypage/landing/RecommendedTours.tsx`) per direction 2026-08-04
 * ("마이 페이지 밑에 상품그리드 스타일로"): compact snap-scroll cards sharing the
 * my-page surface/focus tokens — photo with a small rating pill, title, region +
 * duration meta, bold price — instead of the old wide overlay-gradient cards.
 * Data plumbing (catalog registrations + admin card media + currency) unchanged.
 */

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  hrefStaticTourProductDetail,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { ClockIcon, MapIcon, StarIcon } from "@/components/Icons";
import { MYPAGE_FOCUS_RING, MYPAGE_SURFACE_PAGE } from "@/lib/mypage-ui";
import { useCurrencyOptional } from "@/lib/currency";
import { useI18n, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import {
  getCardImageFromAdminMedia,
  useTourProductCardMedia,
} from "@/hooks/useTourProductCardMedia";

export type TourRecommendationsSectionProps = {
  recommendations: readonly StaticTourProductRegistration[];
  /** Optional sectionUi for localized header copy. */
  sectionUi?: TourProductSectionUiV1;
};

export function TourRecommendationsSection({ recommendations, sectionUi }: TourRecommendationsSectionProps) {
  const currencyCtx = useCurrencyOptional();
  const t = useTranslations();
  const { locale } = useI18n();
  const recommendationSlugs = useMemo(
    () => recommendations.map((rec) => rec.slug),
    [recommendations],
  );
  const mediaBySlug = useTourProductCardMedia(recommendationSlugs, locale);

  if (recommendations.length === 0) return null;

  const title = sectionUi?.recommendationsTitle ?? "You might also like";
  const subtitle =
    sectionUi?.recommendationsSubtitle ?? "Different pacing, different emphasis. Each is its own day.";

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-[#0f172a]">{title}</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>
        </div>
        <Link
          href="/tours/list"
          className={cn(
            "shrink-0 whitespace-nowrap text-[12px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline",
            MYPAGE_FOCUS_RING,
          )}
        >
          {t("mypage.viewAll")} →
        </Link>
      </div>

      <div className="-mx-1 min-w-0 px-1 sm:mx-0 sm:px-0">
        <div
          className={cn(
            "snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-2",
            "[scrollbar-gutter:stable] scrollbar-hide",
          )}
        >
          <div className="flex w-max shrink-0 flex-nowrap gap-2.5 pr-4 sm:gap-3 sm:pr-2">
            {recommendations.map((rec) => {
              const rawSrc = rec.thumbnail?.trim() || rec.heroImage?.trim() || "";
              const mediaSrc = rawSrc.length > 0
                ? getCardImageFromAdminMedia(rec.slug, rawSrc, mediaBySlug)
                : "";
              const priceFormatted = currencyCtx
                ? currencyCtx.formatPrice(rec.listPriceUsd)
                : `$${rec.listPriceUsd}`;
              return (
                <Link
                  key={rec.slug}
                  href={hrefStaticTourProductDetail(rec.slug)}
                  className={cn(
                    MYPAGE_SURFACE_PAGE,
                    "group relative flex flex-shrink-0 snap-start flex-col overflow-hidden",
                    "w-[min(11.75rem,_calc(100vw-6rem))] min-w-[min(11.75rem,_calc(100vw-6rem))]",
                    "sm:w-[12rem] sm:min-w-[12rem]",
                    "transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.14)]",
                    MYPAGE_FOCUS_RING,
                  )}
                >
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-[5/3]">
                    {mediaSrc.length > 0 ? (
                      <Image
                        src={mediaSrc}
                        alt={rec.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        sizes="172px, (min-width: 640px) 192px"
                      />
                    ) : (
                      <div aria-hidden className="h-full w-full bg-gradient-to-br from-muted via-muted/80 to-muted/60" />
                    )}
                    {rec.rating > 0 && (
                      <span className="pointer-events-none absolute left-2 top-2 z-[1] inline-flex max-w-[min(10rem,calc(100%-0.75rem))] flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold leading-tight text-slate-800 shadow sm:text-[11px]">
                        <StarIcon className="h-2.5 w-2.5 shrink-0 text-amber-500 sm:h-3 sm:w-3" />
                        <span className="break-all">
                          {rec.rating.toFixed(1)}
                          {rec.reviewCount > 0 && (
                            <span className="text-slate-500"> ({rec.reviewCount})</span>
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 p-2.5 sm:p-3">
                    <h3 className="line-clamp-3 break-words text-[12px] font-semibold leading-snug text-[#0f172a] sm:text-[13px]">
                      {rec.title}
                    </h3>
                    <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-0.5 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
                      {rec.region && (
                        <span className="inline-flex min-w-0 max-w-full items-start gap-0.5 break-words hyphens-auto [overflow-wrap:anywhere] [&>svg]:mt-px">
                          <MapIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                          <span>{rec.region}</span>
                        </span>
                      )}
                      {rec.duration && (
                        <span className="inline-flex shrink-0 items-center gap-0.5">
                          <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {rec.duration}
                        </span>
                      )}
                    </div>
                    <p className="pt-0.5 text-[12.5px] font-bold tabular-nums text-[#0f172a] sm:text-[14px]">
                      {priceFormatted}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
