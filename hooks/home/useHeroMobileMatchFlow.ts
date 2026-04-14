"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "@/src/design/analytics";
import {
  clearHomepageMatchTimeouts,
  startHomepageMatchSimulation,
} from "@/lib/home/services/hero-match-schedule";
import type { HeroMatchPhase } from "@/lib/home/types/hero-planner";

/**
 * Mobile-only simulated “match” sequence: loading steps then `result`.
 * Timings and analytics match legacy `HeroPremium` (`analytics.heroFormStart` on CTA).
 */
export function useHeroMobileMatchFlow() {
  const [matchPhase, setMatchPhase] = useState<HeroMatchPhase>("planner");
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2>(0);
  const matchTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => clearHomepageMatchTimeouts(matchTimeoutsRef);
  }, []);

  const handleMobileMatchCta = useCallback(() => {
    analytics.heroFormStart();
    setMatchPhase("loading");
    setLoadingStep(0);
    startHomepageMatchSimulation(matchTimeoutsRef, {
      onLoadingStep: setLoadingStep,
      onResult: () => setMatchPhase("result"),
    });
  }, []);

  return {
    matchPhase,
    setMatchPhase,
    loadingStep,
    handleMobileMatchCta,
  };
}
