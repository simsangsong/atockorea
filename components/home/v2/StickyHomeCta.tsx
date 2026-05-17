"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";

/**
 * Sticky bottom CTA shown after the hero leaves the viewport and hidden once
 * the FinalCTA section reaches the viewport. Two actions, mirroring the page's
 * primary conversion paths:
 *   - "See My Best Matches" → scrolls back to the hero matcher + focuses input
 *   - "Browse all tours"    → /tours/list
 *
 * Renders on every viewport. Layout collapses to a centered max-width bar so
 * it doesn't fight the persistent chat widget that sits in the bottom-right
 * corner on desktop.
 */
export function StickyHomeCta() {
  const t = useTranslations("home");
  const reduceMotion = useReducedMotion();
  const [heroOut, setHeroOut] = useState(false);
  const [footerIn, setFooterIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hero = document.querySelector("[data-home-hero]");
    const footer = document.querySelector("[data-home-final-cta]");

    const heroObs = hero
      ? new IntersectionObserver(
          ([entry]) => {
            // Hero counts as "out" when its bottom edge is above the viewport.
            const rect = entry.boundingClientRect;
            setHeroOut(rect.bottom < 0);
          },
          { threshold: 0 },
        )
      : null;
    heroObs?.observe(hero!);

    const footerObs = footer
      ? new IntersectionObserver(
          ([entry]) => setFooterIn(entry.isIntersecting),
          { threshold: 0.2 },
        )
      : null;
    footerObs?.observe(footer!);

    return () => {
      heroObs?.disconnect();
      footerObs?.disconnect();
    };
  }, []);

  const show = heroOut && !footerIn;

  const focusMatcher = useCallback(() => {
    const hero = document.querySelector<HTMLElement>("[data-home-hero]");
    hero?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    const input = document.querySelector<HTMLTextAreaElement>("[data-home-hero-intent]");
    if (!input) return;
    // Defer focus past the smooth-scroll so iOS doesn't fight the scroll.
    window.setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="sticky-home-cta"
          role="region"
          aria-label="Quick actions"
          initial={reduceMotion ? { opacity: 1 } : { y: 64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-3 left-3 right-3 z-40 mx-auto md:bottom-5 md:max-w-md"
        >
          <div className="flex items-stretch gap-1.5 rounded-full bg-slate-900/95 p-1.5 shadow-2 ring-1 ring-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                analytics.homeStickyCtaClick({ action: "focus_matcher" });
                focusMatcher();
              }}
              className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-3 text-[13px] font-semibold text-slate-900 transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              {t("premium.hero.findMatchCta")}
            </button>
            <Link
              href="/tours/list"
              onClick={() => analytics.homeStickyCtaClick({ action: "browse_tours" })}
              className="focus-ring inline-flex items-center justify-center gap-1 rounded-full px-3.5 py-3 text-[12.5px] font-medium text-white/90 transition-colors hover:text-white"
            >
              {t("premium.v2.featuredProducts.viewAllCtaGeneric")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
