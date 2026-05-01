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
  const [showRightFade, setShowRightFade] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const subnavScrollSpyKey = subnavItems.map((item) => item.id).join("|");

  useEffect(() => {
    const handleScroll = () => {
      setIsPastHero(window.scrollY > 32);
      const sections = subnavItems.map((item) => document.getElementById(item.id));
      const scrollPosition = window.scrollY + SCROLL_OFFSET_PX;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(subnavItems[i].id);
          break;
        }
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
    /* subnavItems omitted on purpose: stable `subnavScrollSpyKey` avoids re-binding listeners
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
        "tour-subnav-sticky bg-white/98 backdrop-blur-md border-b border-border/80 transition-[box-shadow] duration-200",
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
