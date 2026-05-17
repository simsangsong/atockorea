"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { Check, ChevronRight, Clock, Sparkles, Star, Users } from "lucide-react";
import Image from "next/image";
import { useI18n, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { analytics, type HomeCtaSource } from "@/src/design/analytics";
import { getStaticTourProductBySlug } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import {
  buildV2BestMatchResultViewModel,
  buildV2BestMatchResultViewModelFromApi,
} from "@/lib/home/adapters/v2-best-match-result-vm";
import { getFeaturedJoinTourProduct } from "@/lib/home/featured-join-tour-offer";
import { getSimilarTours } from "@/lib/home/similar-tours";
import { SimilarToursStrip } from "@/components/home/v2/SimilarToursStrip";
import { homeBtnPrimary, homeBtnSecondary } from "@/lib/home/home-button-classes";

/** Shell for idle + result cards — matches `home-premium` hero-match offer depth (group hover). */
const bestMatchCardShellClassName =
  "relative overflow-hidden rounded-card border border-white/90 bg-white shadow-home-hero-match transition-shadow duration-300 ease-out group-hover:shadow-home-hero-match-hover";

const bestMatchCardShellLoadingClassName =
  "rounded-card border border-white/90 bg-white/95 shadow-home-hero-match backdrop-blur-sm";

const bestMatchPrimaryCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-primary)",
};

/**
 * Image error/retry state lives here so it resets when the result block unmounts, without a parent effect.
 */
function MatchResultHeroImageSlot({
  joinImageUrl,
  titleText,
  tourDetailHref,
  ctaSource,
  children,
}: {
  joinImageUrl: string;
  titleText: string;
  tourDetailHref: string;
  ctaSource: HomeCtaSource;
  children: ReactNode;
}) {
  const t = useTranslations("home");
  const [imageError, setImageError] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);

  return (
    <div className="relative overflow-hidden aspect-[3/2] md:aspect-[16/9]">
      {!imageError ? (
        <Image
          key={`${joinImageUrl}-${imageRetryKey}`}
          src={joinImageUrl}
          alt={titleText}
          fill
          className="z-0 object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 42rem"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
          <p className="text-caption font-medium text-slate-600">{t("premium.v2.bestMatch.imageErrorBody")}</p>
          <V0ShadcnButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setImageError(false);
              setImageRetryKey((k) => k + 1);
            }}
          >
            {t("premium.v2.bestMatch.tryAgain")}
          </V0ShadcnButton>
        </div>
      )}
      {children}
      {!imageError ? (
        <Link
          href={tourDetailHref}
          className="absolute inset-0 z-[3] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={t("premium.v2.bestMatch.viewTourDetailsAria", { title: titleText })}
          onClick={() => analytics.homeCtaClick({ source: ctaSource })}
        >
          <span className="sr-only">{t("premium.v2.bestMatch.viewTourDetails")}</span>
        </Link>
      ) : null}
    </div>
  );
}

