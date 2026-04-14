"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";
import { buildCustomJoinTourHref } from "@/lib/home/services/custom-join-href";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { useHomepageJoinCardImage } from "@/hooks/home/useHomepageJoinCardImage";
import { useHeroMobileMatchFlow } from "@/hooks/home/useHeroMobileMatchFlow";
import { CardFilmGrain, ProductCardCheckIcon } from "@/src/components/home/product-card-glass";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";
import { cn } from "@/lib/utils";
import { HOME_CTA_FEATURED_JOIN_TOUR_HREF } from "@/lib/home/home-cta-routes";

/** Tier-2 quick tags: minimal preview at rest; rest behind expandable row (calmer ATF). */
const HERO_CHIP_PREVIEW_COUNT = 3;

const CUSTOM_JOIN_HREF = "/custom-join-tour";
/** Live East Jeju small-group product (join tour detail). */
const EAST_JEJU_SMALL_GROUP_TOUR_HREF = HOME_CTA_FEATURED_JOIN_TOUR_HREF;

const MOBILE_HERO_MQ = "(max-width: 639px)";
const HERO_INTRO_VIDEO_URL = (process.env.NEXT_PUBLIC_HERO_INTRO_VIDEO_URL ?? "").trim();
/** If video never becomes playable, fall back to textarea (ms). */
const HERO_INTRO_VIDEO_FAILSAFE_MS = 12_000;
const HERO_VIDEO_FADE_MS = 520;
const HERO_RESULT_FADE_MS = 520;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function IconPlannerOutcomeMap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21c-3.314 0-6-2.463-6-6.5 0-3.5 4-8.5 6-11 2 2.5 6 7.5 6 11 0 4.037-2.686 6.5-6 6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconPlannerStyle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="12.5" width="10" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <path d="M16.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function IconPlannerPace({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 15.5c1.8-3.2 4.2-4.8 7-4.5 2.1.2 3.8 1.6 5.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="9" r="1.35" fill="currentColor" opacity="0.35" />
      <circle cx="14" cy="7.5" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="17.5" cy="12" r="1.1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

type HeroIntentWellProps = {
  isMobileSlot: boolean;
  videoUrl: string;
  prefersReducedMotion: boolean;
  intent: string;
  setIntent: (v: string) => void;
  placeholder: string;
  fieldLabel: string;
  introVideoAria: string;
  introDismissAria: string;
  introPlayAria: string;
};

/**
 * F1–F3: Desktop = classic well + textarea. Mobile = 16:9 frame, optional muted intro video
 * (Cloudinary URL), center play if autoplay blocked, top-right dismiss, failsafe → textarea.
 */
