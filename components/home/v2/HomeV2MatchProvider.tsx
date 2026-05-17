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
import { clearHomepageMatchTimeouts } from "@/lib/home/services/hero-match-schedule";
import type { TourMatchApiResponse } from "@/lib/tour-match-v2/api-types";

export type HomeV2MatchPhase = "idle" | "loading" | "result";

export type HomeV2MatchContextValue = {
  phase: HomeV2MatchPhase;
  loadingStep: 0 | 1 | 2;
  /** Card hero image — matched tour or homepage default */
  joinImageUrl: string;
  matchResult: TourMatchApiResponse | null;
  matchError: string | null;
  startInPageMatchFlow: (
    text: string,
    locale: string,
    pinnedDestination?: string | null,
  ) => Promise<TourMatchApiResponse | null>;
  resetMatchToIdle: () => void;
};

const HomeV2MatchContext = createContext<HomeV2MatchContextValue | null>(null);

export function HomeV2MatchProvider({ children }: { children: ReactNode }) {
  const baseJoinImageUrl = useHomepageJoinCardImage(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);
  const [phase, setPhase] = useState<HomeV2MatchPhase>("idle");
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2>(0);
  const [matchResult, setMatchResult] = useState<TourMatchApiResponse | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchedJoinImageUrl, setMatchedJoinImageUrl] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => clearHomepageMatchTimeouts(timeoutsRef), []);

  useEffect(() => {
    const slug = matchResult?.winner?.product_id;
    if (!slug) {
      setMatchedJoinImageUrl(null);
      return;
    }

    let cancelled = false;
    import("@/components/product-tour-static/catalog/staticTourCatalogCards")
      .then(({ getStaticTourProductBySlug }) => {
        if (cancelled) return;
        setMatchedJoinImageUrl(getStaticTourProductBySlug(slug)?.heroImage ?? null);
      })
      .catch(() => {
        if (!cancelled) setMatchedJoinImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [matchResult?.winner?.product_id]);

  const joinImageUrl = useMemo(
    () => matchedJoinImageUrl ?? baseJoinImageUrl,
    [matchedJoinImageUrl, baseJoinImageUrl],
  );

  const resetMatchToIdle = useCallback(() => {
    clearHomepageMatchTimeouts(timeoutsRef);
    setPhase("idle");
    setLoadingStep(0);
    setMatchResult(null);
    setMatchError(null);
    setMatchedJoinImageUrl(null);
  }, []);

  const startInPageMatchFlow = useCallback(async (
    text: string,
    locale: string,
    pinnedDestination?: string | null,
  ) => {
    analytics.homeCtaClick({ source: "hero_planner_match" });
    setMatchError(null);
    setMatchResult(null);
    setMatchedJoinImageUrl(null);
    setPhase("loading");
    setLoadingStep(0);

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    const push = (delay: number, fn: () => void) => {
      const id = setTimeout(fn, delay);
      stepTimers.push(id);
      timeoutsRef.current.push(id);
    };
    push(450, () => setLoadingStep(1));
    push(900, () => setLoadingStep(2));

    try {
      const res = await fetch("/api/tour-product/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          locale,
          ...(pinnedDestination ? { pinned_destination: pinnedDestination } : {}),
        }),
      });
      const data = (await res.json()) as TourMatchApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Match request failed");
      }
      clearHomepageMatchTimeouts(timeoutsRef);
      stepTimers.forEach(clearTimeout);
      setMatchResult(data);
      setPhase("result");
      setLoadingStep(2);
      return data;
    } catch (e) {
      clearHomepageMatchTimeouts(timeoutsRef);
      stepTimers.forEach(clearTimeout);
      const msg = e instanceof Error ? e.message : "Match failed";
      setMatchError(msg);
      setPhase("idle");
      setLoadingStep(0);
      return null;
    }
  }, []);

  const value = useMemo(
    (): HomeV2MatchContextValue => ({
      phase,
      loadingStep,
      joinImageUrl,
      matchResult,
      matchError,
      startInPageMatchFlow,
      resetMatchToIdle,
    }),
    [phase, loadingStep, joinImageUrl, matchResult, matchError, startInPageMatchFlow, resetMatchToIdle],
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
