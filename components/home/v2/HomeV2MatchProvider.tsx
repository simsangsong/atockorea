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
import { useTourProductCardMedia } from "@/hooks/useTourProductCardMedia";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";
import { clearHomepageMatchTimeouts } from "@/lib/home/services/hero-match-schedule";
import { useI18n } from "@/lib/i18n";
import type { TourMatchApiResponse } from "@/lib/tour-match-v2/api-types";

export type HomeV2MatchPhase = "idle" | "loading" | "result";

export type HomeV2MatchContextValue = {
  phase: HomeV2MatchPhase;
  loadingStep: 0 | 1 | 2;
  /** Card hero image — matched tour or homepage default */
  joinImageUrl: string;
  matchResult: TourMatchApiResponse | null;
  matchError: string | null;
  /** The destination pinned for the current match (jeju/seoul/busan), or null.
   *  Phase 5 bridge reads this so the result surfaces know which destination to
   *  offer "Build your own day in {destination}" for. */
  matchedDestination: string | null;
  startInPageMatchFlow: (
    text: string,
    locale: string,
    pinnedDestination?: string | null,
  ) => Promise<TourMatchApiResponse | null>;
  resetMatchToIdle: () => void;
};

const HomeV2MatchContext = createContext<HomeV2MatchContextValue | null>(null);

export function HomeV2MatchProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const baseJoinImageUrl = useHomepageJoinCardImage(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);
  const [phase, setPhase] = useState<HomeV2MatchPhase>("idle");
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2>(0);
  const [matchResult, setMatchResult] = useState<TourMatchApiResponse | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchedJoinImageUrl, setMatchedJoinImageUrl] = useState<string | null>(null);
  const [matchedDestination, setMatchedDestination] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => clearHomepageMatchTimeouts(timeoutsRef), []);
  const winnerSlug = matchResult?.winner?.product_id ?? null;
  const winnerMediaSlugs = useMemo(() => (winnerSlug ? [winnerSlug] : []), [winnerSlug]);
  const winnerMediaBySlug = useTourProductCardMedia(winnerMediaSlugs, locale);

  useEffect(() => {
    const slug = winnerSlug;
    if (!slug) {
      setMatchedJoinImageUrl(null);
      return;
    }

    let cancelled = false;
    import("@/components/product-tour-static/catalog/staticTourCatalogCards")
      .then(({ getStaticTourProductBySlug }) => {
        if (cancelled) return;
        setMatchedJoinImageUrl(getStaticTourProductBySlug(slug, locale)?.heroImage ?? null);
      })
      .catch(() => {
        if (!cancelled) setMatchedJoinImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [winnerSlug, locale]);

  const matchedAdminImageUrl = winnerSlug
    ? winnerMediaBySlug[winnerSlug]?.heroImageUrl || winnerMediaBySlug[winnerSlug]?.cardImageUrl || null
    : null;

  const joinImageUrl = useMemo(
    () => matchedAdminImageUrl ?? matchedJoinImageUrl ?? baseJoinImageUrl,
    [matchedAdminImageUrl, matchedJoinImageUrl, baseJoinImageUrl],
  );

  /** Race guard (audit 2026-07-14 B3) — each match run takes a fresh id; any
   *  response or explanation merge from a superseded run is dropped, so a
   *  slow earlier request can never overwrite a newer result (or attach its
   *  explanation to a different match after a reset). */
  const matchRunIdRef = useRef(0);

  const resetMatchToIdle = useCallback(() => {
    matchRunIdRef.current += 1;
    clearHomepageMatchTimeouts(timeoutsRef);
    setPhase("idle");
    setLoadingStep(0);
    setMatchResult(null);
    setMatchError(null);
    setMatchedJoinImageUrl(null);
    setMatchedDestination(null);
  }, []);

  const startInPageMatchFlow = useCallback(async (
    text: string,
    locale: string,
    pinnedDestination?: string | null,
  ) => {
    analytics.homeCtaClick({ source: "hero_planner_match" });
    const runId = ++matchRunIdRef.current;
    setMatchError(null);
    setMatchResult(null);
    setMatchedJoinImageUrl(null);
    setMatchedDestination(pinnedDestination ?? null);
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
      const data = (await res.json()) as TourMatchApiResponse & {
        error?: string;
        parsed_query?: unknown;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Match request failed");
      }
      if (runId !== matchRunIdRef.current) return null; // superseded run
      clearHomepageMatchTimeouts(timeoutsRef);
      stepTimers.forEach(clearTimeout);
      setMatchResult(data);
      setPhase("result");
      setLoadingStep(2);

      // Background — fetch the rich Haiku explanation off the critical path.
      // Winner card paints immediately with the parser-notes fallback; when
      // the explanation arrives we merge it into matchResult and the view-
      // model recomputes its matchSummary. Fire-and-forget — failure is silent
      // (matchSummary just stays as the fallback string).
      const winnerSlug = data?.winner?.product_id ?? null;
      if (winnerSlug && data?.parsed_query) {
        void fetch("/api/tour-product/match-explanation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            locale,
            parsed_query: data.parsed_query,
            winner_slug: winnerSlug,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { explanation?: string | null } | null) => {
            const explanation = j?.explanation?.trim();
            if (!explanation) return;
            if (runId !== matchRunIdRef.current) return; // superseded run
            setMatchResult((prev) =>
              prev ? { ...prev, matchExplanation: explanation } : prev,
            );
          })
          .catch(() => {
            // silent — UI keeps the fallback summary
          });
      }
      return data;
    } catch (e) {
      stepTimers.forEach(clearTimeout);
      if (runId !== matchRunIdRef.current) return null; // superseded run
      clearHomepageMatchTimeouts(timeoutsRef);
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
      matchedDestination,
      startInPageMatchFlow,
      resetMatchToIdle,
    }),
    [phase, loadingStep, joinImageUrl, matchResult, matchError, matchedDestination, startInPageMatchFlow, resetMatchToIdle],
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
