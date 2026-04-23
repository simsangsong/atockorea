"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { HomeReviewSummaryResponse } from "@/lib/home/home-review-summary-types";

type Ctx = {
  data: HomeReviewSummaryResponse | null;
  loading: boolean;
  error: boolean;
};

const HomeV2ReviewSummaryContext = createContext<Ctx>({ data: null, loading: true, error: false });

export function HomeV2ReviewSummaryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ data: null, loading: true, error: false });

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/reviews/home-summary", { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");
        const json = (await res.json()) as HomeReviewSummaryResponse;
        if (cancel) return;
        setState({ data: json, loading: false, error: false });
      } catch {
        if (!cancel) setState({ data: null, loading: false, error: true });
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return <HomeV2ReviewSummaryContext.Provider value={state}>{children}</HomeV2ReviewSummaryContext.Provider>;
}

export function useHomeV2ReviewSummary() {
  return useContext(HomeV2ReviewSummaryContext);
}
