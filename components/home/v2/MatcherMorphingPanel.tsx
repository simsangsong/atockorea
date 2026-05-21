"use client";

// v3 Phase D.1 — desktop-only in-place result morphing.
//
// Renders inside the hero matcher card on desktop when:
//   - the home_result_morphing experiment is variant "B"
//   - viewport width ≥ 768px
//   - phase !== "idle"
//
// Variant A (control) and mobile users see nothing here — they keep the
// existing flow (matcher card stays visible, BestMatchPreview slot 2
// renders below, user scrolls).
//
// On variant B desktop, the panel renders an inline winner preview + a
// "다시 매칭" reset button. framer-motion `layout` makes the height
// change smooth as content swaps between loading skeleton and result.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { useMediaQuery } from "@/components/home/v2/use-media-query";
import {
  getStaticTourProductBySlug,
  hrefStaticTourProductDetail,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { useI18n, useTranslations } from "@/lib/i18n";
import { analytics, getExperimentVariantAsync } from "@/src/design/analytics";

export function MatcherMorphingPanel() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const { phase, loadingStep, matchResult, resetMatchToIdle } = useHomeV2Match();
  const reduceMotion = useReducedMotion();

  const [variant, setVariant] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // home_result_morphing A/B — variant resolves once the shared experiment
  // registry fetch settles. Async `.then(setVariant)` keeps the assignment off
  // the synchronous effect body (no setState-in-effect); the experiment key and
  // assignment logic are unchanged.
  useEffect(() => {
    let cancelled = false;
    void getExperimentVariantAsync("home_result_morphing").then((v) => {
      if (cancelled) return;
      if (v) setVariant(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hidden cases:
  //   - variant not B (control or null) → no morph, defer to slot-2 BestMatchPreview
  //   - mobile → D.2 bottom-sheet handles
  //   - idle phase → matcher form is what should show, not this panel
  if (variant !== "B" || !isDesktop || phase === "idle") return null;

  const winnerSlug = matchResult?.winner?.product_id;
  const winner = winnerSlug ? getStaticTourProductBySlug(winnerSlug, locale) : null;

  return (
    <div
      data-home-matcher-morph
      className="absolute inset-0 z-10 overflow-hidden rounded-card border border-slate-200/70 bg-white shadow-2"
    >
      <AnimatePresence mode="wait">
        {phase === "loading" || !winner ? (
          <motion.div
            key="loading"
            layout
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 p-6"
            role="status"
            aria-live="polite"
            aria-busy
          >
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" aria-hidden />
              <Sparkles
                className="absolute inset-0 m-auto h-6 w-6 text-slate-700"
                strokeWidth={1.8}
                aria-hidden
              />
            </div>
            <p className="text-caption font-medium text-slate-700">
              {loadingStep === 0
                ? t("premium.hero.matchLoadingAnalyzing")
                : loadingStep === 1
                  ? t("premium.hero.matchLoadingMatching")
                  : t("premium.hero.matchLoadingComplete")}
            </p>
            <p className="text-micro text-slate-400">결과 카드 준비 중…</p>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            layout
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col"
          >
            <Link
              href={hrefStaticTourProductDetail(winner.slug)}
              onClick={() =>
                analytics.homeCtaClick({ source: "best_match_result_primary" })
              }
              className="focus-ring relative block aspect-[16/9] w-full overflow-hidden"
            >
              <Image
                src={winner.heroImage}
                alt={winner.title}
                fill
                sizes="(min-width: 1024px) 32rem, 100vw"
                className="object-cover"
                loading="lazy"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
                <span className="text-micro font-semibold uppercase tracking-[0.18em] text-white/80">
                  {winner.region}
                </span>
                <h3
                  className="mt-1 text-[1.05rem] font-semibold leading-tight text-white md:text-[1.2rem]"
                  style={{ textShadow: "0 3px 16px rgba(0,0,0,0.45)" }}
                >
                  {winner.title}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {winner.badges.slice(0, 3).map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </Link>

            <div className="flex items-center justify-between gap-2 p-3 md:p-4">
              <button
                type="button"
                onClick={resetMatchToIdle}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-caption font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("premium.hero.matchResultBackCta")}
              </button>
              <Link
                href={hrefStaticTourProductDetail(winner.slug)}
                onClick={() =>
                  analytics.homeCtaClick({ source: "best_match_result_primary" })
                }
                className="focus-ring inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-1.5 text-caption font-semibold text-white transition-colors hover:bg-slate-700"
              >
                {t("premium.hero.bestMatchCta")}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
