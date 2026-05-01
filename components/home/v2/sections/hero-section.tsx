"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ShieldCheck, ChevronRight, ChevronDown, Award, Headphones } from "lucide-react";
import { useI18n, useTranslations } from "@/lib/i18n";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import {
  HOME_V2_HERO_VIDEO_POSTER,
  HOME_V2_SHARED_COASTAL_VIDEO_MP4,
} from "@/lib/home/home-v2-visual-media";
import { cn } from "@/lib/utils";

/** Same split as legacy `HeroPremium` (calmer ATF). */
const HERO_CHIP_PREVIEW_COUNT = 3;

const VALID_DESTINATIONS: ReadonlyArray<HeroDestination> = ["jeju", "seoul", "busan"];

function readDestinationFromParams(value: string | null): HeroDestination | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return (VALID_DESTINATIONS as ReadonlyArray<string>).includes(lower)
    ? (lower as HeroDestination)
    : null;
}

export function HeroSection() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const { startInPageMatchFlow, phase: matchPhase } = useHomeV2Match();
  const searchParams = useSearchParams();

  const initialDestination = useMemo(
    () => readDestinationFromParams(searchParams?.get("destination") ?? null) ?? "jeju",
    [searchParams],
  );
  const [destination, setDestination] = useState<HeroDestination>(initialDestination);
  const [intent, setIntent] = useState("");
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [intentExpanded, setIntentExpanded] = useState(false);
  const intentInputRef = useRef<HTMLTextAreaElement>(null);

  const styleChipOptions = useMemo(
    () =>
      HOME_STYLE_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(`premium.comparison.${opt.labelKey}`),
      })),
    [t],
  );

  const previewChips = useMemo(
    () => styleChipOptions.slice(0, HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions],
  );

  const extraChips = useMemo(
    () => styleChipOptions.slice(HERO_CHIP_PREVIEW_COUNT),
    [styleChipOptions],
  );

  const hasExpandableChips = extraChips.length > 0;

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
  }, []);

  const handleSubmit = useCallback(() => {
    const raw = intent.trim() || t("premium.hero.defaultMatchIntent");
    void startInPageMatchFlow(raw, locale, destination);
  }, [intent, locale, startInPageMatchFlow, t, destination]);

  const chipLooksSelected = useCallback((label: string) => intent.includes(label), [intent]);

  return (
    <section className="relative flex flex-col" data-home-hero>
      {/* ~40% taller than 18/19/24vh (was read as “half” on some viewports; more ATF for photo+video). */}
      <div className="relative min-h-[25.2vh] sm:min-h-[26.6vh] md:min-h-[33.6vh] flex flex-col justify-end overflow-hidden pb-3 md:pb-5">
        <div className="absolute inset-0">
          {/* Static photo layer — always in DOM; video stacks above when playback works. */}
          <Image
            src={HOME_V2_HERO_VIDEO_POSTER}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            aria-hidden
          />
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={HOME_V2_HERO_VIDEO_POSTER}
            className="absolute inset-0 z-[1] h-full w-full object-cover"
            aria-hidden
          >
            <source src={HOME_V2_SHARED_COASTAL_VIDEO_MP4} type="video/mp4" />
          </video>
          <div className="absolute inset-0 z-[2] bg-black/[0.46]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-7 bg-gradient-to-t from-[#faf9f7] to-transparent md:h-9"
            aria-hidden
          />
        </div>

        <div className="relative z-10 mx-auto mb-3 w-full max-w-2xl px-4 pb-1 text-center sm:px-5 md:mb-4 md:px-8">
          <h1
            className="mb-2 text-[1.65rem] font-bold leading-[1.12] tracking-[-0.02em] text-white md:mb-2.5 md:text-4xl lg:text-[3.15rem]"
            style={{
              textShadow: "0 2px 20px rgba(0,0,0,0.45)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {t("premium.hero.headlineLine1")}
          </h1>

          <p
            className="mx-auto max-w-md text-[14px] font-medium leading-snug tracking-wide text-white/90 md:text-[16px] md:leading-relaxed"
            style={{ textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}
          >
            {t("premium.hero.atfHeroSubhead")}
          </p>
        </div>
      </div>

      <div
        className="relative px-4 md:px-8 pt-0 pb-8 md:pb-10"
        style={{ background: "linear-gradient(to bottom, #faf9f7, #fdfcfb, #ffffff)" }}
      >
        <div className="relative mx-auto max-w-lg -mt-2 md:-mt-3">
          <div
            className="absolute -inset-1 rounded-[var(--home-radius-hero-planner)] bg-gradient-to-b from-white/55 via-amber-50/15 to-transparent opacity-50 blur-xl"
            aria-hidden
          />

          <div className="relative home-panel-elevated p-6 md:p-8 before:pointer-events-none before:absolute before:inset-x-12 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-300/40 before:to-transparent">
            <div className="mb-7 md:mb-8">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                {t("premium.v2.hero.plannerTitle")}
              </h2>
            </div>

            <div className="mb-7 md:mb-8">
              <label
                id="home-v2-destination-label"
                className="mb-3 block text-sm font-semibold text-slate-800 md:text-[15px]"
              >
                {t("premium.hero.destinationSectionTitle")}
              </label>
              <div
                className="grid grid-cols-3 gap-2 md:gap-2.5"
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
                      onClick={() => setDestination(id)}
                      className={`rounded-xl px-2 py-3 text-center font-medium transition-all duration-[250ms] md:rounded-2xl md:px-3 md:py-3.5 ${
                        active
                          ? "bg-slate-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12),0_6px_20px_rgba(0,0,0,0.08)]"
                          : "border border-slate-200/60 bg-slate-50/80 text-slate-600 hover:bg-slate-100/80"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold tracking-[-0.01em] md:text-[14px]">
                        {t(`premium.hero.${labelKey}`)}
                      </span>
                      <span
                        className={`mt-1 flex items-center justify-center gap-1 text-[10px] font-medium tracking-wide md:text-[11px] ${
                          active ? "text-emerald-300" : "text-emerald-600"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full md:h-1.5 md:w-1.5 ${
                            active ? "bg-emerald-400" : "bg-emerald-500"
                          }`}
                        />
                        {t("premium.hero.destSegmentLabelAvailable")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-7 md:mb-8">
              <div className="relative">
                {/*
                 * Expandable intent field.
                 * Collapsed (blur + empty)  : looks like a single-line input (h-12 / md:h-14).
                 * Expanded  (focus or typed): grows downward into a multi-line drawer
                 *                             so users can describe their trip in detail.
                 * A <textarea> is used so the expanded state can hold real line breaks.
                 * External callers still query via [data-home-hero-intent] (tag-neutral).
                 */}
                <textarea
                  id="home-v2-hero-intent"
                  ref={intentInputRef}
                  data-home-hero-intent
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  onFocus={() => setIntentExpanded(true)}
                  onBlur={() => {
                    if (!intent.trim()) setIntentExpanded(false);
                  }}
                  rows={1}
                  placeholder={t("premium.hero.inputPlaceholder")}
                  autoComplete="off"
                  aria-label={t("premium.hero.intentInputAria")}
                  className={cn(
                    // Compact mobile typography so the long placeholder (EN is
                    // the outlier at ~44 chars) fits on ~260–320px viewports
                    // without horizontal clipping while collapsed. Placeholder
                    // is rendered a touch smaller than the typed content, so
                    // real user text stays comfortably readable at 12.5px while
                    // the hint shrinks to 11.5px to avoid the trailing ellipsis
                    // getting truncated. Desktop keeps the standard size.
                    "w-full resize-none rounded-2xl border border-slate-200/90 bg-white px-3.5 text-[12.5px] leading-[1.45] tracking-[-0.012em] text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-[height,padding,box-shadow,border-color] duration-300 ease-out placeholder:text-[11.5px] placeholder:tracking-[-0.02em] placeholder:text-slate-400 focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/15 md:px-4 md:text-[15px] md:leading-[1.5] md:tracking-normal md:placeholder:text-[15px] md:placeholder:tracking-normal",
                    intentExpanded
                      ? "h-32 overflow-auto py-3 md:h-40 md:py-4"
                      : "h-12 overflow-hidden py-[14.75px] md:h-14 md:py-[17px]",
                  )}
                />
              </div>
            </div>

            <div className="mb-7 md:mb-8" role="group" aria-label={t("premium.comparison.chipsAria")}>
              <p className="mb-3 text-sm font-semibold text-slate-800 md:text-[15px]">{t("premium.hero.chipsLegend")}</p>
              <div className="flex flex-wrap gap-2 md:gap-2.5">
                {previewChips.map((tag) => {
                  const isSelected = chipLooksSelected(tag.label);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => appendChip(tag.label)}
                      className={`rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 md:px-4 md:py-2.5 md:text-sm ${
                        isSelected
                          ? "bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                          : "text-slate-600 hover:bg-slate-100/80"
                      }`}
                      style={
                        !isSelected
                          ? {
                              background: "linear-gradient(to bottom, #fafafa, #f5f5f5)",
                              border: "1px solid rgba(0,0,0,0.06)",
                            }
                          : undefined
                      }
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              {hasExpandableChips ? (
                <div
                  id="home-v2-hero-chips-expanded"
                  className={cn("mt-2 flex flex-wrap gap-1.5 md:gap-2", !chipsExpanded && "hidden")}
                >
                  {extraChips.map((tag) => {
                    const isSelected = chipLooksSelected(tag.label);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => appendChip(tag.label)}
                        className={`rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 md:px-4 md:py-2.5 md:text-sm ${
                          isSelected
                            ? "bg-slate-800 text-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                            : "text-slate-600 hover:bg-slate-100/80"
                        }`}
                        style={
                          !isSelected
                            ? {
                                background: "linear-gradient(to bottom, #fafafa, #f5f5f5)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }
                            : undefined
                        }
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {hasExpandableChips && !chipsExpanded ? (
                <button
                  type="button"
                  aria-expanded="false"
                  aria-controls="home-v2-hero-chips-expanded"
                  onClick={() => setChipsExpanded(true)}
                  className="mt-2 text-[10px] md:text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5"
                >
                  {t("premium.hero.chipsShowMore")}
                  <ChevronDown className="w-3 h-3" aria-hidden />
                </button>
              ) : null}

              {hasExpandableChips && chipsExpanded ? (
                <button
                  type="button"
                  aria-expanded="true"
                  aria-controls="home-v2-hero-chips-expanded"
                  onClick={() => setChipsExpanded(false)}
                  className="mt-2 text-[10px] md:text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {t("premium.hero.chipsShowLess")}
                </button>
              ) : null}
            </div>

            <p className="mb-5 text-center text-[13px] leading-snug text-slate-500 md:mb-6 md:text-sm">
              {t("premium.v2.hero.preCtaLine")}
            </p>

            <V0ShadcnButton
              type="button"
              size="lg"
              disabled={matchPhase === "loading"}
              aria-busy={matchPhase === "loading"}
              onClick={handleSubmit}
              className="h-auto w-full rounded-xl py-5 text-[15px] font-semibold transition-all duration-300 disabled:opacity-70 md:py-6 md:text-base"
              style={{
                background: "linear-gradient(to bottom, #1e3a5f, #172d4a)",
                boxShadow: "var(--home-shadow-btn-primary)",
                border: "none",
                color: "#fff",
              }}
            >
              {t("premium.hero.findMatchCta")}
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </V0ShadcnButton>
          </div>
        </div>

        <div className="mt-6 md:mt-7 flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1.5 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
            <span className="text-[11px] md:text-[12px] font-semibold tracking-[0.01em] text-slate-700">
              {t("premium.v2.hero.credentialKto")}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1.5 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Award className="w-3.5 h-3.5 text-amber-600" aria-hidden />
            <span className="text-[11px] md:text-[12px] font-semibold tracking-[0.01em] text-slate-700">
              {t("premium.v2.hero.credentialExperience")}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1.5 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Headphones className="w-3.5 h-3.5 text-sky-600" aria-hidden />
            <span className="text-[11px] md:text-[12px] font-semibold tracking-[0.01em] text-slate-700">
              {t("premium.v2.hero.credentialSupport")}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
