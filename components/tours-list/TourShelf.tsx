"use client";

/**
 * Horizontal scroll-snap shelf for the curated `/tours/list` default entry
 * (Phase 7.2, B33).
 *
 * The container is pure CSS `scroll-snap-type: x mandatory` — no carousel
 * library (B12) — and renders each tour through the canonical `TourListCard`
 * (vertical layout) so the shelf cards look the same as the home featured
 * grid and the flat-grid view.
 *
 * Empty shelves are dropped upstream by `getShelvesForDate`; this component
 * still defends with an explicit `tours.length === 0` short-circuit.
 */

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import TourListCard from "@/components/tour/TourListCard";
import { useI18n, useTranslations } from "@/lib/i18n";
import {
  inferTourCatalogType,
  tagsForCatalogType,
} from "@/lib/tour-catalog-type-infer";
import { consumerTourDetailHref } from "@/lib/tour-consumer-visibility";
import type { TourCardViewModel } from "@/src/types/tours";
import { cn } from "@/lib/utils";
import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { Shelf } from "@/lib/tours-shelves";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import { getCardImageFromAdminMedia } from "@/hooks/useTourProductCardMedia";

void Image; // future: shelf hero image (Phase 7.5+); avoid unused-import linter

/** Card width on shelves. Smaller than the 78vw mobile cards from the flat
 *  grid so the next card's edge peeks in — the horizontal-scroll affordance
 *  reads at a glance and the catalog reads visually broader. */
const SHELF_CARD_WIDTH = "min(64vw, 232px)";
const SHELF_CARD_IMAGE_SIZES = "(min-width: 768px) 232px, 64vw";

/**
 * Mirrors the home featured-grid adapter at
 * `components/home/v2/sections/featured-products-showcase.tsx#productToCard`
 * so card visuals stay consistent across surfaces. Kept local for now — when
 * the matcher / catalog / shelf surfaces all need this, lift to
 * `lib/tour-card-adapter.ts`.
 */
