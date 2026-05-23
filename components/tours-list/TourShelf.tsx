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
};

export function TourShelf({ shelf, className }: TourShelfProps) {
  const { locale } = useI18n();
  const t = useTranslations();
  if (shelf.tours.length === 0) return null;

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

  return (
    <section className={cn("relative", className)}>
      <header className="mb-5 px-4 sm:mb-6 sm:px-5">
        {/* Eyebrow row: small amber rule + uppercase label (carries Phase 1 hero
            family — amber-700/90 + 0.22em tracking + thin gold prefix line). */}
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="block h-px w-6 bg-amber-500/70 sm:w-8" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-amber-700/95">
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
            larger size, magazine spread feel. */}
        <h2
          className={cn(
            "mt-3 font-magazine-serif-ko font-semibold leading-[1.12] text-stone-900",
            "text-[26px] tracking-[-0.018em] sm:text-[32px] sm:tracking-[-0.02em] lg:text-[36px]",
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2.5 max-w-2xl text-[13px] leading-[1.65] text-slate-600 sm:mt-3 sm:text-[14px]">
            {subtitle}
          </p>
        ) : null}
        {seasonBadge ? (
          <p
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tabular-nums",
              shelf.key === "coming-soon"
                ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-100",
            )}
          >
            {seasonBadge}
          </p>
        ) : null}
      </header>

      <div className="relative">
        <div
          className="
            -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain
            scroll-smooth scrollbar-hide px-4 pb-2 [-webkit-overflow-scrolling:touch]
            sm:-mx-5 sm:gap-4 sm:px-5
          "
        >
          {shelf.tours.map((tour) => (
            <ShelfCard key={`${shelf.key}-${tour.slug}`} product={tour} />
          ))}
          <div className="shrink-0 w-2 sm:w-0" aria-hidden />
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

function ShelfCard({ product }: { product: StaticTourProductRegistration }) {
  const vm = useMemo(() => staticRegistrationToCardViewModel(product), [product]);
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
