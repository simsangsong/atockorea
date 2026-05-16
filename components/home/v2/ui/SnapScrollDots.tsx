"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SnapScrollDotsProps = {
  containerRef: RefObject<HTMLElement | null>;
  count: number;
  className?: string;
};

/**
 * Mobile-only scroll-progress dots for snap-scroll carousels.
 * Reads scrollLeft directly via rAF-throttled scroll listener — no
 * per-card IntersectionObserver needed since the scroll is one-axis
 * and snap-mandatory keeps the active card aligned to the left edge.
 *
 * Hidden on md+ where the layout switches to a static grid.
 */
export function SnapScrollDots({ containerRef, count, className }: SnapScrollDotsProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || count <= 1) return;

    let raf = 0;
    const handle = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll <= 0) {
          setIndex(0);
          return;
        }
        const progress = scrollLeft / maxScroll;
        const next = Math.round(progress * (count - 1));
        setIndex(Math.max(0, Math.min(count - 1, next)));
      });
    };

    el.addEventListener("scroll", handle, { passive: true });
    handle();
    return () => {
      el.removeEventListener("scroll", handle);
      cancelAnimationFrame(raf);
    };
  }, [containerRef, count]);

  if (count <= 1) return null;

  return (
    <div
      role="presentation"
      aria-hidden
      className={cn(
        "flex items-center justify-center gap-1.5 pt-3 md:hidden",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-200 ease-out",
            i === index ? "w-4 bg-slate-700" : "w-1 bg-slate-300",
          )}
        />
      ))}
    </div>
  );
}
