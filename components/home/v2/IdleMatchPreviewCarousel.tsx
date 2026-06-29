"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useI18n, useTranslations } from "@/lib/i18n";
import {
  hrefStaticTourProductDetail,
  listStaticTourProducts,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { analytics } from "@/src/design/analytics";
import { cn } from "@/lib/utils";
import {
  getCardImageFromAdminMedia,
  useTourProductCardMedia,
} from "@/hooks/useTourProductCardMedia";

// Hard-coded for destination/style variety so the idle preview gives a
// deterministic "variability signal" (v3 §3 P0-B). Real catalog data — no
// fake recommendation cards (v3 §B 2026-05-17 binding decision).
const IDLE_PREVIEW_SLUGS = [
  "busan-top-attractions-day-tour",
  "jeju-grand-highlights-loop",
  // Klook onboarding prep 2026-06-29: was southwest-hallasan-osulloc-aewol
  // (now deactivated + consumer-blocked). Swapped for an active SKU.
  "pocheon-sanjeong-lake-herb-island-art-valley",
] as const;

const FADE_INTERVAL_MS = 5000;
const FADE_DURATION_MS = 600;

/**
 * Idle-phase replacement for the null return in DeferredBestMatchPreview.
 * Renders 2-3 catalog cards cycling on a 5s fade so the user sees what
 * "matched tour cards" actually look like before they type anything. Each
 * card links to its real detail page and reports analytics with
 * `source: "idle_preview"` so Phase B.2 carousel clicks are isolated from
 * the regular Featured rail.
 *
 * Reduced motion: cycling pauses, first card visible, dots usable.
 */
export function IdleMatchPreviewCarousel() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();

  const cards = useMemo(() => {
    const list = listStaticTourProducts(locale);
    return IDLE_PREVIEW_SLUGS
      .map((slug) => list.find((p) => p.slug === slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [locale]);
  const cardMediaBySlug = useTourProductCardMedia(IDLE_PREVIEW_SLUGS, locale);

  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const firedVisibleRef = useRef(false);

  useEffect(() => {
    if (reduceMotion || cards.length < 2) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % cards.length);
    }, FADE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, cards.length]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedVisibleRef.current) {
          firedVisibleRef.current = true;
          analytics.homeMatchPreviewVisible({ phase: "idle" });
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onKeyDownTabs = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (cards.length < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % cards.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + cards.length) % cards.length);
    }
  };

  if (cards.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      data-home-match-preview-idle
      aria-label={t("premium.v2.idlePreview.label")}
      className="px-4 py-8 md:py-10"
    >
      {/* Crossfade transition lives in CSS (not inline style) so the
          reduced-motion branch resolves at the CSS layer. Driving it from
          framer-motion's `useReducedMotion()` inside the render produced a
          server/client hydration mismatch on the inline `transition` (server
          rendered the animated value, the reduce-motion client rendered
          "none"). The JS `reduceMotion` still gates the auto-cycle interval. */}
      <style>{`
        .idle-preview-crossfade {
          transition: opacity ${FADE_DURATION_MS}ms ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .idle-preview-crossfade { transition: none; }
        }
      `}</style>
      <div className="mx-auto max-w-md md:max-w-xl">
        <p className="mb-3 text-center text-eyebrow md:mb-4">
          {t("premium.v2.idlePreview.label")}
        </p>

        <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-2">
          {cards.map((card, idx) => {
            const visible = idx === activeIndex;
            return (
              <Link
                key={card.slug}
                href={hrefStaticTourProductDetail(card.slug)}
                aria-label={t("premium.v2.idlePreview.cardAria", { title: card.title })}
                aria-hidden={!visible}
                tabIndex={visible ? 0 : -1}
                onClick={() =>
                  analytics.homeFeaturedCardClick({
                    source: "idle_preview",
                    slug: card.slug,
                  })
                }
                className="focus-ring idle-preview-crossfade absolute inset-0 block"
                style={{
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? "auto" : "none",
                }}
              >
                <Image
                  src={getCardImageFromAdminMedia(card.slug, card.thumbnail || card.heroImage, cardMediaBySlug)}
                  alt={card.title}
                  fill
                  sizes="(max-width: 768px) 90vw, 576px"
                  loading="lazy"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <span className="text-micro font-semibold uppercase tracking-[0.18em] text-white/80">
                    {card.region}
                  </span>
                  <h3
                    className="mt-1 text-[1.125rem] font-semibold leading-tight text-white md:text-[1.25rem]"
                    style={{ textShadow: "0 3px 24px rgba(0,0,0,0.5)" }}
                  >
                    {card.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {card.badges.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm md:text-[11px]"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div
          className="mt-3 flex justify-center gap-1.5"
          role="tablist"
          aria-label={t("premium.v2.idlePreview.navLabel")}
          onKeyDown={onKeyDownTabs}
        >
          {cards.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`${idx + 1}/${cards.length}`}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "focus-ring h-1.5 rounded-full transition-all",
                idx === activeIndex ? "w-6 bg-slate-900" : "w-1.5 bg-slate-300 hover:bg-slate-400",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
