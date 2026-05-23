"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { getCurrentSeason } from "@/lib/home/season";
import { useTranslations } from "@/lib/i18n";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { analytics } from "@/src/design/analytics";
import { LandingPlannerCard } from "./landing-planner-card";

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
  const searchParams = useSearchParams();

  const initialDestination = useMemo(
    () => readDestinationFromParams(searchParams?.get("destination") ?? null) ?? "jeju",
    [searchParams],
  );
  const [destination, setDestination] = useState<HeroDestination>(initialDestination);
  const [intent, setIntent] = useState("");

  const heroSectionRef = useRef<HTMLElement>(null);
  const heroPanelRef = useRef<HTMLDivElement>(null);

  // Secondary hero slides (#1, #2) defer-mount after first paint. The
  // crossfade keyframes only reveal slide #1 at t≈5.4s and slide #2 at
  // t≈9.9s (animationDelay × cycle), so a sub-second mount delay is
  // visually invisible — but it frees ~1MB of image bandwidth from the
  // critical path. `next/image` with the slides absolutely stacked in the
  // viewport ignores `loading="lazy"` (they're "above the fold"), so the
  // only way to keep them out of the first-paint waterfall is to not
  // render them at all initially.
  const [secondarySlidesReady, setSecondarySlidesReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSecondarySlidesReady(true), 800);
    return () => window.clearTimeout(id);
  }, []);

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

  // Season pill — auto-rotates by current month. Initialized lazily so the
  // server-rendered HTML matches whatever month the request lands in.
  const season = useMemo(() => getCurrentSeason(), []);
  const SeasonIcon = season.Icon;
  const seasonLabel = t(season.labelKey);
  const seasonPhrase = t(season.phraseKey);

  // Phase C.1: 200ms glow ring on intent textarea after a season-chip click,
  // so the user gets a visual confirmation that the phrase landed in the
  // input. Auto-clears via setTimeout.
  const [intentGlowing, setIntentGlowing] = useState(false);
  const intentGlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
  }, []);

  const handleSeasonChipClick = useCallback(() => {
    appendChip(seasonPhrase);
    analytics.homeHeroSeasonChipClick({ season: season.key });
    setIntentGlowing(true);
    if (intentGlowTimerRef.current) clearTimeout(intentGlowTimerRef.current);
    intentGlowTimerRef.current = setTimeout(() => setIntentGlowing(false), 200);
  }, [appendChip, seasonPhrase, season.key]);

  useEffect(() => {
    return () => {
      if (intentGlowTimerRef.current) clearTimeout(intentGlowTimerRef.current);
    };
  }, []);

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
      {/* Keep the landscape cinematic without letting tall desktop viewports
          turn the homepage into a single oversized hero image. */}
      <div
        ref={heroPanelRef}
        className="relative flex min-h-[38vh] flex-col justify-end overflow-hidden bg-black pb-3 sm:min-h-[40vh] md:min-h-[46vh] md:pb-5 lg:min-h-[clamp(420px,48vh,580px)]"
      >
        <div className="absolute inset-0">
          {/* Photo crossfade — slides up under parallax as the user scrolls,
              creating depth between photo and headline. Ken Burns CSS
              animation still plays on the inner images. */}
          <motion.div className="absolute inset-0 overflow-hidden" aria-hidden style={{ y: photoY }}>
            {HERO_SLIDES.map((slide, index) => {
              if (index > 0 && !secondarySlidesReady) return null;
              return (
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
              );
            })}
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
            {/* Phase C.1: season pill upgraded from <div> to <button>. Click
                injects a short phrase ({phraseKey} translation) into the
                matcher intent textarea + triggers a 200ms glow ring as
                visual confirmation. Weak hover affordance (no "buttoney"
                rest state) to keep the cinematic feel — v3 §5 C.1 spec. */}
            <button
              type="button"
              onClick={handleSeasonChipClick}
              aria-label={t("premium.v2.season.chipAria", { phrase: seasonPhrase })}
              className="focus-ring mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/25 backdrop-blur-md transition-colors duration-200 hover:bg-white/20 hover:ring-white/40 md:mb-3"
            >
              <SeasonIcon className="h-3 w-3 text-amber-200" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/95">
                {seasonLabel}
              </span>
            </button>
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
        {/* Curation proof: the compact stat row reinforces direct vetting
            without changing the fold height or premium visual rhythm. */}
        <div className="mx-auto max-w-xl px-1 pt-3 pb-4 md:pt-5 md:pb-6">
          <h2
            className="text-center text-[0.98rem] font-bold leading-snug tracking-[-0.015em] text-slate-900 md:text-[1.2rem]"
            style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
          >
            {t("premium.hero.curationHeadline")}
          </h2>

          {/* Concise labels keep all three trust signals readable in 3 columns. */}
          <div className="mx-auto mt-3 grid max-w-md grid-cols-3 divide-x divide-slate-200/70 text-center md:mt-4">
            <div className="px-2.5">
              <span className="block text-h3 font-extrabold leading-none text-slate-900 md:text-[1.5rem]">
                {t("premium.hero.curationShortlistValue")}
              </span>
              <span className="mt-1.5 block text-caption font-medium leading-tight text-slate-500">
                {t("premium.hero.curationShortlistLabel")}
              </span>
            </div>

            <div className="px-2.5">
              <span className="block text-h3 font-extrabold leading-none text-slate-900 md:text-[1.5rem]">
                {t("premium.hero.curationBookingsValue")}
              </span>
              <span className="mt-1.5 block text-caption font-medium leading-tight text-slate-500">
                {t("premium.hero.curationBookingsLabel")}
              </span>
            </div>

            <div className="px-2.5">
              <span className="block text-h3 font-extrabold leading-none text-slate-900 md:text-[1.5rem]">
                {t("premium.hero.curationRatingValue")}
              </span>
              <span className="mt-1.5 block text-caption font-medium leading-tight text-slate-500">
                {t("premium.hero.curationRatingLabel")}
              </span>
            </div>
          </div>

          <p className="mx-auto mt-3 hidden max-w-md text-center text-caption leading-relaxed text-slate-500 md:mt-4 md:block">
            {t("premium.hero.curationProof")}
          </p>
        </div>
        {/* End curation proof. */}

        {/* Unified planner header (responsive — Gate 0.2). Mobile keeps the
            eyebrow-only slim header (B.3 fold recovery: the matcher CTA
            already sits below the effective fold, so no extra height here).
            Desktop has vertical room, so it adds the planner headline +
            subhead that frame the Match / Build modes. */}
        <div className="mx-auto mb-3 max-w-lg px-1 text-center md:mb-4">
          <span className="text-eyebrow">
            {t("premium.v2.hero.matcherEyebrow")}
          </span>
          <h2 className="mt-1.5 hidden text-h3 font-bold tracking-tight text-slate-900 md:block">
            {t("premium.v2.planner.headline")}
          </h2>
          <p className="mt-1 hidden text-caption text-slate-500 md:block">
            {t("premium.v2.planner.subhead")}
          </p>
        </div>

        <LandingPlannerCard
          destination={destination}
          onDestinationChange={setDestination}
          intent={intent}
          onIntentChange={setIntent}
          onAppendChip={appendChip}
          intentGlowing={intentGlowing}
        />
      </div>
    </section>
  );
}
