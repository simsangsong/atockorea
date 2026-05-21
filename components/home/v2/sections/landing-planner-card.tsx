"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { useI18n, useTranslations } from "@/lib/i18n";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";
import { PLANNER_BUILD_PREVIEW } from "@/lib/home/planner-builder-preview";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { analytics, getExperimentVariantAsync } from "@/src/design/analytics";
import { PLANNER_BUILD_EVENT } from "@/lib/home/planner-build-bridge";
import { cn } from "@/lib/utils";

/** v3 Phase D.1 — desktop in-place morphing panel.
 *
 *  Dynamic + ssr:false so the heavy static-tour-product registry chain
 *  (25MB of JSON across 204 locale files) stays OUT of the hero/LCP
 *  bundle. The panel is no-op for variant A / mobile / idle phase, so
 *  rendering it lazily after first paint has no UX cost for those users. */
const MatcherMorphingPanel = dynamic(
  () =>
    import("@/components/home/v2/MatcherMorphingPanel").then(
      (m) => m.MatcherMorphingPanel,
    ),
  { ssr: false, loading: () => null },
);

type PlannerMode = "match" | "build";

const BTN_PRIMARY_STYLE = {
  boxShadow: "var(--home-shadow-btn-primary)",
  border: "none",
} as const;

export type LandingPlannerCardProps = {
  destination: HeroDestination;
  onDestinationChange: (destination: HeroDestination) => void;
  intent: string;
  onIntentChange: (intent: string) => void;
  /** Append a style/season phrase into the intent field. Owned by
   *  HeroSection (functional setState) so the season pill in the photo
   *  block and the style chips here mutate the same field consistently. */
  onAppendChip: (phrase: string) => void;
  /** 200ms glow ring after a season-chip injection. Owned by HeroSection
   *  because the season pill that triggers it lives in the photo headline. */
  intentGlowing: boolean;
};

/**
 * Unified planner card (Phase 1 extraction + Phase 2 mode switch).
 *
 * Two modes share the same destination / intent / style controls:
 *  - "match" → the smart matcher (existing in-page flow + cta-copy A/B).
 *  - "build" → routes into the itinerary builder for jeju/busan, or shows a
 *    manual-request fallback for seoul (builder map supports jeju+busan only).
 *
 * Shared controls live OUTSIDE the AnimatePresence; only the mode body (the
 * CTA area) cross-fades on switch, so destination/intent never reset.
 */
