"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import { appendIntentPhraseToIntentField } from "@/lib/home/services/hero-intent-append-chip";
import type { HeroDestination } from "@/lib/home/types/hero-planner";
import { LandingPlannerCard } from "./landing-planner-card";

const VALID_DESTINATIONS: ReadonlyArray<HeroDestination> = ["jeju", "seoul", "busan"];
const HERO_SLIDES = [
  {
    src: "/images/home/hero/01-gyeongbokgung-sunset.webp",
    alt: "Gwanghwamun Gate at Gyeongbokgung Palace at sunset with light trails, Seoul",
  },
  {
    src: "/images/home/hero/02-haeundae-blueline-tram.webp",
    alt: "Haeundae Blueline Park sky tram passing cherry blossoms above the East Sea, Busan",
  },
  {
    src: "/images/home/hero/03-cherry-blossom-canola-road.webp",
    alt: "Cherry blossom and canola flower country road in full spring bloom, Jeju",
  },
  {
    src: "/images/home/hero/04-haedong-yonggungsa-sunrise.webp",
    alt: "Haedong Yonggungsa Temple on the sea cliffs at golden sunrise, Busan",
  },
  {
    src: "/images/home/hero/05-seopjikoji-horse.webp",
    alt: "Seopjikoji headland with a grazing horse and Seongsan Ilchulbong in the distance, Jeju",
  },
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

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => appendIntentPhraseToIntentField(prev, phrase));
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
        className="relative flex min-h-[38vh] flex-col justify-end overflow-hidden bg-black pb-1.5 sm:min-h-[40vh] md:min-h-[46vh] md:pb-2.5 lg:min-h-[clamp(420px,48vh,580px)]"
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
                  style={{
                    animationDelay: `${index * 4.5}s`,
                    filter: "saturate(1.08) contrast(1.06) brightness(0.99)",
                  }}
                />
              );
            })}
          </motion.div>
          {/* Editorial film grain (Kodak Portra 400 입자감) — identical SVG
              fractalNoise recipe as TourListCard + CatalogueHero (B2 family),
              so the hero photography reads as the same image identity as the
              card grid below. Pure CSS data-URL, ~1KB, no runtime cost. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              opacity: 0.12,
            }}
          />
          {/* Editorial corner roll-off vignette — transparent 60% → 0.15 alpha.
              Tracks corners only, never dims the subject mid-frame. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)",
            }}
          />
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
          className="relative z-10 mx-auto mb-0 w-full max-w-2xl px-3 text-center sm:px-5 md:mb-0.5 md:px-8"
          style={{ y: headlineY, opacity: headlineOpacity }}
        >
          {/* Photo-visibility pass: season chip removed (§B reversal of Phase
              C.1, 2026-05-24). H1+subhead shrunk ~15% and the inner padding
              tightened so the text panel hugs the bottom edge — frees the
              top ~80px of the photo for the cinematic crop. The radial
              gradient is tightened to track the smaller text. */}
          <div className="relative inline-block max-w-full px-4 py-1.5 md:px-6 md:py-2">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-4 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.72)_35%,rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.18)_80%,transparent_95%)] md:-inset-x-14 md:-inset-y-6"
            />
            <h1
              className="text-[1.1rem] font-medium leading-[1.18] tracking-[-0.025em] text-white md:text-[1.4rem] lg:text-[1.7rem]"
              style={{
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                textShadow: "0 2px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.45)",
              }}
            >
              {t("premium.hero.headlineLine1")}
            </h1>

            <p
              className="mx-auto mt-1.5 max-w-md text-[0.78rem] font-normal leading-snug tracking-[-0.01em] text-white/85 md:mt-2 md:text-caption"
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
        />
      </div>
    </section>
  );
}