function HeroIntentWell({
  isMobileSlot,
  videoUrl,
  prefersReducedMotion,
  intent,
  setIntent,
  placeholder,
  fieldLabel,
  introVideoAria,
  introDismissAria,
  introPlayAria,
}: HeroIntentWellProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useVideo = Boolean(isMobileSlot && videoUrl && !prefersReducedMotion);
  const [videoLayerOn, setVideoLayerOn] = useState(useVideo);
  const [videoOpacity, setVideoOpacity] = useState(useVideo ? 1 : 0);
  const [textareaOpacity, setTextareaOpacity] = useState(useVideo ? 0 : 1);
  const [needsPlayGesture, setNeedsPlayGesture] = useState(false);

  const clearTimers = useCallback(() => {
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const finishIntroToTextarea = useCallback(() => {
    clearTimers();
    setVideoOpacity(0);
    fadeTimerRef.current = setTimeout(() => {
      setVideoLayerOn(false);
      setTextareaOpacity(1);
      setNeedsPlayGesture(false);
    }, HERO_VIDEO_FADE_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!useVideo) {
      setVideoLayerOn(false);
      setVideoOpacity(0);
      setTextareaOpacity(1);
      setNeedsPlayGesture(false);
      clearTimers();
      return;
    }
    setVideoLayerOn(true);
    setVideoOpacity(1);
    setTextareaOpacity(0);
    setNeedsPlayGesture(false);
    failsafeRef.current = setTimeout(() => {
      finishIntroToTextarea();
    }, HERO_INTRO_VIDEO_FAILSAFE_MS);
    return () => clearTimers();
  }, [useVideo, clearTimers, finishIntroToTextarea]);

  const tryAutoplay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    const p = el.play();
    if (p !== undefined) {
      p
        .then(() => setNeedsPlayGesture(false))
        .catch(() => setNeedsPlayGesture(true));
    }
  }, []);

  const onLoadedData = useCallback(() => {
    tryAutoplay();
  }, [tryAutoplay]);

  const onVideoError = useCallback(() => {
    finishIntroToTextarea();
  }, [finishIntroToTextarea]);

  const onVideoEnded = useCallback(() => {
    finishIntroToTextarea();
  }, [finishIntroToTextarea]);

  const onPlayClick = useCallback(() => {
    tryAutoplay();
  }, [tryAutoplay]);

  if (!isMobileSlot) {
    return (
      <div className="hero-planner-desk-well mt-1 sm:mt-1.5">
        <textarea
          id="hero-intent-input"
          name="intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="hero-planner-field hero-planner-field--hero-primary"
          autoComplete="off"
          aria-label={fieldLabel}
        />
      </div>
    );
  }

  return (
    <div className="hero-planner-desk-well hero-planner-desk-well--hero-media-slot mt-1 sm:mt-1.5">
      <div className="hero-planner-media-slot-frame relative">
        <textarea
          id="hero-intent-input"
          name="intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={cn(
            "absolute inset-0 z-[1] hero-planner-field hero-planner-field--hero-primary hero-planner-field--hero-primary--media-slot",
            textareaOpacity < 0.05 && "pointer-events-none"
          )}
          style={{ opacity: textareaOpacity, transition: `opacity ${HERO_VIDEO_FADE_MS}ms ease-out` }}
          autoComplete="off"
          aria-label={fieldLabel}
        />

        {videoLayerOn ? (
          <div
            className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-900/10"
            style={{ opacity: videoOpacity, transition: `opacity ${HERO_VIDEO_FADE_MS}ms ease-out` }}
          >
            <video
              ref={videoRef}
              className="hero-planner-intro-video z-0"
              src={videoUrl}
              muted
              playsInline
              preload="metadata"
              aria-label={introVideoAria}
              onLoadedData={onLoadedData}
              onError={onVideoError}
              onEnded={onVideoEnded}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1.5 z-[4] flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/55"
              aria-label={introDismissAria}
              data-hero-intro-dismiss
              onClick={finishIntroToTextarea}
            >
              <span className="text-lg font-light leading-none" aria-hidden>
                ×
              </span>
            </button>
            {needsPlayGesture ? (
              <button
                type="button"
                className="absolute z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg ring-1 ring-black/10 transition hover:bg-white"
                aria-label={introPlayAria}
                onClick={onPlayClick}
              >
                <IconPlay className="ml-0.5 h-7 w-7" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TranslateFn = (key: string) => string;

type HeroBestMatchArticleProps = {
  matchBgSrc: string;
  bestMatchLines: string[];
  t: TranslateFn;
  grainId: string;
  className?: string;
  style?: CSSProperties;
};

function HeroBestMatchArticle({ matchBgSrc, bestMatchLines, t, grainId, className, style }: HeroBestMatchArticleProps) {
  return (
    <article
      className={cn(
        "hero-best-match-preview group relative isolate flex min-h-[18.25rem] flex-col overflow-hidden rounded-home-card border border-white/48 bg-white/[0.06] shadow-home-hero-match ring-1 ring-sky-400/52 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-0.5 hover:border-white/58 hover:shadow-home-hero-match-hover sm:min-h-[20rem] md:min-h-[21rem]",
        className
      )}
      style={style}
      aria-labelledby="hero-best-match-title"
      aria-describedby="hero-best-match-badge"
    >
      <Image
        src={matchBgSrc}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 896px"
        className="z-0 object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]"
        priority
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] rounded-home-card bg-gradient-to-b from-slate-900/40 via-slate-900/14 to-slate-950/[0.86] backdrop-blur-[10px] backdrop-saturate-[1.22]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[76%] rounded-b-home-card bg-gradient-to-t from-black/62 via-black/28 to-transparent"
        aria-hidden
      />
      <CardFilmGrain id={grainId} className="rounded-home-card opacity-[0.28]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-px rounded-t-home-card bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-95"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-px rounded-b-home-card bg-gradient-to-r from-transparent via-white/26 to-transparent opacity-78"
        aria-hidden
      />

      <Link
        href={EAST_JEJU_SMALL_GROUP_TOUR_HREF}
        className="absolute inset-0 z-[11] rounded-home-card outline-none ring-inset focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={`${t("premium.hero.bestMatchTitleLine1")} ${t("premium.hero.bestMatchTitleLine2")} — ${t("premium.hero.bestMatchCta")}`}
        onClick={() => analytics.heroFormStart()}
      />

      <div className="relative z-[12] flex h-full min-h-[18.25rem] flex-1 flex-col justify-end px-4 pb-4 pt-10 text-white pointer-events-none sm:min-h-[20rem] sm:px-5 sm:pb-5 sm:pt-12 md:min-h-[21rem] md:px-6 md:pb-5 md:pt-14">
        <div className="flex w-full flex-col">
          <span
            id="hero-best-match-badge"
            className="home-pill-badge-on-image home-pill-badge-on-image--cool home-pill-badge-on-image--hero-preview w-fit"
          >
            {t("premium.hero.bestMatchBadge")}
          </span>
          <h2
            id="hero-best-match-title"
            className="mt-2 text-[1.74rem] font-black leading-[1.02] tracking-[-0.038em] text-white drop-shadow-[0_3px_28px_rgba(0,0,0,0.48)] sm:mt-2.5 sm:text-[1.95rem]"
          >
            <span className="block">{t("premium.hero.bestMatchTitleLine1")}</span>
            <span className="mt-0.5 block">{t("premium.hero.bestMatchTitleLine2")}</span>
          </h2>
          <ul className="mt-2.5 max-w-md space-y-1.5 text-[11px] font-semibold leading-snug tracking-[-0.012em] text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:mt-3 sm:space-y-2 sm:text-[12px] sm:leading-[1.5]">
            {bestMatchLines.map((line: string) => (
              <li key={line} className="flex items-start gap-1.5 sm:gap-2">
                <ProductCardCheckIcon compact />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <span className="offer-card-cta offer-card-cta--hero-match cursor-pointer justify-center text-center sm:justify-start sm:text-left">
            {t("premium.hero.bestMatchCta")}
          </span>
        </div>

        <p className="pointer-events-auto mt-2.5 border-t border-white/12 pt-2 text-center text-[9px] font-medium leading-tight tracking-[-0.01em] text-white/45 sm:mt-3 sm:pt-2.5 sm:text-[10px] sm:leading-snug">
          <span className="mr-1 font-semibold uppercase tracking-[0.14em] text-white/35 sm:mr-1.5 sm:tracking-[0.16em]">
            {t("premium.hero.alsoConsiderLabel")}
          </span>
          <Link
            href={CUSTOM_JOIN_HREF}
            className="inline-flex min-h-9 items-center font-semibold text-white/60 underline-offset-2 hover:text-white/85 hover:underline sm:min-h-0"
          >
            {t("premium.hero.alsoConsiderPrivate")}
          </Link>
          <span className="mx-1 text-white/25 sm:mx-1.5" aria-hidden>
            ·
          </span>
          <Link
            href="/tours/list"
            className="inline-flex min-h-9 items-center font-semibold text-white/60 underline-offset-2 hover:text-white/85 hover:underline sm:min-h-0"
          >
            {t("premium.hero.alsoConsiderBus")}
          </Link>
        </p>
      </div>
    </article>
  );
}

/**
 * Above-the-fold Korea day-tour matching: destination first, Jeju preferences, then best-match preview.
 * Mobile: F1–F8 intro video slot, match flow, in-hero result. Desktop: unchanged navigation CTA.
 */
export default function HeroPremium() {
  const t = useTranslations("home");
  const isMobileHero = useMediaQuery(MOBILE_HERO_MQ);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [destination, setDestination] = useState<HeroDestination>("jeju");
  const [intent, setIntent] = useState("");
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const matchBgSrc = useHomepageJoinCardImage(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);
  const { matchPhase, setMatchPhase, loadingStep, handleMobileMatchCta } = useHeroMobileMatchFlow();

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
  }, []);

  const continueHref = useMemo(
    () => buildCustomJoinTourHref({ basePath: CUSTOM_JOIN_HREF, destination, intent }),
    [intent, destination],
  );

  const bestMatchLines = useMemo(
    () => [t("premium.hero.bestMatchLine1"), t("premium.hero.bestMatchLine2")],
    [t]
  );

  const styleChipOptions = useMemo(
    () =>
      HOME_STYLE_OPTIONS.map((opt) => ({
        ...opt,
        label: t(`premium.comparison.${opt.labelKey}`),
      })),
    [t]
  );

  const previewStyleChips = useMemo(
    () => styleChipOptions.slice(0, HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions]
  );

  const extraStyleChips = useMemo(
    () => styleChipOptions.slice(HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions]
  );

  const hasExpandableChips = extraStyleChips.length > 0;

  const plannerOutcomeTiles = useMemo(
    () =>
      [
        {
          key: "dest",
          Icon: IconPlannerOutcomeMap,
          titleKey: "plannerOutcomeDestTitle" as const,
          microKey: "plannerOutcomeDestMicro" as const,
        },
        {
          key: "style",
          Icon: IconPlannerStyle,
          titleKey: "plannerOutcomeStyleTitle" as const,
          microKey: "plannerOutcomeStyleMicro" as const,
        },
        {
          key: "pace",
          Icon: IconPlannerPace,
          titleKey: "plannerOutcomePaceTitle" as const,
          microKey: "plannerOutcomePaceMicro" as const,
        },
      ] as const,
    []
  );

  const loadingLabel = useMemo(() => {
    if (loadingStep === 0) return t("premium.hero.matchLoadingAnalyzing");
    if (loadingStep === 1) return t("premium.hero.matchLoadingMatching");
    return t("premium.hero.matchLoadingComplete");
  }, [loadingStep, t]);

  const motionEase = [0.22, 1, 0.36, 1] as const;

  const plannerBlock = (
    <>
      <div className="hero-planner-surface" data-hero-intent-panel>
        <div className="hero-planner-flow-step">
          <p className="hero-planner-section-title hero-planner-section-title--compact">
            {t("premium.hero.destinationSectionTitle")}
          </p>
          <div
            className="hero-destination-segmented mt-1 sm:mt-1.5"
            role="group"
            aria-label={t("premium.hero.destinationSectionTitle")}
          >
            <button
              type="button"
              aria-pressed={destination === "jeju"}
              onClick={() => setDestination("jeju")}
              className={
                destination === "jeju"
                  ? "hero-destination-segment hero-destination-segment--active"
                  : "hero-destination-segment"
              }
            >
              <span className="hero-destination-segment__name">{t("premium.hero.destJeju")}</span>
              <span className="hero-destination-segment__badge hero-destination-segment__badge--live">
                {t("premium.hero.destSegmentLabelAvailable")}
              </span>
            </button>
            <button
              type="button"
              disabled
              tabIndex={-1}
              aria-disabled="true"
              aria-label={`${t("premium.hero.destSeoul")}, ${t("premium.hero.destStatusComingSoon")}`}
              className="hero-destination-segment hero-destination-segment--disabled"
            >
              <span className="hero-destination-segment__name">{t("premium.hero.destSeoul")}</span>
              <span className="hero-destination-segment__badge hero-destination-segment__badge--stacked">
                <span className="hero-destination-segment__badge-line">{t("premium.hero.destComingSoonLine1")}</span>
                <span className="hero-destination-segment__badge-line">{t("premium.hero.destComingSoonLine2")}</span>
              </span>
            </button>
            <button
              type="button"
              disabled
              tabIndex={-1}
              aria-disabled="true"
              aria-label={`${t("premium.hero.destBusan")}, ${t("premium.hero.destStatusComingSoon")}`}
              className="hero-destination-segment hero-destination-segment--disabled"
            >
              <span className="hero-destination-segment__name">{t("premium.hero.destBusan")}</span>
              <span className="hero-destination-segment__badge hero-destination-segment__badge--stacked">
                <span className="hero-destination-segment__badge-line">{t("premium.hero.destComingSoonLine1")}</span>
                <span className="hero-destination-segment__badge-line">{t("premium.hero.destComingSoonLine2")}</span>
              </span>
            </button>
          </div>
        </div>

        {destination === "jeju" ? (
          <div className="hero-planner-flow-step hero-planner-flow-step--preferences">
            <label htmlFor="hero-intent-input" className="hero-planner-field-label">
              {t("premium.hero.textareaLabelJeju")}
            </label>
            <HeroIntentWell
              isMobileSlot={isMobileHero}
              videoUrl={HERO_INTRO_VIDEO_URL}
              prefersReducedMotion={prefersReducedMotion}
              intent={intent}
              setIntent={setIntent}
              placeholder={t("premium.hero.inputPlaceholder")}
              fieldLabel={t("premium.hero.textareaLabelJeju")}
              introVideoAria={t("premium.hero.introVideoAria")}
              introDismissAria={t("premium.hero.introDismissAria")}
              introPlayAria={t("premium.hero.introPlayAria")}
            />

            <div className="hero-planner-chip-stack" role="group" aria-label={t("premium.comparison.chipsAria")}>
              <p className="hero-planner-chips-label hero-planner-chips-label--compact hero-planner-chips-label--hero-quiet mt-2 text-center sm:mt-2.5 sm:text-left">
                {t("premium.hero.chipsLegend")}
              </p>
              <div className="hero-planner-chip-row--hero flex flex-wrap justify-center sm:justify-start">
                {previewStyleChips.map((item: { id: string; label: string }) => {
                  const { id, label } = item;
                  const isActive = intent.includes(label);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => appendChip(label)}
                      className={
                        isActive
                          ? "hero-planner-chip hero-planner-chip--pill hero-planner-chip--active"
                          : "hero-planner-chip hero-planner-chip--pill"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {hasExpandableChips ? (
                <>
                  <div
                    className={
                      chipsExpanded
                        ? "hero-planner-chips-extra hero-planner-chips-extra--open"
                        : "hero-planner-chips-extra"
                    }
                    aria-hidden={!chipsExpanded}
                  >
                    <div className="hero-planner-chips-extra__inner">
                      <div className="hero-planner-chip-row--hero hero-planner-chip-row--hero-extra flex flex-wrap justify-center sm:justify-start">
                        {extraStyleChips.map((item: { id: string; label: string }) => {
                          const { id, label } = item;
                          const isActive = intent.includes(label);
                          return (
                            <button
                              key={id}
                              type="button"
                              tabIndex={chipsExpanded ? undefined : -1}
                              aria-pressed={isActive}
                              onClick={() => appendChip(label)}
                              className={
                                isActive
                                  ? "hero-planner-chip hero-planner-chip--pill hero-planner-chip--active"
                                  : "hero-planner-chip hero-planner-chip--pill"
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="hero-planner-chips-toggle-row flex justify-center sm:justify-start">
                    <button
                      type="button"
                      className="hero-planner-chips-toggle"
                      aria-expanded={chipsExpanded}
                      onClick={() => setChipsExpanded((prev) => !prev)}
                    >
                      {chipsExpanded ? t("premium.hero.chipsShowLess") : t("premium.hero.chipsShowMore")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {isMobileHero ? (
          <button type="button" className="hero-planner-cta hero-planner-cta--hero-primary" onClick={handleMobileMatchCta}>
            {t("premium.hero.findMatchCta")}
          </button>
        ) : (
          <Link
            href={continueHref}
            className="hero-planner-cta hero-planner-cta--hero-primary"
            onClick={() => analytics.heroFormStart()}
          >
            {t("premium.hero.findMatchCta")}
          </Link>
        )}

        <div className="hero-planner-price-inline" aria-label={t("premium.hero.pricingRowLabel")}>
          <div className="hero-planner-price-inline__row">
            <span className="hero-planner-meta-unit">
              <span className="home-type-price-anchor">{t("premium.hero.priceSmallGroup")}</span>
            </span>
            <span className="hero-planner-meta-unit">
              <span className="home-type-price-anchor">{t("premium.hero.pricePrivate")}</span>
            </span>
            <span className="hero-planner-meta-unit">
              <span className="home-type-price-anchor">{t("premium.hero.priceBus")}</span>
            </span>
            <span className="hero-planner-meta-unit hero-planner-meta-unit--note">
              <span className="home-type-price-anchor hero-planner-price-inline__min">{t("premium.hero.minGuests")}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="hero-planner-outcomes px-1 sm:px-0" aria-labelledby="hero-planner-outcomes-heading">
        <p id="hero-planner-outcomes-heading" className="hero-planner-outcomes-eyebrow">
          {t("premium.hero.plannerOutcomeEyebrow")}
        </p>
        <ul className="hero-planner-outcomes-grid">
          {plannerOutcomeTiles.map((row) => {
            const { key, Icon, titleKey, microKey } = row;
            return (
              <li key={key} className="hero-planner-outcome-tile">
                <span className="hero-planner-outcome-tile__icon" aria-hidden>
                  <Icon className="hero-planner-outcome-icon" />
                </span>
                <span className="hero-planner-outcome-tile__text">
                  <span className="hero-planner-outcome-tile__title">{t(`premium.hero.${titleKey}`)}</span>
                  <span className="hero-planner-outcome-tile__micro">{t(`premium.hero.${microKey}`)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <HeroBestMatchArticle grainId="hero-best-match-grain" matchBgSrc={matchBgSrc} bestMatchLines={bestMatchLines} t={t} />
    </>
  );

  return (
    <section className="home-hero-stack relative w-full bg-transparent" aria-label="Hero">
      <div className="hero-atf-inner mx-auto max-w-4xl space-y-3.5 sm:space-y-5">
        <header className="home-hero-text-cluster mx-auto flex max-w-2xl flex-col items-center px-2 text-center sm:px-2">
          <p className="home-hero-kicker">{t("premium.hero.glassBrandPill")}</p>
          {t("premium.hero.matchEyebrow").trim() ? (
            <p className="home-hero-match-eyebrow">{t("premium.hero.matchEyebrow")}</p>
          ) : null}
          <h1 className="home-type-display home-hero-headline text-balance text-[1.66rem] min-[380px]:text-[1.72rem] sm:text-[1.98rem] md:text-[2.12rem]">
            <span className="block">{t("premium.hero.headlineLine1")}</span>
            {t("premium.hero.headlineLine2").trim() ? (
              <span className="mt-1 block">{t("premium.hero.headlineLine2")}</span>
            ) : null}
          </h1>
          <p className="home-hero-support-line mx-auto max-w-[min(100%,19.5rem)] whitespace-pre-line sm:max-w-[22rem] md:max-w-[23rem]">
            {t("premium.hero.matchSubtitle")}
          </p>
        </header>

        {isMobileHero ? (
          <AnimatePresence mode="wait">
            {matchPhase === "planner" ? (
              <motion.div
                key="hero-planner-phase"
                initial={false}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.45, ease: motionEase }}
                className="space-y-3.5 sm:space-y-5"
              >
                {plannerBlock}
              </motion.div>
            ) : null}

            {matchPhase === "loading" ? (
              <motion.div
                key="hero-loading-phase"
                role="status"
                aria-live="polite"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: motionEase }}
                className="hero-planner-surface flex min-h-[14rem] flex-col items-center justify-center gap-3 px-4 py-10"
              >
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" aria-hidden />
                <p className="text-center text-sm font-semibold tracking-tight text-slate-700">{loadingLabel}</p>
              </motion.div>
            ) : null}

            {matchPhase === "result" ? (
              <motion.div
                key="hero-result-phase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: HERO_RESULT_FADE_MS / 1000, ease: motionEase }}
                className="space-y-4"
              >
                <HeroBestMatchArticle
                  grainId="hero-best-match-grain-result"
                  matchBgSrc={matchBgSrc}
                  bestMatchLines={bestMatchLines}
                  t={t}
                />
                <p className="px-1 text-center text-[13px] font-medium leading-snug tracking-tight text-slate-600 sm:text-sm">
                  {t("premium.hero.matchResultRecommendLine")}
                </p>
                <div className="flex flex-col items-stretch gap-2 px-1 pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/70 bg-white/55 px-6 text-sm font-bold tracking-tight text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white/90"
                    onClick={() => setMatchPhase("planner")}
                  >
                    {t("premium.hero.matchResultBackCta")}
                  </button>
                  <Link
                    href="/tours/list"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 px-6 text-sm font-bold tracking-tight text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-white"
                  >
                    {t("premium.hero.seeOtherToursCta")}
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        ) : (
          plannerBlock
        )}
      </div>
    </section>
  );
}