export function BestMatchPreview() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const { phase, loadingStep, joinImageUrl, matchResult, matchError, resetMatchToIdle } = useHomeV2Match();

  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealRef.current?.classList.add("visible");
  }, [phase]);

  const loadingLabel = useMemo(() => {
    if (loadingStep === 0) return t("premium.hero.matchLoadingAnalyzing");
    if (loadingStep === 1) return t("premium.hero.matchLoadingMatching");
    return t("premium.hero.matchLoadingComplete");
  }, [loadingStep, t]);

  const resultVm = useMemo(() => {
    if (matchResult) {
      return buildV2BestMatchResultViewModelFromApi(matchResult, (key: string) => t(key), locale);
    }
    return buildV2BestMatchResultViewModel((key: string) => t(key), locale);
  }, [matchResult, t, locale]);

  const meta = useMemo(() => {
    const groupMaxFor = (p: NonNullable<ReturnType<typeof getStaticTourProductBySlug>>) =>
      t("premium.v2.bestMatch.groupMaxParam", { n: p.maxGroupSize ?? 8 });
    if (matchResult?.winner?.product_id) {
      const p = getStaticTourProductBySlug(matchResult.winner.product_id, locale);
      if (p) {
        return {
          rating: String(p.rating),
          reviews: String(p.reviewCount),
          duration: p.duration,
          groupMax: groupMaxFor(p),
        };
      }
    }
    const idle = getFeaturedJoinTourProduct(locale);
    return {
      rating: String(idle.rating),
      reviews: String(idle.reviewCount),
      duration: idle.duration,
      groupMax: groupMaxFor(idle),
    };
  }, [matchResult, t, locale]);

  // v3 §D #1 — similar-tours strip for the matched winner.
  const similarTours = useMemo(() => {
    const slug = matchResult?.winner?.product_id;
    if (!slug) return [];
    return getSimilarTours(slug, locale, 3);
  }, [matchResult?.winner?.product_id, locale]);

  if (phase === "idle") return null;

  return (
    <section className="py-8 md:py-20 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-4 md:mb-8">
          {matchError ? (
            <p className="mb-3 text-center text-[13px] font-medium text-red-600" role="alert">
              {matchError}
            </p>
          ) : null}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-2 md:mb-3 bg-slate-100/80 border border-slate-200/60 rounded-full">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                phase === "loading"
                  ? "bg-slate-500 animate-pulse"
                  : phase === "result"
                    ? "bg-slate-700"
                    : "bg-slate-400"
              }`}
            />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">
              {phase === "loading"
                ? loadingLabel
                : phase === "result"
                  ? resultVm.badgeLabel
                  : t("premium.v2.bestMatch.emptyBadge")}
            </span>
          </div>
          <p className="text-body font-medium text-slate-600 max-w-sm mx-auto">
            {phase === "loading"
              ? loadingLabel
              : phase === "result"
                ? t("premium.hero.matchLoadingComplete")
                : t("premium.v2.bestMatch.emptyTitle")}
          </p>
        </div>


        {phase === "loading" ? (
          <div
            ref={revealRef}
            className={cn("scroll-animate overflow-hidden", bestMatchCardShellLoadingClassName)}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            {/* Match thinking visualization — replaces the generic gradient
                skeleton with a deliberate "the matcher is actually doing
                something" UI: animated sparkle in the hero slot, then a
                3-step checklist below that lights up sequentially. Layout
                still mirrors the result card so the transition into the
                result has no shift. */}
            <div className="relative aspect-[3/2] md:aspect-[16/9] overflow-hidden bg-slate-50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Outer ring — spins */}
                  <div
                    className="h-20 w-20 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin md:h-24 md:w-24"
                    aria-hidden
                  />
                  {/* Inner pulsing halo */}
                  <span
                    className="pointer-events-none absolute inset-3 rounded-full bg-slate-400/15 animate-ping md:inset-4"
                    aria-hidden
                  />
                  {/* Sparkles icon centered */}
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <Sparkles className="h-7 w-7 text-slate-700 md:h-8 md:w-8" strokeWidth={1.8} />
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  Smart Match
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  analyzing
                </span>
              </div>

              <ol className="mb-4 space-y-2.5">
                {(
                  [
                    "premium.hero.matchLoadingAnalyzing",
                    "premium.hero.matchLoadingMatching",
                    "premium.hero.matchLoadingComplete",
                  ] as const
                ).map((key, idx) => {
                  const state =
                    idx < loadingStep ? "done" : idx === loadingStep ? "active" : "pending";
                  return (
                    <li key={key} className="flex items-center gap-3">
                      {/* Step indicator */}
                      {state === "done" ? (
                        <span
                          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-white"
                          aria-hidden
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : state === "active" ? (
                        <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden>
                          <span className="absolute inset-0 rounded-full bg-slate-400/40 animate-ping" />
                          <span className="relative h-2.5 w-2.5 rounded-full bg-slate-700" />
                        </span>
                      ) : (
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-200"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "text-[13px] transition-colors",
                          state === "done" && "text-slate-700",
                          state === "active" && "font-semibold text-slate-900",
                          state === "pending" && "text-slate-400",
                        )}
                      >
                        {t(key)}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Progress bar — fills with loadingStep */}
              <div
                className="h-1 w-full overflow-hidden rounded-full bg-slate-100"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-slate-700 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(loadingStep + 1, 3) * 33.33}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {phase === "result" ? (
          <div ref={revealRef} className="match-result-soft-enter">
            <div className="group relative">
              <div className={bestMatchCardShellClassName}>
                <MatchResultHeroImageSlot
                  joinImageUrl={joinImageUrl}
                  titleText={`${resultVm.titleLine1} ${resultVm.titleLine2}`}
                  tourDetailHref={resultVm.tourDetailHref}
                  ctaSource="best_match_result_card_hero"
                >
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-slate-900/75 via-slate-900/35 to-transparent" />
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] p-3 md:p-5">
                    <div className="flex items-end justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight">
                        <span className="block">{resultVm.titleLine1}</span>
                        <span className="block">{resultVm.titleLine2}</span>
                      </h3>
                      <div className="text-right flex-shrink-0">
                        {resultVm.strikePriceLabel ? (
                          <span className="text-white/50 text-xs line-through block">{resultVm.strikePriceLabel}</span>
                        ) : null}
                        <span className="text-xl font-bold text-white">{resultVm.displayPriceLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/90 text-xs">
                      {Number(meta.rating) > 0 ? (
                        <>
                          <div
                            className="flex items-center gap-1"
                            role="img"
                            aria-label={t("premium.v2.bestMatch.matchMetaRowRatingAria", {
                              rating: meta.rating,
                              count: meta.reviews,
                            })}
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" aria-hidden />
                            <span className="font-semibold" aria-hidden>
                              {meta.rating}
                            </span>
                            {Number(meta.reviews) > 0 ? (
                              <span className="text-white/60" aria-hidden>
                                ({meta.reviews})
                              </span>
                            ) : null}
                          </div>
                          <span className="text-white/40" aria-hidden>
                            ·
                          </span>
                        </>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden />
                        <span>{meta.duration}</span>
                      </div>
                      <span className="text-white/40" aria-hidden>
                        ·
                      </span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" aria-hidden />
                        <span>{meta.groupMax}</span>
                      </div>
                    </div>
                  </div>
                </MatchResultHeroImageSlot>

                <div className="p-3 md:p-5">
                  <div className="flex flex-wrap gap-1.5 mb-3 md:mb-4">
                    {resultVm.chipLabels.map((label: string, index: number) => (
                      <span
                        key={`${label}-${index}`}
                        className="px-2.5 py-1 text-micro font-medium rounded-full bg-slate-100 text-slate-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="text-caption text-slate-600 mb-2">
                    <span className="font-medium text-slate-700">{t("premium.v2.bestMatch.matchSummaryLead")}</span>{" "}
                    {resultVm.matchSummary}
                  </p>
                  <p className="text-micro text-slate-500 mb-4 text-center md:mb-5">{resultVm.priceCaption}</p>

                  <V0ShadcnButton
                    asChild
                    size="lg"
                    className={homeBtnPrimary}
                    style={bestMatchPrimaryCtaStyle}
                  >
                    <Link
                      href={resultVm.tourDetailHref}
                      onClick={() => {
                        analytics.homeCtaClick({ source: "best_match_result_primary" });
                      }}
                    >
                      {resultVm.bestMatchCta}
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </V0ShadcnButton>
                </div>
              </div>
            </div>

            {/* v3 §D #1 — winner와 유사한 투어 3개 추천 (region/badge 기반 score) */}
            {phase === "result" && matchResult?.winner?.product_id && similarTours.length > 0 ? (
              <SimilarToursStrip
                winnerSlug={matchResult.winner.product_id}
                tours={similarTours}
              />
            ) : null}

            <p className="text-center text-caption font-medium text-slate-600 mt-3 px-1 md:mt-5">
              {resultVm.matchResultRecommendLine}
            </p>

            <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 md:mt-4">
              <V0ShadcnButton
                type="button"
                variant="outline"
                className={cn(homeBtnSecondary, "sm:w-auto sm:px-5")}
                onClick={() => resetMatchToIdle()}
              >
                {resultVm.matchResultBackCta}
              </V0ShadcnButton>
              <V0ShadcnButton asChild variant="outline" className={cn(homeBtnSecondary, "sm:w-auto sm:px-5")}>
                <Link href={resultVm.browseToursHref}>{resultVm.seeOtherToursCta}</Link>
              </V0ShadcnButton>
            </div>

            <p className="text-center text-micro text-slate-500 mt-3 leading-relaxed md:mt-5">
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