function staticRegistrationToCardViewModel(
  product: StaticTourProductRegistration,
): TourCardViewModel {
  const type = inferTourCatalogType({
    title: product.title,
    badges: [...product.badges],
    slug: product.slug,
  });
  const originalPrice =
    typeof product.compareAtPriceUsd === "number" &&
    product.compareAtPriceUsd > product.listPriceUsd
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

function formatCountdownDate(iso: string, locale: string): string {
  // ISO "YYYY-MM-DD" → locale-formatted short date. We avoid `new Date(iso)`
  // because it interprets bare ISO as UTC which can roll back a day in JST/KST
  // when displayed locale-side. Manual parse keeps the user-visible date stable.
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  try {
    return dt.toLocaleDateString(locale === "ko" ? "ko-KR" : locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

export type TourShelfProps = {
  shelf: Shelf;
  /** Optional surface above the cards (used by Coming Soon to show D-N + open date). */
  className?: string;
  mediaBySlug?: TourProductCardMediaMap;
};

export function TourShelf({ shelf, className, mediaBySlug }: TourShelfProps) {
  const { locale } = useI18n();
  const t = useTranslations();
  const titleKey = `toursList.shelves.${shelf.labelI18nKey}`;
  const subtitleKey = shelf.subtitleI18nKey ? `toursList.shelves.${shelf.subtitleI18nKey}` : null;
  const title = t(titleKey);
  const subtitle = subtitleKey ? t(subtitleKey) : null;

  const seasonBadge = useMemo(() => {
    if (!shelf.season) return null;
    if (shelf.key === "coming-soon") {
      const open = formatCountdownDate(shelf.season.startDate, locale);
      const dn = shelf.season.daysUntilStart;
      return locale === "ko"
        ? `예약 오픈 ${open} · D-${dn}`
        : `Booking opens ${open} · D-${dn}`;
    }
    if (shelf.key === "now-seasonal") {
      const ends = formatCountdownDate(shelf.season.endDate, locale);
      return locale === "ko" ? `시즌 운영 ~${ends}` : `Now through ${ends}`;
    }
    return null;
  }, [shelf.key, shelf.season, locale]);

  const eyebrowLabel =
    shelf.key === "editors-pick"
      ? locale === "ko"
        ? "에디터스 픽"
        : "Editor's Pick"
      : shelf.key === "now-seasonal"
        ? locale === "ko"
          ? "지금 시즌"
          : "Now Seasonal"
        : shelf.key === "coming-soon"
          ? locale === "ko"
            ? "곧 시작"
            : "Coming Soon"
          : locale === "ko"
            ? "큐레이션"
            : "Curated";

  if (shelf.tours.length === 0) return null;

  return (
    <section className={cn("relative", className)}>
      <header className="mb-7 px-4 sm:mb-9 sm:px-5">
        {/* Eyebrow row: amber hair-rule + uppercase label. Carries the Phase 1
            hero family (amber-700 + 0.24em tracking + thin gold prefix). */}
        <div className="flex items-center gap-3">
          <span aria-hidden className="block h-px w-8 bg-amber-500/80 sm:w-10" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.26em] text-amber-700">
            {shelf.key === "editors-pick" ? (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" aria-hidden />
                {eyebrowLabel}
              </span>
            ) : (
              eyebrowLabel
            )}
          </p>
        </div>
        {/* Display headline — upright serif (Noto Serif KR / Cormorant Garamond),
            larger size + breathing space below the eyebrow.  italic banned (B18). */}
        <h2
          className={cn(
            "mt-5 font-magazine-serif-ko font-semibold leading-[1.12] text-stone-900",
            "text-[28px] tracking-[-0.018em] sm:mt-6 sm:text-[34px] sm:tracking-[-0.02em] lg:text-[40px]",
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-[13.5px] leading-[1.7] text-stone-500 sm:mt-5 sm:text-[14.5px]">
            {subtitle}
          </p>
        ) : null}
        {seasonBadge ? (
          <p
            className={cn(
              "mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold tabular-nums sm:mt-6",
              shelf.key === "coming-soon"
                ? "bg-stone-100 text-stone-700 ring-1 ring-stone-200/80"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-100",
            )}
          >
            {seasonBadge}
          </p>
        ) : null}
      </header>

      <div className="relative">
        {/*
          Padding math (left edge):
            - page <section> = px-2 (8px) / sm:px-4 (16px)
            - scroll container -mx matches page padding so left edge sits at
              the viewport edge (full-bleed), then px shifts the first card
              inward by an editorial buffer (20px / 28px). Without this the
              first card's location-chip + title read as if they were cropped
              against the viewport edge.
          Right edge: matches with `mx` + the trailing spacer below.
        */}
        <div
          className="
            -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain
            scroll-smooth scrollbar-hide px-5 pb-2 [-webkit-overflow-scrolling:touch]
            sm:-mx-4 sm:gap-4 sm:px-7
          "
        >
          {shelf.tours.map((tour) => (
            <ShelfCard key={`${shelf.key}-${tour.slug}`} product={tour} mediaBySlug={mediaBySlug} />
          ))}
          {/* Trailing spacer — keeps the last card from butting against the right
              viewport edge once scrolled all the way through. Matches the left
              `px-` so the rail reads symmetric. */}
          <div className="shrink-0 w-3 sm:w-5" aria-hidden />
        </div>
        {/* Right-edge fade — premium magazine cue that more cards exist horizontally. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/60 to-transparent sm:w-16"
        />
      </div>
    </section>
  );
}

function ShelfCard({
  product,
  mediaBySlug,
}: {
  product: StaticTourProductRegistration;
  mediaBySlug?: TourProductCardMediaMap;
}) {
  const fallbackImage = product.thumbnail || product.heroImage;
  const imageUrl = mediaBySlug
    ? getCardImageFromAdminMedia(product.slug, fallbackImage, mediaBySlug)
    : fallbackImage;
  const vm = useMemo(
    () => ({
      ...staticRegistrationToCardViewModel(product),
      imageUrl,
    }),
    [product, imageUrl],
  );
  const href = consumerTourDetailHref(product.slug, product.slug);

  return (
    <div className="snap-start shrink-0" style={{ width: SHELF_CARD_WIDTH }}>
      <TourListCard
        tour={vm}
        detailHref={href}
        imageSizes={SHELF_CARD_IMAGE_SIZES}
        layout="vertical"
      />
    </div>
  );
}

/** Cosmetic — empty trailing link used by ShelvesContainer if it ever wants
 *  a "View all" affordance per shelf. Kept here so its style stays in
 *  shelf-component sphere. */
export function ShelfViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 hover:text-slate-900"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
