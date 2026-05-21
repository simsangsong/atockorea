"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Star } from "lucide-react";
import {
  hrefStaticTourProductDetail,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { useCurrencyOptional } from "@/lib/currency";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type TourRecommendationsSectionProps = {
  recommendations: readonly StaticTourProductRegistration[];
  /** Optional sectionUi for localized header/footer copy. */
  sectionUi?: TourProductSectionUiV1;
};

export function TourRecommendationsSection({ recommendations, sectionUi }: TourRecommendationsSectionProps) {
  const currencyCtx = useCurrencyOptional();

  if (recommendations.length === 0) return null;

  const eyebrow = sectionUi?.recommendationsEyebrow ?? "Explore next";
  const title = sectionUi?.recommendationsTitle ?? "You might also like";
  const subtitle =
    sectionUi?.recommendationsSubtitle ?? "Different pacing, different emphasis. Each is its own day.";
  const fromLabel = sectionUi?.recommendationsFromLabel ?? "from";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>

      <div
        className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory sm:-mx-5 sm:px-5"
        style={{ scrollPaddingLeft: "16px" }}
      >
        {recommendations.map((rec) => {
          const rawSrc = rec.thumbnail?.trim() || rec.heroImage?.trim() || "";
          const imageSrc = rawSrc.length > 0 ? rawSrc : null;
          const tag = rec.badges[0] ?? rec.region;
          const priceFormatted = currencyCtx ? currencyCtx.formatPrice(rec.listPriceUsd) : `$${rec.listPriceUsd}`;
          const compareAtFormatted =
            rec.compareAtPriceUsd && currencyCtx
              ? currencyCtx.formatPrice(rec.compareAtPriceUsd)
              : rec.compareAtPriceUsd
                ? `$${rec.compareAtPriceUsd}`
                : null;
          return (
            <Link
              key={rec.slug}
              href={hrefStaticTourProductDetail(rec.slug)}
              className="group relative flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.07] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-1 hover:ring-slate-900/[0.11] hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_6px_14px_-2px_rgba(15,23,42,0.09),0_24px_48px_-14px_rgba(15,23,42,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 focus-visible:ring-offset-2"
              style={{ width: "calc(78vw - 16px)", maxWidth: "300px" }}
            >
              <div className="relative h-44 overflow-hidden bg-muted/40">
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={rec.title}
                    fill
                    sizes="(max-width: 640px) 78vw, 300px"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="h-full w-full bg-gradient-to-br from-muted via-muted/80 to-muted/60"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/55 via-[#0c1622]/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0c1622]/15" />
                <div aria-hidden className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/10" />

                {tag && (
                  <div className="absolute top-3 left-3">
                    <span
                      className="rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] text-foreground shadow-md"
                      style={{
                        background: "rgba(255,255,255,0.94)",
                        backdropFilter: "blur(8px) saturate(140%)",
                        WebkitBackdropFilter: "blur(8px) saturate(140%)",
                      }}
                    >
                      {tag}
                    </span>
                  </div>
                )}

                <div
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-foreground shadow-md"
                  style={{
                    background: "rgba(255,255,255,0.94)",
                    backdropFilter: "blur(8px) saturate(140%)",
                    WebkitBackdropFilter: "blur(8px) saturate(140%)",
                  }}
                >
                  <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                  {rec.duration}
                </div>
              </div>

              <div className="p-4 pb-5">
                <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug tracking-tight line-clamp-2">
                  {rec.title}
                </h3>
                {rec.shortCardDescription ? (
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {rec.shortCardDescription}
                  </p>
                ) : null}

                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={0} />
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">{rec.rating}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">({rec.reviewCount})</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-muted-foreground leading-none">{fromLabel}</span>
                    <div className="flex items-baseline gap-1">
                      {compareAtFormatted ? (
                        <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                          {compareAtFormatted}
                        </span>
                      ) : null}
                      <span className="text-[15px] font-semibold text-foreground tabular-nums">{priceFormatted}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        <div className="flex-shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
}
