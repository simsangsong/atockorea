"use client";

import { Clock, MapPin, Footprints, Star } from "lucide-react";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourHeroSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero"
>;

export function TourHeroSection({ headlineLine1, headlineLine2, hero }: TourHeroSectionProps) {
  return (
    <section className="relative w-full">
      <div className="relative h-[34.67vh] min-h-[267px] max-h-[347px] sm:h-[38.67vh] sm:min-h-[307px] sm:max-h-[400px] w-full overflow-hidden rounded-b-2xl shadow-hero">
        <div
          className="absolute inset-0 bg-cover scale-[1.02]"
          style={{
            backgroundImage: `url('${hero.imageUrl}')`,
            backgroundPosition: hero.imagePosition,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A2332]/12 via-transparent via-30% to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/95 via-[#1A2332]/40 via-40% to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/[0.03] via-transparent to-transparent" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 10% 90%, rgba(26,35,50,0.25) 0%, transparent 50%)",
          }}
        />

        <div className="absolute left-0 top-0 right-0 bottom-0 flex min-h-0 flex-col justify-end">
          {/* Meta strip in document flow so it never stacks over pills */}
          <div className="relative px-5 pb-3 pt-2 sm:pb-4 sm:pt-3">
            <div
              className="absolute -inset-x-2 -inset-y-3 -z-10 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(26,35,50,0.42) 0%, rgba(26,35,50,0.18) 55%, rgba(26,35,50,0.06) 100%)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                maskImage: "linear-gradient(to right, black 0%, black 88%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, black 0%, black 88%, transparent 100%)",
              }}
            />

            <h1
              className="text-[24px] font-semibold tracking-[-0.025em] text-white leading-[1.05] sm:text-[30px] sm:leading-[1.1] lg:text-[34px]"
              style={{
                textShadow:
                  "0 1px 2px rgba(0,0,0,0.55), 0 2px 20px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.8)",
              }}
            >
              {headlineLine1}
              <br />
              {headlineLine2}
            </h1>

            <div className="relative z-10 mt-4 sm:mt-6 flex flex-wrap gap-2">
              {hero.pills.map((pill, i) => (
                <span
                  key={pill}
                  className="rounded-full px-3.5 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-[11px] font-medium tracking-wide text-white/95"
                  style={{
                    background: i === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.11)",
                    border: i === 0 ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-0 shrink-0 border-t border-white/10">
            <div
              className="mx-0 px-4 py-2.5 sm:px-5 sm:py-3.5"
              style={{
                background: "linear-gradient(to right, rgba(26,35,50,0.88) 0%, rgba(26,35,50,0.78) 100%)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:gap-x-5 sm:gap-y-2">
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span className="font-medium">{hero.meta.duration}</span>
                </div>
                <span className="hidden sm:block w-px h-3.5 bg-white/20" />
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span>{hero.meta.region}</span>
                </div>
                <span className="hidden sm:block w-px h-3.5 bg-white/20" />
                <div className="flex items-center gap-1.5 text-[13px] sm:text-sm text-white/90">
                  <Footprints className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/60" />
                  <span>{hero.meta.stops}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${star <= hero.meta.ratingStars ? "fill-amber-400 text-amber-400" : "fill-white/30 text-white/30"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[13px] sm:text-sm font-semibold text-white">{hero.meta.rating}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
