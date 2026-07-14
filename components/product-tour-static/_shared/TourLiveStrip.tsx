"use client";

import { useEffect, useState } from "react";
import { CloudRain, CloudSun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isWmoPrecipitationCode } from "@/lib/weather/open-meteo";
import { useForecast } from "@/components/product-tour-static/_shared/useForecast";
import { HaenyeoStatusButton } from "@/components/product-tour-static/_shared/HaenyeoStatusButton";

export type TourLiveStripProps = {
  locale: "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";
  tourProductSlug?: string;
  /** Renders the haenyeo live status inside the strip (absorbs the old standalone section). */
  showHaenyeo?: boolean;
};

/**
 * W5.1 — "Live from Korea" strip (§I #5): today's weather + haenyeo-show
 * status + live dot + KST timestamp. NO price (pricing surface rule).
 *
 * Perf contract: client-only idle fetch through the page-wide forecast cache
 * (network delta 0 — the Practical block shares the same promise), fixed
 * min-height reserved in the server HTML so data arrival or absence shifts
 * nothing (CLS 0). No polling, no sockets — one fetch per pageview.
 */
export function TourLiveStrip({ locale, tourProductSlug, showHaenyeo = false }: TourLiveStripProps) {
  // The Practical weather block keys the shared forecast cache by the i18n
  // locale (geo-resolved) — use the SAME key here or the page pays a second
  // forecast request (found in QA: en-prop vs ko-i18n split the cache).
  const { locale: uiLocale } = useI18n();
  const forecast = useForecast(uiLocale, tourProductSlug);
  const current = forecast?.current ?? null;
  const WeatherIcon = current && isWmoPrecipitationCode(current.weatherCode) ? CloudRain : CloudSun;
  // Mount-only timestamp: SSG HTML carries the placeholder so hydration never
  // mismatches; the fixed-width slot keeps CLS at 0 when it fills.
  const [kst, setKst] = useState("--:--");
  useEffect(() => {
    setKst(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    );
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-4 py-2.5",
        "ring-1 ring-slate-900/[0.07]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06)]",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--tpc-jade-full)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--tpc-jade-deep)]">
          Live
        </span>
      </span>
      <span aria-hidden className="h-4 w-px bg-border" />
      {current ? (
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-foreground">
          <WeatherIcon className="h-4 w-4 flex-shrink-0 text-[color:var(--tpc-sapphire-full)]" strokeWidth={1.8} />
          <span className="tabular-nums">{Math.round(current.tempC)}°C</span>
          <span className="truncate text-muted-foreground">
            {forecast?.areaLabel} · {current.conditionLabel}
          </span>
        </span>
      ) : (
        <span className="text-[12px] text-muted-foreground">—</span>
      )}
      <span className="ml-auto flex-shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{kst} KST</span>
      {showHaenyeo ? (
        <span className="flex-shrink-0">
          <HaenyeoStatusButton locale={locale} variant="compact" autoFetch />
        </span>
      ) : null}
    </div>
  );
}
