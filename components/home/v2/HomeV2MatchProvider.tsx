"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { analytics } from "@/src/design/analytics";
import { useHomepageJoinCardImage } from "@/hooks/home/useHomepageJoinCardImage";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";
import {
  clearHomepageMatchTimeouts,
  startHomepageMatchSimulation,
} from "@/lib/home/services/hero-match-schedule";

export type HomeV2MatchPhase = "idle" | "loading" | "result";

export type HomeV2MatchContextValue = {
  phase: HomeV2MatchPhase;
  loadingStep: 0 | 1 | 2;
  joinImageUrl: string;
  /** Mobile in-page flow: same analytics + staggered steps as legacy `useHeroMobileMatchFlow`. */
  startInPageMatchFlow: () => void;
  resetMatchToIdle: () => void;
};

const HomeV2MatchContext = createContext<HomeV2MatchContextValue | null>(null);

export function HomeV2MatchProvider({ children }: { children: ReactNode }) {
  const joinImageUrl = useHomepageJoinCardImage(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);
  const [phase, setPhase] = useState<HomeV2MatchPhase>("idle");
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2>(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => clearHomepageMatchTimeouts(timeoutsRef), []);

  const resetMatchToIdle = useCallback(() => {
    clearHomepageMatchTimeouts(timeoutsRef);
    setPhase("idle");
    setLoadingStep(0);
  }, []);

  const startInPageMatchFlow = useCallback(() => {
    analytics.heroFormStart();
    setPhase("loading");
    setLoadingStep(0);
    startHomepageMatchSimulation(timeoutsRef, {
      onLoadingStep: setLoadingStep,
      onResult: () => setPhase("result"),
    });
  }, []);

  const value = useMemo(
    (): HomeV2MatchContextValue => ({
      phase,
      loadingStep,
      joinImageUrl,
      startInPageMatchFlow,
      resetMatchToIdle,
    }),
    [phase, loadingStep, joinImageUrl, startInPageMatchFlow, resetMatchToIdle],
  );

  return <HomeV2MatchContext.Provider value={value}>{children}</HomeV2MatchContext.Provider>;
}

export function useHomeV2Match(): HomeV2MatchContextValue {
  const ctx = useContext(HomeV2MatchContext);
  if (!ctx) {
    throw new Error("useHomeV2Match must be used within HomeV2MatchProvider");
  }
  return ctx;
}
