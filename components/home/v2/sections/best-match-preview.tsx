"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { Clock, Users, Star, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { analytics } from "@/src/design/analytics";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { useHomeHeroMobileMq } from "@/hooks/home/useHomeHeroMobileMq";
import {
  buildV2BestMatchResultViewModel,
  V2_BEST_MATCH_STATIC_META,
} from "@/lib/home/adapters/v2-best-match-result-vm";
import { HOME_CTA_FEATURED_JOIN_TOUR_HREF } from "@/lib/home/home-cta-routes";

/**
 * v0 used `/images/east-jeju-coast.jpg` — remote coastal Jeju for parity.
 */
const EXAMPLE_CARD_IMAGE_SRC =
  "https://images.unsplash.com/photo-1596402184321-55a6439c361c?w=1200&q=80&auto=format&fit=crop";

const bestMatchPrimaryCtaClassName =
  "h-auto w-full rounded-xl py-5 text-[13px] font-semibold transition-all duration-300 md:py-6 md:text-sm shadow-[0_4px_16px_rgba(30,58,95,0.18)] hover:shadow-[0_6px_20px_rgba(30,58,95,0.22)] bg-primary hover:bg-primary/95 text-white";

export function BestMatchPreview() {
  const t = useTranslations("home");
  const isMobile = useHomeHeroMobileMq();
  const { phase, loadingStep, joinImageUrl, resetMatchToIdle } = useHomeV2Match();
  const effectivePhase = isMobile ? phase : "idle";

  const [imageError, setImageError] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);

  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealRef.current?.classList.add("visible");
  }, [effectivePhase]);

  useEffect(() => {
    if (effectivePhase === "result") {
      setImageError(false);
    }
  }, [effectivePhase, joinImageUrl]);

  const loadingLabel = useMemo(() => {
    if (loadingStep === 0) return t("premium.hero.matchLoadingAnalyzing");
    if (loadingStep === 1) return t("premium.hero.matchLoadingMatching");
    return t("premium.hero.matchLoadingComplete");
  }, [loadingStep, t]);

  const resultVm = useMemo(() => buildV2BestMatchResultViewModel((key: string) => t(key)), [t]);

  const meta = V2_BEST_MATCH_STATIC_META;

  return (
    <section className="py-14 md:py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 bg-slate-100/80 border border-slate-200/60 rounded-full">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                effectivePhase === "loading"
                  ? "bg-sky-500 animate-pulse"
                  : effectivePhase === "result"
                    ? "bg-primary"
                    : "bg-slate-500"
              }`}
            />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">
              {effectivePhase === "loading"
                ? loadingLabel
                : effectivePhase === "result"
                  ? resultVm.badgeLabel
                  : "Example Recommendation"}
            </span>
          </div>
          <p className="text-slate-600 text-[14px] font-medium max-w-sm mx-auto leading-relaxed">
            {effectivePhase === "loading"
              ? loadingLabel
              : effectivePhase === "result"
                ? t("premium.hero.matchLoadingComplete")
                : "Based on your preferences, here's a sample of what we'd recommend."}
          </p>
        </div>

        {effectivePhase === "idle" ? (
          <>
            <div className="flex items-center justify-center gap-1.5 mb-4 px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-200/70">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Sample:</span>
              <span className="text-[11px] text-slate-600">First visit</span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-600">Scenic</span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-600">Light walking</span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] text-slate-600">Jeju City</span>
            </div>

            <div ref={revealRef} className="group relative scroll-animate">
              <div className="relative bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden border border-slate-200/70">
                <Link
                  href={HOME_CTA_FEATURED_JOIN_TOUR_HREF}
                  className="relative block h-44 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:h-56"
                  style={{ minHeight: "176px" }}
                  aria-label="View East Jeju Small Group tour details"
                  onClick={() => analytics.heroFormStart()}
                >
                  <Image
                    src={EXAMPLE_CARD_IMAGE_SRC}
                    alt="East Jeju coastal scenery"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 42rem"
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                    <div className="flex items-end justify-between gap-3 mb-3">
                      <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                        East Jeju Small Group
                      </h3>
                      <div className="text-right flex-shrink-0">
                        <span className="text-white/50 text-xs line-through block">$78</span>
                        <span className="text-xl font-bold text-white">$58</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-white/90 text-xs">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                        <span className="font-semibold">{meta.rating}</span>
                        <span className="text-white/60">({meta.reviews})</span>
                      </div>
                      <span className="text-white/40">·</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{meta.duration}</span>
                      </div>
                      <span className="text-white/40">·</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{meta.groupMax}</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="px-2.5 py-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded-full">
                      Hotel pickup
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-medium bg-sky-50 text-sky-700 rounded-full">
                      Relaxed pace
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full">
                      Coastal views
                    </span>
                  </div>

                  <p className="text-[13px] text-slate-600 mb-5 leading-relaxed">
                    <span className="font-medium text-slate-700">Matched for you:</span> Scenic coastal route with
                    light walking and Jeju City pickup — fits your relaxed travel style.
                  </p>

                  <V0ShadcnButton asChild size="lg" className={bestMatchPrimaryCtaClassName}>
                    <Link
                      href={HOME_CTA_FEATURED_JOIN_TOUR_HREF}
                      onClick={() => {
                        analytics.heroFormStart();
                      }}
                    >
                      View tour details
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </V0ShadcnButton>
                </div>
              </div>
            </div>

            <p className="text-center text-[12px] text-slate-500 mt-5">
              Not quite right? Private and bus options also available.
            </p>
          </>
        ) : null}

        {effectivePhase === "loading" ? (
          <div
            ref={revealRef}
            className="scroll-animate flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"
              aria-hidden
            />
            <p className="text-center text-sm font-semibold tracking-tight text-slate-700">{loadingLabel}</p>
          </div>
        ) : null}

        {effectivePhase === "result" ? (
          <>
            <div ref={revealRef} className="group relative scroll-animate">
              <div className="relative bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden border border-slate-200/70">
                <div
                  className="relative h-44 overflow-hidden md:h-56"
                  style={{ minHeight: "176px" }}
                >
                  {!imageError ? (
                    <Image
                      key={`${joinImageUrl}-${imageRetryKey}`}
                      src={joinImageUrl}
                      alt={`${resultVm.titleLine1} ${resultVm.titleLine2}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 42rem"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
                      <p className="text-[13px] font-medium text-slate-600">
                        We couldn&apos;t load the tour preview image. Check your connection and try again.
                      </p>
                      <V0ShadcnButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImageError(false);
                          setImageRetryKey((k) => k + 1);
                        }}
                      >
                        Try again
                      </V0ShadcnButton>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] p-4 md:p-5">
                    <div className="flex items-end justify-between gap-3 mb-3">
                      <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                        <span className="block">{resultVm.titleLine1}</span>
                        <span className="block">{resultVm.titleLine2}</span>
                      </h3>
                      <div className="text-right flex-shrink-0">
                        <span className="text-white/50 text-xs line-through block">{resultVm.strikePriceLabel}</span>
                        <span className="text-xl font-bold text-white">{resultVm.displayPriceLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/90 text-xs">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                        <span className="font-semibold">{meta.rating}</span>
                        <span className="text-white/60">({meta.reviews})</span>
                      </div>
                      <span className="text-white/40">·</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{meta.duration}</span>
                      </div>
                      <span className="text-white/40">·</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{meta.groupMax}</span>
                      </div>
                    </div>
                  </div>
                  {!imageError ? (
                    <Link
                      href={resultVm.tourDetailHref}
                      className="absolute inset-0 z-[3] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      aria-label={`${resultVm.titleLine1} ${resultVm.titleLine2} — view tour details`}
                      onClick={() => analytics.heroFormStart()}
                    >
                      <span className="sr-only">View tour details</span>
                    </Link>
                  ) : null}
                </div>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {resultVm.chipLabels.map((label: string, index: number) => {
                      const tone =
                        index === 0
                          ? "bg-emerald-50 text-emerald-700"
                          : index === 1
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700";
                      return (
                        <span
                          key={`${label}-${index}`}
                          className={cn("px-2.5 py-1 text-[10px] font-medium rounded-full", tone)}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  <p className="text-[13px] text-slate-600 mb-2 leading-relaxed">
                    <span className="font-medium text-slate-700">Matched for you:</span> {resultVm.matchSummary}
                  </p>
                  <p className="text-[11px] text-slate-500 mb-5 text-center">{resultVm.priceCaption}</p>

                  <V0ShadcnButton asChild size="lg" className={bestMatchPrimaryCtaClassName}>
                    <Link
                      href={resultVm.tourDetailHref}
                      onClick={() => {
                        analytics.heroFormStart();
                      }}
                    >
                      {resultVm.bestMatchCta}
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </V0ShadcnButton>
                </div>
              </div>
            </div>

            <p className="text-center text-[13px] font-medium text-slate-600 mt-5 leading-snug px-1">
              {resultVm.matchResultRecommendLine}
            </p>

            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
              <V0ShadcnButton
                type="button"
                variant="outline"
                className="rounded-xl font-semibold h-auto py-3 px-4"
                onClick={() => resetMatchToIdle()}
              >
                {resultVm.matchResultBackCta}
              </V0ShadcnButton>
              <V0ShadcnButton asChild variant="outline" className="rounded-xl font-semibold h-auto py-3 px-4">
                <Link href={resultVm.browseToursHref}>{resultVm.seeOtherToursCta}</Link>
              </V0ShadcnButton>
            </div>

            <p className="text-center text-[11px] text-slate-500 mt-5 leading-relaxed">
              <span className="mr-1 font-semibold uppercase tracking-[0.12em] text-slate-400">
                {resultVm.alsoConsiderLabel}
              </span>
              <Link href={resultVm.customJoinHref} className="font-semibold text-slate-600 underline-offset-2 hover:underline">
                {resultVm.alsoConsiderPrivate}
              </Link>
              <span className="mx-1.5 text-slate-300" aria-hidden>
                ·
              </span>
              <Link href={resultVm.browseToursHref} className="font-semibold text-slate-600 underline-offset-2 hover:underline">
                {resultVm.alsoConsiderBus}
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
