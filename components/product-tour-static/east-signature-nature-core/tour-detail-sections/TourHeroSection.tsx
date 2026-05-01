"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Footprints, Heart, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeCssBackgroundUrl } from "@/lib/safe-image-url";
import { useCurrencyOptional } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n";
import { isInWishlistLocal, toggleWishlistLocal } from "@/lib/wishlist";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourHeroSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero" | "price"
> & {
  tourProductSlug: string;
};

const SCROLL_OFFSET_PX = 108;

function scrollToHash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: top - SCROLL_OFFSET_PX, behavior: "smooth" });
}

function parseUsdFromPrice(price: { amountLabel: string; currency: string }): number | null {
  if (String(price.currency).toUpperCase() === "USD") {
    const n = parseFloat(String(price.amountLabel).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  return null;
}

export function TourHeroSection({
  headlineLine1,
  headlineLine2,
  hero,
  price,
  tourProductSlug,
}: TourHeroSectionProps) {
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const showRating = (hero.meta.rating ?? 0) > 0;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isInWishlistLocal(tourProductSlug));
  }, [tourProductSlug]);

  const handleSave = useCallback(() => {
    const next = toggleWishlistLocal(tourProductSlug);
    setSaved(next);
    toast.success(next ? "Saved" : "Removed", { duration: 1600 });
  }, [tourProductSlug]);

  const handleShare = useCallback(async () => {
    const title = `${headlineLine1} ${headlineLine2}`.replace(/\s+/g, " ").trim();
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied", { duration: 1600 });
      } catch {
        /* ignore */
      }
    }
  }, [headlineLine1, headlineLine2]);

  const usdPrice = parseUsdFromPrice(price);
  const priceFormatted =
    usdPrice != null && currencyCtx
      ? currencyCtx.formatPrice(usdPrice)
      : `${price.amountLabel}${price.currency ? " " + price.currency : ""}`.trim();

  return (
    <section className="relative w-full">
      <div className="relative h-[36vh] min-h-[280px] max-h-[360px] sm:h-[42vh] sm:min-h-[340px] sm:max-h-[440px] w-full overflow-hidden rounded-b-2xl shadow-hero">
        {/* Background image — slow ken-burns drift, more breathing room */}
        <div
          className="absolute inset-0 bg-cover transition-transform duration-[14000ms] ease-out scale-[1.04] hover:scale-[1.08]"
          style={{
            backgroundImage: safeCssBackgroundUrl(hero.imageUrl),
            backgroundPosition: hero.imagePosition,
          }}
        />

        {/* Gradient — single soft bottom darkening, lets the photo breathe */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/85 via-[#0c1622]/30 via-45% to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1622]/35 via-transparent to-transparent sm:from-[#0c1622]/20" />

        {/* Top-right utilities — save / share */}
        <div className="absolute right-3 top-3 z-10 flex gap-1.5 sm:right-4 sm:top-4">
          <button
            type="button"
            onClick={handleSave}
            aria-label={saved ? t("tour.removeFromWishlist") : t("tour.addToWishlist")}
            aria-pressed={saved}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          >
            <Heart
              className={cn("h-4 w-4 transition-colors", saved ? "fill-rose-500 text-rose-500" : "text-white")}
              strokeWidth={saved ? 0 : 1.8}
            />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          >
            <Share2 className="h-4 w-4 text-white" strokeWidth={1.8} />
          </button>
        </div>

        {/* Content — compact, restrained */}
        <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 sm:px-8 sm:pb-7 lg:px-12 lg:pb-9">
          {/* Eyebrow — neutral white hairline, no gold */}
          {hero.meta.region && (
            <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
              <span aria-hidden className="h-px w-6 bg-white/45 sm:w-7" />
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70 sm:text-[10.5px]">
                {hero.meta.region}
              </span>
            </div>
          )}

          {/* Headline — line 2 nudged for readability (size + opacity), no italic */}
          <h1
            className="font-sans text-white"
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.4), 0 1px 12px rgba(0,0,0,0.35)",
            }}
          >
            <span className="block text-[22px] font-semibold leading-[1.16] tracking-[-0.014em] sm:text-[30px] sm:leading-[1.14] lg:text-[34px]">
              {headlineLine1}
            </span>
            <span className="mt-1 block text-[14px] font-normal leading-[1.45] tracking-[0.005em] text-white/85 sm:mt-1.5 sm:text-[15.5px] lg:text-[16px]">
              {headlineLine2}
            </span>
          </h1>

          {/* Pills — uniform hairline glass, restrained */}
          {hero.pills.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
              {hero.pills.slice(0, 3).map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/25 bg-white/[0.10] px-3 py-1 text-[10.5px] font-medium tracking-[0.01em] text-white/95 backdrop-blur-md sm:px-3.5 sm:py-1 sm:text-[11px]"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}

          {/* Meta strip — duration · stops · rating · price */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/15 pt-3 sm:mt-5 sm:gap-x-5 sm:pt-3.5">
            <div className="flex items-center gap-1.5 text-[12px] text-white/90 sm:text-[12.5px]">
              <Clock className="h-3.5 w-3.5 text-white/55" strokeWidth={1.8} />
              <span className="font-medium tabular-nums">{hero.meta.duration}</span>
            </div>
            <span aria-hidden className="h-3 w-px bg-white/20" />
            <div className="flex items-center gap-1.5 text-[12px] text-white/90 sm:text-[12.5px]">
              <Footprints className="h-3.5 w-3.5 text-white/55" strokeWidth={1.8} />
              <span className="tabular-nums">{hero.meta.stops}</span>
            </div>
            {showRating && (
              <>
                <span aria-hidden className="h-3 w-px bg-white/20" />
                <button
                  type="button"
                  onClick={() => scrollToHash("reviews")}
                  className="flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Jump to reviews"
                >
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = star <= hero.meta.ratingStars;
                      return (
                        <Star
                          key={star}
                          className="h-3 w-3"
                          strokeWidth={0}
                          style={{
                            fill: filled ? "#E8C77A" : "rgba(255,255,255,0.18)",
                            color: filled ? "#E8C77A" : "rgba(255,255,255,0.18)",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-white sm:text-[12.5px]">
                    {hero.meta.rating}
                  </span>
                </button>
              </>
            )}
            <span aria-hidden className="h-3 w-px bg-white/20" />
            <div className="flex items-baseline gap-1 text-[12px] text-white/90 sm:text-[12.5px]">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/60">
                {t("tour.stickyPriceFrom")}
              </span>
              <span className="font-semibold tabular-nums text-white">{priceFormatted}</span>
              <span className="text-[10.5px] text-white/65">/ {price.per}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
