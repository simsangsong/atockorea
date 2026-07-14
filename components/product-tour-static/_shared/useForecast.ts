"use client";

import { useEffect, useState } from "react";
import type { ForecastApiPayload } from "@/lib/weather/forecast-logic";

/**
 * W5.1 — page-wide single forecast fetch. The Live strip and the Practical
 * weather block both consume this module-level promise cache, so the page
 * still issues exactly ONE /api/weather/forecast request (network delta 0
 * versus the pre-strip page). Client-only, fired on idle after hydration —
 * the ISR server tree never sees live data (ISR invariant).
 */
const cache = new Map<string, Promise<ForecastApiPayload | null>>();

export function fetchForecastOnce(
  locale: string,
  tourProductSlug?: string,
): Promise<ForecastApiPayload | null> {
  const key = `${locale}|${tourProductSlug ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    const qs = new URLSearchParams({ locale });
    if (tourProductSlug) qs.set("slug", tourProductSlug);
    p = fetch(`/api/weather/forecast?${qs.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as ForecastApiPayload & { error?: string };
        if (data.error || !data?.current || !data?.days?.length) return null;
        return data;
      })
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

export function useForecast(
  locale: string,
  tourProductSlug?: string,
  enabled = true,
): ForecastApiPayload | null {
  const [data, setData] = useState<ForecastApiPayload | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    const kick = () => {
      void fetchForecastOnce(locale, tourProductSlug).then((v) => {
        if (on && v) setData(v);
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(kick, { timeout: 2500 });
      return () => {
        on = false;
        window.cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(kick, 60);
    return () => {
      on = false;
      window.clearTimeout(t);
    };
  }, [locale, tourProductSlug, enabled]);
  return data;
}
