"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TourListCard from "@/components/tour/TourListCard";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import type { TourCardViewModel } from "@/src/types/tours";
import { consumerTourDetailHref } from "@/lib/tour-consumer-visibility";
import { inferTourCatalogType, tagsForCatalogType } from "@/lib/tour-catalog-type-infer";
import { useCurrencyOptional } from "@/lib/currency";
import { useI18n, useTranslations } from "@/lib/i18n";
import { HOME_CTA_BROWSE_TOURS_HREF } from "@/lib/home/home-cta-routes";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import { homeBtnSecondary } from "@/lib/home/home-button-classes";
import { analytics } from "@/src/design/analytics";
import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { cn } from "@/lib/utils";

const FEATURED_PRODUCT_SLUGS = [
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "busan-top-attractions-day-tour",
  "jeju-grand-highlights-loop",
  "seoul-suburbs-private-chartered-car-10hr",
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "jeju-island-private-car-charter-tour",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
] as const;
const FEATURED_LIMIT = FEATURED_PRODUCT_SLUGS.length;

type DestinationsApiResponse = {
  total?: number;
};

function isTourProductLocale(locale: string): locale is TourProductPageLocale {
  return (
    locale === "en" ||
    locale === "ko" ||
    locale === "zh" ||
    locale === "zh-TW" ||
    locale === "es" ||
    locale === "ja"
  );
}

function productToCard(product: StaticTourProductRegistration): TourCardViewModel {
  const type = inferTourCatalogType({
    title: product.title,
    badges: [...product.badges],
    slug: product.slug,
  });
  const originalPrice =
    typeof product.compareAtPriceUsd === "number" && product.compareAtPriceUsd > product.listPriceUsd
      ? product.compareAtPriceUsd
      : null;

  return {
    id: product.slug,
    slug: product.slug,
    title: product.title,
    type,
    tags: tagsForCatalogType([...product.badges], type),
    priceFrom: product.listPriceUsd,
    originalPrice,
    currency: "USD",
    pickup: {
      areaLabel: product.region,
      surchargeLabel: null,
      surchargeAmount: 0,
      surchargeFinal: false,
      joinAvailable: type === "join",
    },
    imageUrl: product.thumbnail || product.heroImage,
    duration: product.duration,
    city: product.region,
    rating: product.rating > 0 ? product.rating : undefined,
    reviewCount: product.reviewCount > 0 ? product.reviewCount : undefined,
  };
}

function buildStaticFeaturedTours(locale: string): TourCardViewModel[] {
  const productLocale = isTourProductLocale(locale) ? locale : "en";
  const bySlug = new Map(
    listStaticTourProducts(productLocale).map((product) => [product.slug, product]),
  );

  return FEATURED_PRODUCT_SLUGS
    .map((slug) => bySlug.get(slug))
    .filter((product): product is StaticTourProductRegistration => {
      if (!product) return false;
      if (product.listPriceUsd <= 0) return false;
      if (!product.thumbnail && !product.heroImage) return false;
      return consumerTourDetailHref(product.slug, product.slug) !== "/tours/list";
    })
    .map(productToCard);
}

/**
 * "Most loved this week" product rail.
 *
 * The rail starts with static catalog cards so a slow live API cannot leave a
 * blank white section. When /api/tours responds quickly, the cards are swapped
 * to live list data.
 */
export function FeaturedProductsShowcase() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fallbackTours = useMemo(() => buildStaticFeaturedTours(locale), [locale]);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const tours = fallbackTours;

  const formatPrice = useCallback(
    (priceUsd: number) => {
      if (currencyCtx) return currencyCtx.formatPrice(priceUsd);
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(priceUsd);
    },
    [currencyCtx],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/tours/destinations", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<DestinationsApiResponse>) : null))
      .then((data) => {
        if (!data || typeof data.total !== "number") return;
        setTotalCount(data.total);
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, []);

  if (tours.length < 3) return null;

  return (
    <section className="relative overflow-hidden bg-white px-4 section-py-md md:px-6">
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-7 text-center md:mb-9">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.featuredProducts.eyebrow")}
          </p>
          <h2 className="mb-2 text-h2 text-slate-900">
            {t("premium.v2.featuredProducts.title")}{" "}
            <span className="font-extrabold text-amber-700">
              {t("premium.v2.featuredProducts.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-lg text-body text-slate-600">
            {t("premium.v2.featuredProducts.subtitle")}
          </p>
        </div>

        <div className="relative -mx-4 md:mx-0">
          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0"
          >
            {tours.slice(0, FEATURED_LIMIT).map((tour, index) => (
              <div
                key={`${tour.id}-${index}`}
                className="w-[44vw] flex-shrink-0 snap-start md:w-auto"
                onClick={() =>
                  analytics.homeFeaturedCardClick({
                    source: "regular_section",
                    slug: tour.slug ?? tour.id,
                  })
                }
              >
                <TourListCard
                  tour={tour}
                  detailHref={consumerTourDetailHref(tour.id, tour.slug)}
                  formatPriceFn={formatPrice}
                  imageSizes="(min-width: 768px) 384px, 44vw"
                  imageQuality={90}
                />
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/90 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots
          containerRef={scrollRef}
          count={Math.min(tours.length, FEATURED_LIMIT)}
        />

        <div className="mt-8 text-center md:mt-10">
          <V0ShadcnButton
            asChild
            variant="outline"
            className={cn(homeBtnSecondary, "inline-flex w-auto items-center gap-2 px-6")}
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