export function LandingPlannerCard({
  destination,
  onDestinationChange,
  intent,
  onIntentChange,
  onAppendChip,
  intentGlowing,
}: LandingPlannerCardProps) {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const { startInPageMatchFlow, phase: matchPhase } = useHomeV2Match();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<PlannerMode>("match");
  const [intentExpanded, setIntentExpanded] = useState(false);
  const intentInputRef = useRef<HTMLTextAreaElement>(null);
  const intentFocusFiredRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Phase 5 bridge — a match-result surface dispatches PLANNER_BUILD_EVENT when
  // the user picks "Build your own day in {destination}". The result surface has
  // already reset the match to idle (closing itself), so here we just flip into
  // build mode and bring the card into view. destination/intent are unchanged
  // (current props), so the same destination carries over.
  useEffect(() => {
    const onBuildRequest = () => {
      setMode("build");
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "center",
        });
      });
    };
    window.addEventListener(PLANNER_BUILD_EVENT, onBuildRequest);
    return () => window.removeEventListener(PLANNER_BUILD_EVENT, onBuildRequest);
  }, [reduceMotion]);

  const styleChipOptions = useMemo(
    () =>
      HOME_STYLE_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(`premium.comparison.${opt.labelKey}`),
      })),
    [t],
  );

  // home_cta_copy A/B — first paint shows control copy and then re-renders
  // with the assigned variant once the experiment registry loads. Degrades to
  // control automatically once the experiment is concluded (variant → null).
  const [ctaVariant, setCtaVariant] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getExperimentVariantAsync("home_cta_copy").then((v) => {
      if (cancelled) return;
      if (v) setCtaVariant(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaCopyKey =
    ctaVariant === "B" ? "premium.hero.findMatchCtaB" : "premium.hero.findMatchCta";

  const handleSubmit = useCallback(() => {
    const raw = intent.trim() || t("premium.hero.defaultMatchIntent");
    void startInPageMatchFlow(raw, locale, destination);
  }, [intent, locale, startInPageMatchFlow, t, destination]);

  // Derived analytics payload bits — no free text leaves the page, only the
  // chip count + a hasIntent boolean (PII-safe, matches sanitize policy).
  const selectedChipCount = useMemo(
    () => styleChipOptions.filter((opt) => intent.includes(opt.label)).length,
    [styleChipOptions, intent],
  );

  const handleStartBuilding = useCallback(() => {
    analytics.unifiedPlannerBuildStart({
      destination,
      hasIntent: intent.trim().length > 0,
      selectedChipCount,
    });
    // ?region=... (not the direct /[region] route) so the builder IntakeForm
    // pre-fills and keeps its track/date step. intent rides along for Phase 4.
    router.push(
      `/itinerary-builder?region=${destination}&intent=${encodeURIComponent(intent)}`,
    );
  }, [router, destination, intent, selectedChipCount]);

  const chipLooksSelected = useCallback(
    (label: string) => intent.includes(label),
    [intent],
  );

  const handleModeSwitch = useCallback(
    (next: PlannerMode) => {
      if (next === mode) return;
      analytics.unifiedPlannerModeSwitch({ mode: next, destination });
      setMode(next);
    },
    [mode, destination],
  );

  // `animate` (the at-rest state AnimatePresence renders on first mount, since
  // it has initial={false}) is deterministic across SSR/CSR so the hydrated
  // <motion.div> style matches. Only initial/exit/transition — none of which
  // affect the first-mount SSR style — branch on reduceMotion. Previously the
  // whole object branched, so the server (useReducedMotion() === null → slide
  // branch) rendered style={{opacity:"1",transform:"none"}} while the
  // reduce-motion client rendered style={{opacity:1}} → hydration mismatch
  // (§C 2026-05-21).
  const bodyMotion = {
    initial: reduceMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <div ref={cardRef} className="relative mx-auto max-w-lg">
      <div className="relative rounded-card border border-slate-200/70 bg-white p-4 shadow-1 md:p-5">
        {/* Desktop in-place result morphing — match mode only (no-op for
            variant A / mobile / idle phase). */}
        {mode === "match" && <MatcherMorphingPanel />}

        {/* Mode switch — segmented control. Two buttons + aria-pressed. */}
        <div
          role="group"
          aria-label={t("premium.v2.planner.modeSwitchAria")}
          className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 md:mb-4"
        >
          {(
            [
              ["match", "modeMatch"] as const,
              ["build", "modeBuild"] as const,
            ] as const
          ).map(([m, labelKey]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => handleModeSwitch(m)}
              className={cn(
                "focus-ring rounded-full px-3 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-200 md:text-caption",
                mode === m
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t(`premium.v2.planner.${labelKey}`)}
            </button>
          ))}
        </div>

        {/* ── Shared controls (outside AnimatePresence) ───────────────── */}
        <div className="mb-3 md:mb-4">
          <label
            id="home-v2-destination-label"
            className="mb-2.5 block text-caption font-semibold text-slate-700"
          >
            {t("premium.hero.destinationSectionTitle")}
          </label>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-labelledby="home-v2-destination-label"
          >
            {(
              [
                ["jeju", "destJeju"] as const,
                ["seoul", "destSeoul"] as const,
                ["busan", "destBusan"] as const,
              ] as const
            ).map(([id, labelKey]) => {
              const active = destination === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onDestinationChange(id)}
                  className={cn(
                    "focus-ring rounded-button border px-2 py-3 text-center text-[14px] font-semibold tracking-tight transition-colors duration-200 md:py-3.5 md:text-[15px]",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200/70 bg-slate-50 text-slate-900 hover:bg-slate-100",
                  )}
                >
                  {t(`premium.hero.${labelKey}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 md:mb-4">
          <div className="relative">
            {/*
             * Expandable intent field.
             * Collapsed: single-line input height (h-12 / md:h-14) with a
             * compact 11px placeholder so the long EN copy stays on one line
             * even on narrow viewports. Truncates with ellipsis if it ever
             * overflows.
             * Expanded (focus or typed): grows downward into a multi-line
             * drawer with the standard text-caption scale. External callers
             * still query via [data-home-hero-intent].
             */}
            <textarea
              id="home-v2-hero-intent"
              ref={intentInputRef}
              data-home-hero-intent
              value={intent}
              onChange={(e) => onIntentChange(e.target.value)}
              onFocus={() => {
                setIntentExpanded(true);
                if (!intentFocusFiredRef.current) {
                  intentFocusFiredRef.current = true;
                  analytics.homeHeroIntentFocus();
                }
              }}
              onBlur={() => {
                if (!intent.trim()) setIntentExpanded(false);
              }}
              rows={1}
              placeholder={t("premium.hero.inputPlaceholder")}
              autoComplete="off"
              aria-label={t("premium.hero.intentInputAria")}
              className={cn(
                "w-full resize-none rounded-button border bg-slate-50 px-3.5 text-slate-800 transition-[height,padding,border-color,background-color,box-shadow] duration-300 ease-out placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus-ring md:px-4",
                intentGlowing
                  ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]"
                  : "border-slate-200/70",
                intentExpanded
                  ? "h-32 overflow-auto py-3 text-caption md:h-40 md:py-4"
                  : "h-12 overflow-hidden truncate py-3.5 text-[11px] leading-tight md:h-14 md:py-4 md:text-caption",
              )}
            />
          </div>
        </div>

        <div className="mb-3 md:mb-4" role="group" aria-label={t("premium.comparison.chipsAria")}>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none md:gap-2">
            {styleChipOptions.map((tag) => {
              const isSelected = chipLooksSelected(tag.label);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    analytics.homeHeroStyleChipClick({ chipId: tag.id });
                    onAppendChip(tag.label);
                  }}
                  className={cn(
                    "focus-ring flex-none rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors duration-200 md:px-3.5 md:py-2 md:text-caption",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200/70 bg-slate-50 text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mode body (only this cross-fades on switch) ─────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} {...bodyMotion}>
            {mode === "match" ? (
              <>
                <V0ShadcnButton
                  type="button"
                  size="lg"
                  disabled={matchPhase === "loading"}
                  aria-busy={matchPhase === "loading"}
                  onClick={handleSubmit}
                  className={homeBtnPrimary}
                  style={BTN_PRIMARY_STYLE}
                >
                  {t(ctaCopyKey)}
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </V0ShadcnButton>
                <p className="mt-2.5 text-center text-micro font-medium text-slate-500">
                  {t("premium.v2.hero.smartMatchMicrocopy")}
                </p>
              </>
            ) : destination === "jeju" || destination === "busan" ? (
              <>
                <div className="overflow-hidden rounded-button border border-slate-200/70">
                  <div className="relative h-24 w-full md:h-28">
                    <Image
                      src={PLANNER_BUILD_PREVIEW[destination].image}
                      alt={PLANNER_BUILD_PREVIEW[destination].imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 512px"
                      loading="lazy"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                  {PLANNER_BUILD_PREVIEW[destination].stops.map((stop) => (
                    <span
                      key={stop}
                      className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {stop}
                    </span>
                  ))}
                </div>
                <p className="mb-3 mt-2.5 text-center text-micro text-slate-500">
                  {t("premium.v2.planner.buildPreviewMicrocopy")}
                </p>
                <V0ShadcnButton
                  type="button"
                  size="lg"
                  onClick={handleStartBuilding}
                  className={homeBtnPrimary}
                  style={BTN_PRIMARY_STYLE}
                >
                  {t("premium.v2.planner.buildCta")}
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </V0ShadcnButton>
                <p className="mt-2.5 text-center text-micro font-medium text-slate-500">
                  {t("premium.v2.planner.buildMicrocopy")}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-button border border-slate-200/70 bg-slate-50 p-4 text-center">
                  <p className="text-caption font-semibold text-slate-900">
                    {t("premium.v2.planner.seoulBuildTitle")}
                  </p>
                  <p className="mt-1.5 text-micro text-slate-600">
                    {t("premium.v2.planner.seoulBuildBody")}
                  </p>
                </div>
                <V0ShadcnButton
                  type="button"
                  size="lg"
                  onClick={() => {
                    analytics.unifiedPlannerSeoulRequest({
                      hasIntent: intent.trim().length > 0,
                    });
                    // Placeholder behaviour (no Seoul request endpoint yet):
                    // flip back to Match mode. setMode directly, not via
                    // handleModeSwitch, so this logs a seoul_request rather than
                    // a misleading mode_switch.
                    setMode("match");
                  }}
                  className={cn(homeBtnPrimary, "mt-3")}
                  style={BTN_PRIMARY_STYLE}
                >
                  {t("premium.v2.planner.seoulBuildCta")}
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </V0ShadcnButton>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
