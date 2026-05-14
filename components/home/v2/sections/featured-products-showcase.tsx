"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TourListCard from "@/components/tour/TourListCard";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { adaptToursListResponse } from "@/src/lib/adapters/tours-adapter";
import type { TourCardViewModel } from "@/src/types/tours";
import { consumerTourDetailHref } from "@/lib/tour-consumer-visibility";
import { useCurrencyOptional } from "@/lib/currency";
import { useI18n, useTranslations } from "@/lib/i18n";
import { HOME_CTA_BROWSE_TOURS_HREF } from "@/lib/home/home-cta-routes";

const FEATURED_LIMIT = 6;

type DestinationsApiResponse = {
  total?: number;
};

/**
 * "Most loved this week" popular product rail.
 * Reuses production `<TourListCard>` so
 * card pricing/currency/wishlist behaviour matches `/tours/list`. Hides itself
 * silently when fewer than 3 tours are returned (avoids a sad half-row).
 */
export function FeaturedProductsShowcase() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const containerRef = useRef<HTMLDivElement>(null);

  const [tours, setTours] = useState<TourCardViewModel[] | null>(null);
  const [error, setError] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const formatPrice = useCallback(
    (priceUsd: number) => {
      if (currencyCtx) return currencyCtx.formatPrice(priceUsd);
      return `₩${Math.round(priceUsd).toLocaleString("ko-KR")}`;
    },
    [currencyCtx],
  );

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add("visible");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      sortBy: "popular",
      limit: String(FEATURED_LIMIT),
      locale,
      compact: "1",
    });
    fetch(`/api/tours?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { tours: [] }))
      .then((data) => {
        if (controller.signal.aborted) return;
        const adapted = adaptToursListResponse(data);
        // Data guard — only render tours that have a real price, image, and title.
        // Half-populated cards (₩0, missing thumbnail) erode trust on the homepage.
        const validTours = adapted.filter((tour) => {
          const hasPrice = typeof tour.priceFrom === "number" && tour.priceFrom > 0;
          const hasImage = Boolean(tour.imageUrl);
          const hasTitle = Boolean(tour.title && tour.title.trim());
          return hasPrice && hasImage && hasTitle;
        });
        setTours(validTours);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err && (err.name === "AbortError" || err.code === 20)) return;
        setError(true);
      });

    fetch("/api/tours/destinations", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<DestinationsApiResponse>) : null))
      .then((data) => {
        if (!data || typeof data.total !== "number") return;
        setTotalCount(data.total);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [locale]);

  if (error) return null;
  if (tours != null && tours.length < 3) return null;

  return (
    <section className="relative overflow-hidden px-4 py-12 md:px-6 md:py-16 bg-white border-t border-slate-100">

      <div ref={containerRef} className="relative mx-auto max-w-6xl scroll-animate">
        <div className="mb-7 text-center md:mb-9">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-gradient-to-b from-white/95 to-stone-50/80 px-3.5 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_36px_-22px_rgba(15,23,42,0.14)] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
              {t("premium.v2.featuredProducts.eyebrow")}
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl lg:text-3xl">
            {t("premium.v2.featuredProducts.title")}{" "}
            <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 bg-clip-text font-extrabold text-transparent">
              {t("premium.v2.featuredProducts.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-lg text-[13px] font-medium leading-relaxed text-slate-600 md:text-[14px]">
            {t("premium.v2.featuredProducts.subtitle")}
          </p>
        </div>

        {tours == null ? (
          <SkeletonGrid />
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
            {tours.slice(0, FEATURED_LIMIT).map((tour) => (
              <div
                key={tour.id}
                className="w-[44vw] flex-shrink-0 snap-start md:w-auto"
              >
                <TourListCard
                  tour={tour}
                  detailHref={consumerTourDetailHref(tour.id, tour.slug)}
                  formatPriceFn={formatPrice}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center md:mt-10">
          <V0ShadcnButton
            asChild
            variant="outline"
            className="inline-flex h-auto items-center gap-2 rounded-xl border-slate-200/80 bg-white/95 px-6 py-2.5 font-semibold text-slate-800 backdrop-blur-sm transition-all hover:border-slate-300/90 hover:bg-white"
          >
            <Link href={HOME_CTA_BROWSE_TOURS_HREF}>
              {totalCount != null && totalCount > 0
                ? t("premium.v2.featuredProducts.viewAllCtaParam", { count: totalCount })
                : t("premium.v2.featuredProducts.viewAllCtaGeneric")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </V0ShadcnButton>
        </div>
      </div>
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-hidden px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:px-0 md:pb-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="w-[44vw] flex-shrink-0 animate-pulse overflow-hidden rounded-[1.6rem] border border-white/80 bg-white shadow-[0_16px_38px_-24px_rgba(15,23,42,0.34)] md:w-auto"
        >
          <div className="aspect-[4/3.15] w-full bg-slate-200/70 sm:aspect-[4/3.35]" />
          <div className="space-y-2 p-3">
            <div className="h-2.5 w-3/4 rounded bg-slate-200/70" />
            <div className="h-2.5 w-1/2 rounded bg-slate-200/70" />
            <div className="mt-2 h-4 w-1/3 rounded bg-slate-200/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
