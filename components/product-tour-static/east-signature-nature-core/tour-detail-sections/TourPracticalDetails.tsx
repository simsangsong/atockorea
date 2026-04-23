"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CloudSun, CloudRain, Check, X, Flower2, Sun, Leaf, Snowflake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ForecastApiPayload } from "@/lib/weather/forecast-logic";
import { isWmoPrecipitationCode } from "@/lib/weather/open-meteo";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const SEASON_ICONS = {
  flower: Flower2,
  sun: Sun,
  leaf: Leaf,
  snow: Snowflake,
} as const;

export type TourPracticalDetailsProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "practicalAccordionItems" | "practicalWeatherStatic" | "seasonalVariations" | "sectionUi"
> & {
  /**
   * Open-Meteo via `/api/weather/forecast` (좌표는 동쪽 앵커, 표시는 “동쪽 지역”).
   * false면 정적 practicalWeatherStatic 만 사용.
   */
  useLiveWeather?: boolean;
};

export function TourPracticalDetails({
  practicalAccordionItems,
  practicalWeatherStatic,
  seasonalVariations,
  sectionUi,
  useLiveWeather = true,
}: TourPracticalDetailsProps) {
  const { locale } = useI18n();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [liveForecast, setLiveForecast] = useState<ForecastApiPayload | null>(null);

  useEffect(() => {
    if (!useLiveWeather) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/weather/forecast?locale=${encodeURIComponent(locale)}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ForecastApiPayload & { error?: string };
        if (cancelled || data.error || !data?.current || !data?.days?.length) return;
        setLiveForecast(data);
      } catch {
        /* keep static strip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useLiveWeather, locale]);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const todayDay = liveForecast?.days[0];
  const tomorrowDay = liveForecast?.days[1];
  const cur = liveForecast?.current;

  const todayTemp =
    cur != null ? `${cur.tempC}°` : practicalWeatherStatic.today.temp;
  const todayLabel =
    cur != null ? `Today · ${cur.conditionLabel}` : practicalWeatherStatic.today.label;
  const tomorrowTemp =
    tomorrowDay != null
      ? `${tomorrowDay.tempMax}°/${tomorrowDay.tempMin}°`
      : practicalWeatherStatic.tomorrow.temp;
  const tomorrowLabel =
    tomorrowDay != null
      ? `Tomorrow · ${tomorrowDay.conditionLabel}`
      : practicalWeatherStatic.tomorrow.label;

  const weatherRegionFallback = locale === "ko" ? "제주 동쪽 지역" : "East Jeju region";
  const weatherStripTitle = liveForecast?.areaLabel
    ? locale === "ko"
      ? `실시간 날씨 · ${liveForecast.areaLabel}`
      : `Live weather · ${liveForecast.areaLabel}`
    : locale === "ko"
      ? `실시간 날씨 · ${weatherRegionFallback}`
      : `Live weather · ${weatherRegionFallback}`;

  /** API 응답 전·실패 시 기존 정적 카드와 동일: 좌 CloudSun, 우 CloudRain */
  const TodayIcon =
    liveForecast && cur != null && isWmoPrecipitationCode(cur.weatherCode) ? CloudRain : CloudSun;
  const todayIconClass =
    liveForecast && cur != null && isWmoPrecipitationCode(cur.weatherCode)
      ? "text-slate-400"
      : "text-amber-400";
  const TomorrowIcon =
    !liveForecast || !tomorrowDay
      ? CloudRain
      : isWmoPrecipitationCode(tomorrowDay.weatherCode)
        ? CloudRain
        : CloudSun;
  const tomorrowIconClass =
    !liveForecast || !tomorrowDay
      ? "text-slate-400"
      : isWmoPrecipitationCode(tomorrowDay.weatherCode)
        ? "text-slate-400"
        : "text-amber-400";

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.practicalTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.practicalSubtitle}</p>
      </div>

      <div className="card-premium p-4">
        <p className="text-[10px] font-medium text-muted-foreground tracking-wide mb-3">{weatherStripTitle}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-3 rounded-xl bg-mist-blue/60 border border-border/40 px-3.5 py-3">
            <TodayIcon className={cn("h-8 w-8 flex-shrink-0", todayIconClass)} />
            <div>
              <p className="text-xl font-semibold text-foreground leading-none">{todayTemp}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{todayLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-cloud-gray/60 border border-border/40 px-3.5 py-3">
            <TomorrowIcon className={cn("h-8 w-8 flex-shrink-0", tomorrowIconClass)} />
            <div>
              <p className="text-xl font-semibold text-foreground leading-none">{tomorrowTemp}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{tomorrowLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{sectionUi.seasonalTitle}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sectionUi.seasonalSubtitle}</p>
        </div>
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label={sectionUi.seasonalTitle}
          className="-mx-5 px-5"
        >
          <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain scrollbar-hide scroll-smooth snap-x snap-mandatory touch-pan-x pb-1.5 [-webkit-overflow-scrolling:touch]">
            {seasonalVariations.map((season) => {
              const Icon = SEASON_ICONS[season.icon];
              return (
                <div
                  key={season.name}
                  className={cn(
                    "relative shrink-0 snap-start rounded-xl border border-border/50 p-4 transition-all duration-200 hover:shadow-premium hover:border-border",
                    "w-[min(280px,calc(100vw-3.5rem))] sm:w-[min(280px,calc(100%-1rem))]",
                    season.bgClass,
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Icon className={cn("h-4 w-4", season.iconColor)} />
                    <span className="text-[9px] font-medium text-muted-foreground bg-white/70 px-1.5 py-0.5 rounded-md">
                      {season.tag}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{season.name}</h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{season.description}</p>
                </div>
              );
            })}
            <div className="shrink-0 w-2 sm:w-0" aria-hidden />
          </div>
        </div>
      </div>

      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {practicalAccordionItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => toggleItem(item.id)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
            >
              <div className="pr-4 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.preview}</p>
              </div>
              <div
                className={cn(
                  "flex-shrink-0 p-1 rounded-full transition-all duration-200",
                  expandedItems.includes(item.id) ? "bg-primary/10 rotate-180" : "",
                )}
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-colors", expandedItems.includes(item.id) ? "text-primary" : "text-muted-foreground")}
                />
              </div>
            </button>

            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                expandedItems.includes(item.id) ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-5">
                  <ul className="space-y-2.5">
                    {item.content.map((line, i) => {
                      if (item.variant === "included") {
                        const isIncluded = i < 5;
                        return (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            {isIncluded ? (
                              <>
                                <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span className="text-foreground">{line}</span>
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                                <span className="text-muted-foreground">{line}</span>
                              </>
                            )}
                          </li>
                        );
                      }
                      return (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
                          <span>{line}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
