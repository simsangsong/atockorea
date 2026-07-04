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
import { adaptToursListResponse } from "@/src/lib/adapters/tours-adapter";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import { homeBtnSecondary } from "@/lib/home/home-button-classes";
import { analytics } from "@/src/design/analytics";
import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import { cn } from "@/lib/utils";

import { FEATURED_PRODUCT_SLUGS } from "./featured-product-slugs";
const FEATURED_LIMIT = FEATURED_PRODUCT_SLUGS.length;

type LiveFeaturedToursState = {
  locale: string;
  tours: TourCardViewModel[];
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

function buildStaticFeaturedTours(
  locale: string,
  mediaBySlug?: TourProductCardMediaMap,
): TourCardViewModel[] {
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
    .map((product) => {
      const card = productToCard(product);
      // Server-resolved admin override (PR #92): if the SSR pre-fetch
      // gave us the freshest thumbnail URL for this slug, swap it onto
      // the card BEFORE first paint so the rail never flashes the
      // build-time static image and then flips to the admin-saved one.
      const adminImage = mediaBySlug?.[product.slug]?.cardImageUrl;
      if (adminImage && adminImage !== card.imageUrl) {
        return { ...card, imageUrl: adminImage };
      }
      return card;
    });
}

function cardSlug(tour: TourCardViewModel): string {
  return tour.slug?.trim() || tour.id;
}

function mergeLiveCardMedia(
  fallbackTours: TourCardViewModel[],
  liveTours: TourCardViewModel[] | null,
): TourCardViewModel[] {
  if (!liveTours || liveTours.length === 0) return fallbackTours;

  const liveBySlug = new Map<string, TourCardViewModel>();
  for (const tour of liveTours) {
    const slug = cardSlug(tour);
    if (slug && tour.imageUrl) liveBySlug.set(slug, tour);
  }

  return fallbackTours.map((fallback) => {
    const live = liveBySlug.get(cardSlug(fallback));
    if (!live?.imageUrl || live.imageUrl === fallback.imageUrl) return fallback;
    return { ...fallback, imageUrl: live.imageUrl };
  });
}

/**
 * "Most loved this week" product rail.
 *
 * The rail keeps its curated static slug order, then overlays live admin media
 * from /api/tours so product dashboard image edits surface on the landing page.
 *
 * `initialMediaBySlug` is the server-rendered admin-media snapshot for the
 * featured slugs (resolved in HomeV2Page via `loadTourProductCardMediaBySlug`).
 * Without it the rail first paints with the build-time static catalog
 * thumbnail and then flips to the admin-saved image once the client effect
 * resolves — visible flash on every navigation. With it the very first
 * render already has the freshest URL.
 */
export type FeaturedProductsShowcaseProps = {
  initialMediaBySlug?: TourProductCardMediaMap;
};

export function FeaturedProductsShowcase({
  initialMediaBySlug,
}: FeaturedProductsShowcaseProps = {}) {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fallbackTours = useMemo(
    () => buildStaticFeaturedTours(locale, initialMediaBySlug),
    [locale, initialMediaBySlug],
  );

  const [liveToursState, setLiveToursState] = useState<LiveFeaturedToursState | null>(null);
  const liveToursForLocale = liveToursState?.locale === locale ? liveToursState.tours : null;
  const tours = useMemo(
    () => mergeLiveCardMedia(fallbackTours, liveToursForLocale),
    [fallbackTours, liveToursForLocale],
  );

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

    const params = new URLSearchParams({
      compact: "1",
      limit: "300",
      locale,
      useScoreSort: "false",
    });

    fetch(`/api/tours?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setLiveToursState({ locale, tours: adaptToursListResponse(data) });
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [locale]);

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
            className="flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto pb-2 pl-6 pr-10 scrollbar-hide md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0"
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
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/65 to-transparent md:hidden"
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
              {t("premium.v2.featuredProducts.viewAllCtaGeneric")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </V0ShadcnButton>
        </div>
      </div>
    </section>
  );
}
