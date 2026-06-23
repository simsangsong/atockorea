"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ShieldCheck, Lock, CalendarClock, RotateCcw } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

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

export function HeroSection() {
  const t = useTranslations("home");

  // What makes AtoC more than a booking agency — the four assurances shown
  // under the hero (dual registration, secure global pay, pay-on-tour-day,
  // 100% refund window).
  const assurances = [
    { Icon: ShieldCheck, label: t("premium.hero.assureCert") },
    { Icon: Lock, label: t("premium.hero.assurePay") },
    { Icon: CalendarClock, label: t("premium.hero.assureBookNow") },
    { Icon: RotateCcw, label: t("premium.hero.assureRefund") },
  ];

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
          {/* Photo-visibility pass round 2 (§B 2026-05-24 (3)): the dark
              radial scrim behind the headline is dramatically lightened
              (~60% opacity reduction across all stops) so the hero photo
              reads through the text panel, and the text-shadow stack is
              strengthened (blur 12→16, alpha 0.5→0.6) to keep white
              copy legible against any photo. */}
          <div className="relative inline-block max-w-full px-4 py-1.5 md:px-6 md:py-2">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-4 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.25)_35%,rgba(0,0,0,0.12)_60%,rgba(0,0,0,0.04)_80%,transparent_95%)] md:-inset-x-14 md:-inset-y-6"
            />
            <h1
              className="text-[1.1rem] font-medium leading-[1.18] tracking-[-0.025em] text-white md:text-[1.4rem] lg:text-[1.7rem]"
              style={{
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                textShadow: "0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.55)",
              }}
            >
              {t("premium.hero.headlineLine1")}
            </h1>

            <p
              className="mx-auto mt-1.5 max-w-md text-[0.78rem] font-normal leading-snug tracking-[-0.01em] text-white/90 md:mt-2 md:text-caption"
              style={{
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                textShadow: "0 1px 12px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.55)",
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
        {/* Trust assurances — what makes AtoC more than a booking agency:
            dual US/Korea registration, secure global payment, pay-on-tour-day,
            and a 100% refund window. Replaces the prior curation stat row. */}
        <div className="mx-auto max-w-2xl px-1 pt-3 pb-4 md:pt-5 md:pb-6">
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2.5 md:max-w-3xl md:grid-cols-4 md:gap-3">
            {assurances.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-3 text-center md:py-4"
              >
                <Icon className="h-5 w-5 text-slate-600" strokeWidth={1.75} aria-hidden />
                <span className="text-[0.72rem] font-medium leading-snug text-slate-600 md:text-caption">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* End trust assurances. */}

        {/* Reform W1e-3 — the Match/Build planner card has been removed from
            the hero. The hero is now photo + H1 + curation proof; the primary
            decision is the tour-type section directly below, and the matcher
            lives in the "Get a recommendation" card there. */}
      </div>
    </section>
  );
}
