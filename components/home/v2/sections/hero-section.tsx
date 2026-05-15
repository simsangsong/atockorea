"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ChevronRight } from "lucide-react";
import { useI18n, useTranslations } from "@/lib/i18n";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { cn } from "@/lib/utils";

const VALID_DESTINATIONS: ReadonlyArray<HeroDestination> = ["jeju", "seoul", "busan"];
const HERO_SLIDES = [
  { src: "/images/hero/jeju-hero.jpg", alt: "Jeju coastline and sky" },
  { src: "/images/hero/seoul-hero.jpg", alt: "Seoul city travel scene" },
  { src: "/images/hero/busan-hero.jpg", alt: "Busan coastal travel scene" },
] as const;

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
  const [intentExpanded, setIntentExpanded] = useState(false);
  const intentInputRef = useRef<HTMLTextAreaElement>(null);

  const heroSectionRef = useRef<HTMLElement>(null);

  const styleChipOptions = useMemo(
    () =>
      HOME_STYLE_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(`premium.comparison.${opt.labelKey}`),
      })),
    [t],
  );

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
  }, []);

  const handleSubmit = useCallback(() => {
    const raw = intent.trim() || t("premium.hero.defaultMatchIntent");
    void startInPageMatchFlow(raw, locale, destination);
  }, [intent, locale, startInPageMatchFlow, t, destination]);

  const chipLooksSelected = useCallback((label: string) => intent.includes(label), [intent]);

  return (
    <section ref={heroSectionRef} className="relative flex flex-col" data-home-hero>
      <style>{`
        @keyframes hero-kenburns {
          from { transform: scale(1) translate(0, 0); }
          to   { transform: scale(1.08) translate(-1.5%, -0.8%); }
        }
        .hero-kenburns {
          animation: hero-kenburns 20s ease-in-out infinite alternate;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-kenburns { animation: none; }
        }
        @keyframes hero-proof-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-proof-badge {
          animation: hero-proof-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-proof-badge { animation: none; }
        }
      `}</style>
      {/* Hero height: -15% from the previous 38/40/46vh per design feedback.
          The black base lets the photo crossfade read as a cinematic panel. */}
      <div className="relative min-h-[32vh] sm:min-h-[34vh] md:min-h-[39vh] flex flex-col justify-end overflow-hidden bg-black pb-2 md:pb-3">
        <div className="absolute inset-0">
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            {HERO_SLIDES.map((slide, index) => (
              <Image
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                sizes="100vw"
                className="home-hero-slide object-cover object-center"
                style={{ animationDelay: `${index * 4.5}s` }}
              />
            ))}
          </div>
          {/* The previous full-width scrim is gone; legibility is handled by a
              discrete text panel so the photography stays bright. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-7 bg-gradient-to-t from-[#faf9f7] to-transparent md:h-9"
            aria-hidden
          />
        </div>

        {/* Headline block: a soft radial gradient sits behind the text and
            feathers out past the text edges. Pure CSS keeps the photo layer
            bright without a per-frame backdrop-filter pass. */}
        <div className="relative z-10 mx-auto mb-1 w-full max-w-2xl px-3 pb-0.5 text-center sm:px-5 md:mb-2 md:px-8">
          <div className="relative inline-block max-w-full px-5 py-3 md:px-7 md:py-4">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.72)_35%,rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.18)_80%,transparent_95%)] md:-inset-x-16 md:-inset-y-8"
            />
            <h1
              className="text-[1.4rem] font-bold leading-tight tracking-[-0.02em] text-white md:text-[1.85rem] lg:text-[2.4rem]"
              style={{
                textShadow: "0 2px 14px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.55)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("premium.hero.headlineLine1")}
            </h1>

            <p
              className="mx-auto mt-1.5 max-w-md text-[12.5px] font-medium leading-snug tracking-wide text-white/95 md:mt-2 md:text-[14.5px] md:leading-relaxed"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.5)" }}
            >
              {t("premium.hero.atfHeroSubhead")}
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative px-4 md:px-8 pt-0 pb-8 md:pb-10"
        style={{ background: "linear-gradient(to bottom, #faf9f7, #fdfcfb, #ffffff)" }}
      >
        {/* ── Value Bridge ─────────────────────────────────────────── */}
        {/*
          Trust panel — compressed to exactly 3 stat cards (4.9★ rating, 100K+
          bookings, 8 platforms with Klook/GYG/Viator microcopy). The earlier
          version stacked redundant pill badges below the stats ("Direct
          partnerships", "4.9 · 100K+ verified", "Verified operators") that
          duplicated information already in the stat cards. Hero now leads
          with one clear lockup: headline + one-sentence body + 3 stats.
        */}
        <div className="mx-auto max-w-lg pt-5 pb-6">
          <div className="rounded-card border border-amber-200/50 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-50/60 px-5 py-5 shadow-1">
            <h2 className="mb-1.5 text-h3 text-slate-900">
              Stop searching. We already did it for you.
            </h2>
            <p className="mb-4 text-caption text-slate-700">
              Hand-picked tours run by the{" "}
              <span className="font-semibold text-slate-900">same operators</span>{" "}
              trusted by Klook, GetYourGuide and Viator.
            </p>

            {/* Stat cards — 3 equal columns. Only social-proof surface
                above the matcher. */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-image border border-amber-100 bg-white/80 px-2.5 py-3 text-center shadow-1">
                <span className="block text-[18px] font-extrabold leading-none tracking-tight text-slate-900">
                  4.9<span className="text-[11px] text-amber-400">★</span>
                </span>
                <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-600">avg. rating</span>
              </div>

              <div className="rounded-image border border-amber-100 bg-white/80 px-2.5 py-3 text-center shadow-1">
                <span className="block text-[18px] font-extrabold leading-none tracking-tight text-slate-900">100K+</span>
                <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-600">bookings</span>
              </div>

              <div className="rounded-image border border-amber-100 bg-white/80 px-2.5 py-3 text-center shadow-1">
                <span className="block text-[18px] font-extrabold leading-none tracking-tight text-slate-900">8</span>
                <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-600">platforms</span>
                <span className="mt-1 block text-micro font-medium leading-tight text-slate-500">Klook · GetYourGuide · Viator</span>
              </div>
            </div>
          </div>
        </div>
        {/* ────────────────────────────────────────────────────────── */}

        {/* Differentiator section header — sits above the planner card so the
            "this is a new way, not on any OTA" message lands before the user
            engages with the form. Outside the card on purpose so the planner
            card itself stays clean and task-focused. */}
        <div className="mx-auto mb-4 max-w-lg px-1 text-center md:mb-5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 md:text-[11px]">
            <span aria-hidden className="h-1 w-1 rounded-full bg-amber-500" />
            {t("premium.v2.hero.matcherEyebrow")}
            <span aria-hidden className="h-1 w-1 rounded-full bg-amber-500" />
          </span>
          <h2 className="mt-2 text-balance text-[18px] font-bold leading-snug tracking-tight text-slate-900 md:text-[22px]">
            {t("premium.v2.hero.matcherHeadline")}
          </h2>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-slate-600 md:text-[13px]">
            {t("premium.v2.hero.matcherSubline")}
          </p>
        </div>

        <div className="relative mx-auto max-w-lg">
          <div
            className="absolute -inset-1 rounded-[var(--home-radius-hero-planner)] bg-gradient-to-b from-white/55 via-amber-50/15 to-transparent opacity-50 blur-xl"
            aria-hidden
          />

          <div className="relative home-panel-elevated p-4 md:p-5 before:pointer-events-none before:absolute before:inset-x-12 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-300/40 before:to-transparent">
            <div className="mb-4 md:mb-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-900 px-2.5 py-1">
                <span className="text-[10px]" aria-hidden>✨</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-white">Smart Tour Matching</span>
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                {t("premium.v2.hero.plannerTitle")}
              </h2>
            </div>

            <div className="mb-4 md:mb-5">
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

            <div className="mb-4 md:mb-5">
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

            <div className="mb-4 md:mb-5" role="group" aria-label={t("premium.comparison.chipsAria")}>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none md:gap-2.5">
                {styleChipOptions.map((tag) => {
                  const isSelected = chipLooksSelected(tag.label);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => appendChip(tag.label)}
                      className={`flex-none rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200 md:px-4 md:py-2.5 md:text-sm ${
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
            </div>

            <V0ShadcnButton
              type="button"
              size="lg"
              disabled={matchPhase === "loading"}
              aria-busy={matchPhase === "loading"}
              onClick={handleSubmit}
              className="h-auto w-full rounded-xl py-4 text-[15px] font-semibold transition-all duration-300 disabled:opacity-70 md:py-5 md:text-base"
              style={{
                background: "linear-gradient(to bottom, #1e293b, #0f172a)",
                boxShadow: "var(--home-shadow-btn-primary)",
                border: "none",
                color: "#fff",
              }}
            >
              {t("premium.hero.findMatchCta")}
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </V0ShadcnButton>

            <p className="mt-2.5 text-center text-[11px] font-medium text-slate-500 md:text-[12px]">
              {t("premium.v2.hero.smartMatchMicrocopy")}
            </p>
          </div>
        </div>

        <div className="mt-4 md:mt-5 flex items-center justify-center gap-1 text-[10.5px] md:text-[11px] font-medium text-slate-500 flex-wrap text-center leading-relaxed">
          <span className="font-bold text-slate-700">100K+ bookings</span>
          <span className="text-slate-300 mx-0.5">·</span>
          <span className="text-slate-500">Klook · GetYourGuide · Viator</span>
          <span className="text-slate-300 mx-0.5">·</span>
          <span className="font-semibold text-emerald-700">Verified operators</span>
        </div>
      </div>
    </section>
  );
}
