"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ChevronRight } from "lucide-react";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
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
  const heroPanelRef = useRef<HTMLDivElement>(null);

  // Scroll-linked parallax: as the user scrolls past the hero, the photo
  // slides up faster than the text, and a black overlay dims the photo —
  // gives the hero a cinematic "fade to dark" handoff instead of just
  // disappearing off the top of the viewport.
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroPanelRef,
    offset: ["start start", "end start"],
  });
  const photoY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? ["0%", "0%"] : ["0%", "-12%"],
  );
  const darkenOpacity = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 0.42],
  );
  const headlineY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 24],
  );
  const headlineOpacity = useTransform(
    scrollYProgress,
    [0, 0.6, 1],
    reduceMotion ? [1, 1, 1] : [1, 0.92, 0.7],
  );

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
      {/* Hero height: bumped to give Korea's landscape genuine on-page
          presence. Apple landing pages routinely use 70-90vh hero photos.
          Mobile capped at 48vh so the inline-stats + matcher headline
          still peek above the fold on iPhone-class viewports. */}
      <div
        ref={heroPanelRef}
        className="relative min-h-[44vh] sm:min-h-[48vh] md:min-h-[64vh] lg:min-h-[72vh] flex flex-col justify-end overflow-hidden bg-black pb-3 md:pb-5"
      >
        <div className="absolute inset-0">
          {/* Photo crossfade — slides up under parallax as the user scrolls,
              creating depth between photo and headline. Ken Burns CSS
              animation still plays on the inner images. */}
          <motion.div className="absolute inset-0 overflow-hidden" aria-hidden style={{ y: photoY }}>
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
          </motion.div>
          {/* Darken overlay — fades from 0 → 0.5 over the scroll range, giving
              a cinematic "lights fade" handoff into the trust panel below. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[2] bg-black"
            style={{ opacity: darkenOpacity }}
          />
          {/* The previous full-width scrim is gone; legibility is handled by a
              discrete text panel so the photography stays bright. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-7 bg-gradient-to-t from-[#faf9f7] to-transparent md:h-9"
            aria-hidden
          />
        </div>

        {/* Headline block: a soft radial gradient sits behind the text and
            feathers out past the text edges. Pure CSS keeps the photo layer
            bright without a per-frame backdrop-filter pass. The whole block
            drifts down slightly + fades during scroll-past so it doesn't
            compete with sections below. */}
        <motion.div
          className="relative z-10 mx-auto mb-1 w-full max-w-2xl px-3 pb-0.5 text-center sm:px-5 md:mb-2 md:px-8"
          style={{ y: headlineY, opacity: headlineOpacity }}
        >
          <div className="relative inline-block max-w-full px-5 py-3 md:px-7 md:py-4">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.72)_35%,rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.18)_80%,transparent_95%)] md:-inset-x-16 md:-inset-y-8"
            />
            {/* Hero H1 — Inter at medium weight via Next.js-loaded
                --font-inter. Previously used a system SF Pro stack which
                rendered as SF on Mac/iOS and Segoe/Roboto on Win/Android
                — the brand looked like two different products depending
                on the visitor's OS. Inter is web-loaded so every visitor
                gets the same letterforms. Sizes preserved (user tuned). */}
            <h1
              className="text-[1.35rem] font-medium leading-[1.15] tracking-[-0.025em] text-white md:text-[1.75rem] lg:text-[2.15rem]"
              style={{
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                textShadow: "0 2px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.45)",
              }}
            >
              {t("premium.hero.headlineLine1")}
            </h1>

            <p
              className="mx-auto mt-2 max-w-md text-caption font-normal tracking-[-0.01em] text-white/85 md:mt-3"
              style={{
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                textShadow: "0 1px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {t("premium.hero.atfHeroSubhead")}
            </p>
          </div>
        </motion.div>
      </div>

      <div
        className="relative px-4 md:px-8 pt-0 pb-8 md:pb-10"
        style={{ background: "linear-gradient(to bottom, #faf9f7, #fdfcfb, #ffffff)" }}
      >
        {/* ── Value Bridge ─────────────────────────────────────────── */}
        {/*
          Inline 3-stat row sitting on the page background. Earlier this was
          wrapped in its own white card, which created a stacked-panel
          composition with the matcher card directly below — two equal-weight
          surfaces fighting for the eye. Flattened to a divider-separated row
          so the matcher reads as the single focal card on the hero.
        */}
        <div className="mx-auto max-w-lg pt-6 pb-7 md:pt-7 md:pb-8">
          <div className="grid grid-cols-3 divide-x divide-slate-200/70 text-center">
            <div className="px-2">
              <span className="block text-h3 font-extrabold leading-none text-slate-900">
                4.9<span className="text-[11px] text-amber-400">★</span>
              </span>
              <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-500">avg. rating</span>
            </div>

            <div className="px-2">
              <span className="block text-h3 font-extrabold leading-none text-slate-900">100K+</span>
              <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-500">bookings</span>
            </div>

            <div className="px-2">
              <span className="block text-h3 font-extrabold leading-none text-slate-900">8</span>
              <span className="mt-1.5 block text-micro font-semibold uppercase tracking-wide text-slate-500">platforms</span>
              <span className="mt-1 block text-micro font-medium leading-tight text-slate-400">Klook · GetYourGuide · Viator</span>
            </div>
          </div>
        </div>
        {/* ────────────────────────────────────────────────────────── */}

        {/* Differentiator section header — sits above the planner card so the
            "this is a new way, not on any OTA" message lands before the user
            engages with the form. Outside the card on purpose so the planner
            card itself stays clean and task-focused. */}
        <div className="mx-auto mb-4 max-w-lg px-1 text-center md:mb-5">
          <span className="text-eyebrow">
            {t("premium.v2.hero.matcherEyebrow")}
          </span>
          <h2 className="mt-2 text-balance text-h3 font-bold text-slate-900">
            {t("premium.v2.hero.matcherHeadline")}
          </h2>
          <p className="mt-1.5 text-caption font-medium text-slate-600">
            {t("premium.v2.hero.matcherSubline")}
          </p>
        </div>

        <div className="relative mx-auto max-w-lg">
          <div className="relative home-panel-elevated p-4 md:p-5">
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
                      className={cn(
                        "focus-ring rounded-button border px-2 py-3.5 text-center text-[15px] font-semibold tracking-tight transition-colors duration-200 md:py-4 md:text-base",
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
                    // Matcher form system: rounded-button (14px) + bg-slate-50
                    // + border-slate-200/70 — same shell as the destination
                    // radio above. Placeholder and content both render at the
                    // same scale (text-caption) so users don't feel the input
                    // "downshift" when they start typing.
                    "w-full resize-none rounded-button border border-slate-200/70 bg-slate-50 px-3.5 text-caption text-slate-800 transition-[height,padding,border-color,background-color] duration-300 ease-out placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus-ring md:px-4",
                    intentExpanded
                      ? "h-32 overflow-auto py-3 md:h-40 md:py-4"
                      : "h-12 overflow-hidden py-3.5 md:h-14 md:py-4",
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
                      className={cn(
                        "focus-ring flex-none rounded-full border px-3.5 py-2 text-caption font-medium transition-colors duration-200 md:px-4 md:py-2.5",
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

            <V0ShadcnButton
              type="button"
              size="lg"
              disabled={matchPhase === "loading"}
              aria-busy={matchPhase === "loading"}
              onClick={handleSubmit}
              className={homeBtnPrimary}
              style={{ boxShadow: "var(--home-shadow-btn-primary)", border: "none" }}
            >
              {t("premium.hero.findMatchCta")}
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </V0ShadcnButton>

            <p className="mt-2.5 text-center text-micro font-medium text-slate-500">
              {t("premium.v2.hero.smartMatchMicrocopy")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
