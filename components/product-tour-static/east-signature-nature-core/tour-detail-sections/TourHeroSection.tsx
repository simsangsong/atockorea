"use client";

import { Clock, Footprints, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourHeroSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero"
>;

export function TourHeroSection({ headlineLine1, headlineLine2, hero }: TourHeroSectionProps) {
  const showRating = (hero.meta.rating ?? 0) > 0;

  return (
    <section className="relative w-full">
      <div className="relative h-[36vh] min-h-[280px] max-h-[360px] sm:h-[42vh] sm:min-h-[340px] sm:max-h-[440px] w-full overflow-hidden rounded-b-2xl shadow-hero">
        {/* Background image — slow ken-burns drift, more breathing room */}
        <div
          className="absolute inset-0 bg-cover transition-transform duration-[14000ms] ease-out scale-[1.04] hover:scale-[1.08]"
          style={{
            backgroundImage: `url('${hero.imageUrl}')`,
            backgroundPosition: hero.imagePosition,
          }}
        />

        {/* Gradient — single soft bottom darkening, lets the photo breathe */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/85 via-[#0c1622]/30 via-45% to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1622]/35 via-transparent to-transparent sm:from-[#0c1622]/20" />

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

          {/* Headline — clean sans-serif with strong size hierarchy */}
          <h1
            className="font-sans text-white"
            style={{
              textShadow: "0 1px 2px rgba(0,0,0,0.4), 0 1px 12px rgba(0,0,0,0.35)",
            }}
          >
            <span className="block text-[22px] font-semibold leading-[1.16] tracking-[-0.014em] sm:text-[30px] sm:leading-[1.14] lg:text-[34px]">
              {headlineLine1}
            </span>
            <span className="mt-1 block text-[13px] font-normal leading-[1.4] tracking-[0.005em] text-white/75 sm:mt-1.5 sm:text-[14.5px] lg:text-[15px]">
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

          {/* Meta strip — clean hairline divider */}
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
                <div className="flex items-center gap-1.5">
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
