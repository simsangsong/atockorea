"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourTabsNavProps = Pick<EastSignatureNatureCoreDetailViewModel, "subnavItems">;

/** Approx. header + this nav bar height for scroll-spy and scroll-to-section */
const SCROLL_OFFSET_PX = 108;

export function TourTabsNav({ subnavItems }: TourTabsNavProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [isPastHero, setIsPastHero] = useState(false);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const subnavScrollSpyKey = subnavItems.map((item) => item.id).join("|");

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
   * Sprint 3.8: top-most entry wins. Previously the IO callback set
   * activeSection from the *last* intersecting entry in the batch, which
   * could oscillate when two sections crossed the threshold in the same
   * frame. Now we collect all currently-intersecting targets and choose the
   * one whose `boundingClientRect.top` is closest to (and ≤) the threshold
   * line — i.e. the top-most section under the sticky nav.
   */
  useEffect(() => {
    const sectionEls = subnavItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sectionEls.length === 0) return;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size === 0) return;
        let topId = "";
        let topY = Infinity;
        for (const [id, y] of visible) {
          if (y < topY) {
            topY = y;
            topId = id;
          }
        }
        if (topId) setActiveSection(topId);
      },
      {
        rootMargin: `-${SCROLL_OFFSET_PX}px 0px -75% 0px`,
        threshold: 0,
      },
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    /* subnavItems omitted on purpose: stable `subnavScrollSpyKey` avoids re-binding the observer */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subnavScrollSpyKey]);

  const updateFades = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollerRef.current;
    el?.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    return () => {
      el?.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [updateFades, subnavScrollSpyKey]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - SCROLL_OFFSET_PX, behavior: "smooth" });
    }
  };

  return (
    <nav
      /** `.tour-subnav-sticky` (tour-product-v2-scope.css) hard-sets `position: sticky; top: 3rem; md: 3.5rem; z-index: 40;` */
      className={cn(
        "tour-subnav-sticky bg-white border-b border-border/80 transition-[box-shadow] duration-200",
        isPastHero ? "shadow-md" : "shadow-none",
      )}
    >
      <div className="relative mx-auto max-w-xl px-5">
        {/* Sprint 3.8/3.9: pill → underline 2px brand (§8.15 Apple TabBar pattern) */}
        <div ref={scrollerRef} className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide">
          {subnavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex-shrink-0 border-b-2 px-3 pt-2.5 pb-2 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "border-[var(--primary)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {/* Sprint 3.9: 양쪽 fade — 좌측 신규 추가 */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white via-white/85 to-transparent transition-opacity duration-200",
            showLeftFade ? "opacity-100" : "opacity-0",
          )}
        />
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
