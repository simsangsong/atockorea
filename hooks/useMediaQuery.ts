"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    // Guarded like the old landing-screen inline reads: some embedded
    // webviews (and jsdom) ship without matchMedia — "no match" is the
    // correct degraded answer, not a crash.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    // Safari < 14 exposes addListener only; fall back so the hook still
    // tracks changes there instead of silently going static.
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [query]);
  return matches;
}
