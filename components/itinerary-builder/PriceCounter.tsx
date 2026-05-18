"use client";

import { useEffect, useState } from "react";

/**
 * V2 redesign Phase 11 — animated KRW price counter for the
 * /thanks auto-quoted hero. Tween 0 → value over 600ms with easeOut
 * via requestAnimationFrame. Honors `prefers-reduced-motion: reduce`:
 * shows final value immediately, no animation.
 */
export default function PriceCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const duration = 600;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>₩{display.toLocaleString()}</>;
}
