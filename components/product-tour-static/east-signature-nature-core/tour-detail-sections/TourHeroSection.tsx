"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Compass, Footprints, Heart, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeCssBackgroundUrl } from "@/lib/safe-image-url";
import { useTranslations } from "@/lib/i18n";
import { isInWishlistLocal, toggleWishlistLocal } from "@/lib/wishlist";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourHeroSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero"
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

export function TourHeroSection({
  headlineLine1,
  headlineLine2,
  hero,
  tourProductSlug,
}: TourHeroSectionProps) {
  const t = useTranslations();
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

  const slides = hero.images && hero.images.length > 0 ? hero.images : [hero.imageUrl];
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [heroInView, setHeroInView] = useState(true);
  const heroImageRef = useRef<HTMLDivElement>(null);
  // Track the previous slide so its CSS class can pull it leftward as the new
  // slide enters from the right — gives the crossfade a real slide character.
  const prevSlideIdxRef = useRef(-1);

  useEffect(() => {
    const el = heroImageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroInView(entry.isIntersecting);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || !heroInView) return;
    const id = window.setInterval(() => {
      setActiveSlideIdx((i) => {
        prevSlideIdxRef.current = i;
        return (i + 1) % slides.length;
      });
    }, 6500);
    return () => window.clearInterval(id);
  }, [slides.length, heroInView]);

  return (
    <section className="relative w-full">
      {/* Hero image — clean, no overlaid text. Save/share float top-right. */}
      <div
        ref={heroImageRef}
        className="relative h-[29vh] min-h-[214px] max-h-[294px] sm:h-[33vh] sm:min-h-[266px] sm:max-h-[360px] w-full overflow-hidden rounded-b-2xl shadow-hero"
      >
        {slides.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            aria-hidden={idx !== activeSlideIdx}
            className={cn(
              "tour-hero-slide",
              idx === activeSlideIdx && "tour-hero-slide--active",
              !heroInView && "tour-hero-slide--paused",
              idx === prevSlideIdxRef.current && idx !== activeSlideIdx && "tour-hero-slide--prev",
            )}
            style={{
              backgroundImage: safeCssBackgroundUrl(url),
              backgroundPosition: hero.imagePosition,
            }}
          />
        ))}

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
      </div>

      {/* Content below hero — no card wrapper, but a soft rose pastel wash differentiates this title strip from neutral sections below. */}
      <div className="relative px-5 pt-3.5 pb-2 sm:px-8 sm:pt-4 sm:pb-2.5 lg:px-12 lg:pt-5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: "#ffffff",
          }}
        />

        {hero.meta.region && (
          <div className="flex items-center gap-2.5 mb-3 sm:mb-3.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/85" />
            <span aria-hidden className="h-px w-5 bg-gradient-to-r from-[var(--accent)]/55 via-[var(--accent)]/25 to-transparent sm:w-7" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]/90 sm:text-[10.5px]">
              {hero.meta.region}
            </span>
          </div>
        )}

        <h1 className="text-foreground">
          <span className="tour-hero-headline-line block text-[19px] font-bold leading-[1.18] tracking-[-0.018em] sm:text-[22px] sm:leading-[1.15] sm:tracking-[-0.016em] lg:text-[24px] lg:leading-[1.16]">
            {headlineLine1}
          </span>
          <span className="tour-hero-headline-line mt-0.5 block text-[13.5px] font-semibold leading-[1.3] tracking-[-0.008em] text-[#1a2332]/65 sm:mt-1 sm:text-[15px] sm:leading-[1.28] lg:text-[16px]">
            {headlineLine2}
          </span>
        </h1>

        {hero.pills.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
            {hero.pills.slice(0, 3).map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center rounded-full bg-gradient-to-br from-white via-slate-50/60 to-white px-3 py-1 text-[11px] font-semibold tracking-[0.005em] text-foreground/90 ring-1 ring-slate-300/70 shadow-[0_1px_2px_rgba(26,35,50,0.06),0_4px_10px_-4px_rgba(26,35,50,0.12)] backdrop-blur-sm transition-all duration-200 hover:ring-slate-400/70 hover:shadow-[0_2px_4px_rgba(26,35,50,0.09),0_6px_14px_-4px_rgba(26,35,50,0.16)] sm:px-3.5 sm:py-1.5 sm:text-[11.5px]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200/55 pt-2.5 sm:mt-3 sm:gap-x-5 sm:pt-3">
          <div className="flex items-center gap-1.5 text-[12.5px] text-foreground/85 sm:text-[13px]">
            <Clock className="h-3.5 w-3.5 text-slate-700" strokeWidth={1.8} />
            <span className="font-medium tabular-nums">{hero.meta.duration}</span>
          </div>
          <span aria-hidden className="h-3 w-px bg-slate-200/70" />
          <div className="flex items-center gap-1.5 text-[12.5px] text-foreground/85 sm:text-[13px]">
            <Footprints className="h-3.5 w-3.5 text-slate-700" strokeWidth={1.8} />
            <span className="tabular-nums">{hero.meta.stops}</span>
          </div>
          {showRating && (
            <>
              <span aria-hidden className="h-3 w-px bg-slate-200/70" />
              <button
                type="button"
                onClick={() => scrollToHash("reviews")}
                className="flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
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
                          fill: filled ? "var(--star-color)" : "rgba(26,35,50,0.18)",
                          color: filled ? "var(--star-color)" : "rgba(26,35,50,0.18)",
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-[12.5px] font-semibold tabular-nums text-foreground sm:text-[13px]">
                  {hero.meta.rating}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
