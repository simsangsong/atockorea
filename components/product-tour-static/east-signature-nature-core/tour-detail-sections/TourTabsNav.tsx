"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import { SCROLL_OFFSET_PX, observeSpyTarget } from "@/components/product-tour-static/_shared/sectionScrollSpy";

export type TourTabsNavProps = Pick<EastSignatureNatureCoreDetailViewModel, "subnavItems">;

export function TourTabsNav({ subnavItems }: TourTabsNavProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [isPastHero, setIsPastHero] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const subnavScrollSpyKey = subnavItems.map((item) => item.id).join("|");

  /**
   * isPastHero — single boolean transition (false→true or true→false). The previous
   * implementation called setState on every scroll event (60+/sec). rAF-throttle
   * collapses the burst, and the value-comparison guard suppresses redundant
   * setState — only one render per actual transition.
   */
  useEffect(() => {
    let frameQueued = false;
    let lastValue = false;

    const onScroll = () => {
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > 32;
        if (next !== lastValue) {
          lastValue = next;
          setIsPastHero(next);
        }
        frameQueued = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * activeSection — replaced the per-scroll `getElementById` + `offsetTop` loop
   * (which forced layout on every scroll event for every sub-section) with an
   * IntersectionObserver. Native, runs off the main thread, and only fires on
   * actual visibility transitions. The rootMargin shrinks the active "band" to
   * a thin slice just under the sticky nav so exactly one section wins at a time.
   */
  useEffect(() => {
    const sectionEls = subnavItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sectionEls.length === 0) return;

    // W2.3 — subscriptions go through the page-wide shared observer
    // (sectionScrollSpy) so the DayFlow scrubber can spy stops without a
    // second IntersectionObserver instance.
    const unsubs = sectionEls.map((el) => observeSpyTarget(el, (t) => setActiveSection(t.id)));
    return () => unsubs.forEach((u) => u());
    /* subnavItems omitted on purpose: stable `subnavScrollSpyKey` avoids re-binding the observer
       when the parent passes a new array reference each render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subnavScrollSpyKey]);

  const updateRightFade = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setShowRightFade(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateRightFade();
    const el = scrollerRef.current;
    el?.addEventListener("scroll", updateRightFade, { passive: true });
    window.addEventListener("resize", updateRightFade);
    return () => {
      el?.removeEventListener("scroll", updateRightFade);
      window.removeEventListener("resize", updateRightFade);
    };
  }, [updateRightFade, subnavScrollSpyKey]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - SCROLL_OFFSET_PX, behavior: "smooth" });
    }
  };

  return (
    <nav
      /** `.tour-subnav-sticky` (tour-product-v2-scope.css) hard-sets `position: sticky; top: 3rem; md: 3.5rem; z-index: 40;`
       * to match Header (`components/Header.tsx`) `h-12 md:h-14`. Do not rely on Tailwind `sticky top-12` here. */
      className={cn(
        // Drop backdrop-blur on this sticky bar: the global Header is already
        // sticky + blurred above it, and stacking two backdrop-filters on a
        // mobile scroll path is a known iOS Safari / Android jank source
        // (every frame must re-rasterize the blurred region). The bg was
        // bg-white/98 (98% opaque) so the blur was barely visible anyway.
        "tour-subnav-sticky bg-white border-b border-border/80 transition-[box-shadow] duration-200",
        isPastHero ? "shadow-md" : "shadow-none",
      )}
    >
      <div className="relative mx-auto max-w-xl px-5">
        <div ref={scrollerRef} className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2.5">
          {subnavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                activeSection === item.id
                  ? "bg-foreground text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* Right-edge fade — hints there are more tabs to scroll to */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white via-white/85 to-transparent transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </nav>
  );
}
