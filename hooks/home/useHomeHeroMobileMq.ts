"use client";

import { useEffect, useState } from "react";
import { HOME_HERO_MOBILE_MQ } from "@/lib/home/constants";

/** Same breakpoint as legacy `HeroPremium` mobile match flow (`max-width: 639px`). */
export function useHomeHeroMobileMq(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(HOME_HERO_MOBILE_MQ);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return matches;
}
