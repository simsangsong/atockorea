"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, CloudSun, CloudRain, Check, X, Flower2, Sun, Leaf, Snowflake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * If a body line is a run-on of "Label (HH:MM), Label (HH:MM), Label (HH:MM)"
 * — typical for pickup/drop-off lists — split it into one sub-item per time
 * so they render as discrete bullets instead of a wall of commas.
 *
 * Conservative: requires ≥3 time refs AND ≥70% of comma-split parts to
 * contain a time, otherwise returns the line unchanged.
 */
function splitTimeSequences(line: string): string[] {
  const timeMatches = line.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  if (timeMatches.length < 3) return [line];
  const parts = line.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return [line];
  const withTime = parts.filter((p) => /\d{1,2}:\d{2}/.test(p)).length;
  if (withTime < Math.ceil(parts.length * 0.7)) return [line];
  // Restore trailing period that may have been on the last part
  return parts;
}

// Times (08:30, ≈17:50), KRW prices (₩10,000, ₩10,000–₩20,000), hour-units
// (10 h, 9.5 h), Korean equivalents (시간/분), and lone ≈ approximation marks.
const INLINE_HIGHLIGHT_RE =
  /(₩[\d,]+(?:\s*[-–~]\s*₩?[\d,]+)?|\b\d{1,2}:\d{2}\b|\b\d+(?:\.\d+)?\s*h\b|\d+(?:\.\d+)?\s*(?:시간|분|hours?|min(?:utes?)?)\b|≈|~)/g;

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  // Reset state for each call (global regex shares lastIndex across calls).
  INLINE_HIGHLIGHT_RE.lastIndex = 0;
  while ((m = INLINE_HIGHLIGHT_RE.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(<Fragment key={key++}>{text.slice(lastIdx, m.index)}</Fragment>);
    const token = m[0];
    if (token === "≈" || token === "~") {
      out.push(
        <span key={key++} className="mx-px text-[0.85em] text-slate-400">
          {token}
        </span>,
      );
    } else {
      out.push(
        <strong key={key++} className="font-semibold tabular-nums text-slate-900">
          {token}
        </strong>,
      );
    }
    lastIdx = m.index + token.length;
  }
  if (lastIdx < text.length) out.push(<Fragment key={key++}>{text.slice(lastIdx)}</Fragment>);
  return out;
}
import type { ForecastApiPayload } from "@/lib/weather/forecast-logic";
import { isWmoPrecipitationCode } from "@/lib/weather/open-meteo";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const SEASON_ICONS = {
  flower: Flower2,
  sun: Sun,
  leaf: Leaf,
  snow: Snowflake,
} as const;

type SeasonTheme = {
  card: string;
  ring: string;
  iconRing: string;
  iconColor: string;
};

/*
 * 사용자 요청 (2026-05-18) §B-P7: Sprint 2.9 + §B-P3 follow-up reversal — Seasonal cards 원본 4색 (rose/amber/orange/sky) 복원.
 * 마스터플랜 시작 전 (commit 111ef096) per-season gradient 카드 = 사용자가 premium feel로 인식한 baseline.
 */
const SEASON_THEMES: Record<string, SeasonTheme> = {
  flower: {
    card: "bg-gradient-to-br from-rose-50 via-white to-rose-100/50",
    ring: "ring-rose-100/70",
    iconRing: "bg-gradient-to-br from-rose-100 to-rose-200/60 ring-rose-200/60",
    iconColor: "text-rose-500",
  },
  sun: {
    card: "bg-gradient-to-br from-amber-50 via-white to-amber-100/50",
    ring: "ring-amber-100/70",
    iconRing: "bg-gradient-to-br from-amber-100 to-amber-200/70 ring-amber-200/60",
    iconColor: "text-amber-500",
  },
  leaf: {
    card: "bg-gradient-to-br from-orange-50 via-white to-orange-100/50",
    ring: "ring-orange-100/70",
    iconRing: "bg-gradient-to-br from-orange-100 to-orange-200/60 ring-orange-200/60",
    iconColor: "text-orange-500",
  },
  snow: {
    card: "bg-gradient-to-br from-sky-50 via-white to-sky-100/50",
    ring: "ring-sky-100/70",
    iconRing: "bg-gradient-to-br from-sky-100 to-sky-200/60 ring-sky-200/60",
    iconColor: "text-sky-500",
  },
};

const SEASON_THEME_FALLBACK: SeasonTheme = {
  card: "bg-gradient-to-br from-slate-50 via-white to-slate-100/40",
  ring: "ring-border/70",
  iconRing: "bg-gradient-to-br from-slate-100 to-slate-200/60 ring-border/60",
  iconColor: "text-slate-500",
};

/** Derive season theme + icon from name (schema v7 dropped explicit icon/bgClass fields). */
function resolveSeason(name: string, iconKey?: string): { theme: SeasonTheme; Icon: typeof Flower2 } {
  if (iconKey && SEASON_THEMES[iconKey]) {
    const Icon = SEASON_ICONS[iconKey as keyof typeof SEASON_ICONS] ?? Flower2;
    return { theme: SEASON_THEMES[iconKey], Icon };
  }
  const t = name.toLowerCase();
  if (/spring|봄|春|primavera/.test(t)) return { theme: SEASON_THEMES.flower, Icon: Flower2 };
  if (/summer|여름|夏|verano/.test(t)) return { theme: SEASON_THEMES.sun, Icon: Sun };
  if (/autumn|fall|가을|秋|otoño/.test(t)) return { theme: SEASON_THEMES.leaf, Icon: Leaf };
  if (/winter|겨울|冬|invierno/.test(t)) return { theme: SEASON_THEMES.snow, Icon: Snowflake };
  return { theme: SEASON_THEME_FALLBACK, Icon: Flower2 };
}

export type TourPracticalDetailsProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "practicalAccordionItems" | "practicalWeatherStatic" | "seasonalVariations" | "sectionUi"
> & {
  /**
   * Open-Meteo via `/api/weather/forecast`. slug가 있으면 슬러그별 대표 명소
   * 좌표·라벨로 응답하고, 없으면 동쪽 앵커로 폴백.
   * false면 정적 practicalWeatherStatic 만 사용.
   */
  useLiveWeather?: boolean;
  /** 슬러그 → 대표 명소 좌표 매핑(`lib/weather/tour-weather-anchor`)에 사용. */
  tourProductSlug?: string;
};

export function TourPracticalDetails({
  practicalAccordionItems,
  practicalWeatherStatic,
  seasonalVariations,
  sectionUi,
  useLiveWeather = true,
  tourProductSlug,
}: TourPracticalDetailsProps) {
  const { locale } = useI18n();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [liveForecast, setLiveForecast] = useState<ForecastApiPayload | null>(null);

  useEffect(() => {
    if (!useLiveWeather) return;
    let cancelled = false;

    /**
     * 2026-05-18 fix: 이전엔 silent fail (catch 빈 블록) — fetch 한 번 실패하면
     * 사용자에게는 "—" 표시만 남고 dev/PM 모두 원인 알 수 없음. console.warn
     * + 1회 retry (800ms backoff) 추가. retry도 실패하면 static fallback.
     */
    async function fetchOnce(): Promise<ForecastApiPayload | null> {
      const qs = new URLSearchParams({ locale });
      if (tourProductSlug) qs.set("slug", tourProductSlug);
      const res = await fetch(`/api/weather/forecast?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn(`[TourPracticalDetails] weather fetch HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as ForecastApiPayload & { error?: string };
      if (data.error) {
        console.warn(`[TourPracticalDetails] weather API error: ${data.error}`);
        return null;
      }
      if (!data?.current || !data?.days?.length) {
        console.warn("[TourPracticalDetails] weather API returned no current/days");
        return null;
      }
      return data;
    }

    (async () => {
      try {
        let data = await fetchOnce();
        if (!data && !cancelled) {
          await new Promise((r) => setTimeout(r, 800));
          if (cancelled) return;
          data = await fetchOnce();
        }
        if (data && !cancelled) {
          setLiveForecast(data);
        }
      } catch (err) {
        console.warn("[TourPracticalDetails] weather fetch threw:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useLiveWeather, locale, tourProductSlug]);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const todayDay = liveForecast?.days[0];
  const tomorrowDay = liveForecast?.days[1];
  const cur = liveForecast?.current;

  const staticToday = practicalWeatherStatic?.today;
  const staticTomorrow = practicalWeatherStatic?.tomorrow;

  const todayTemp =
    cur != null ? `${cur.tempC}°` : (staticToday?.temp ?? "—");
  const todayLabel =
    cur != null ? `Today · ${cur.conditionLabel}` : (staticToday?.label ?? "");
  const tomorrowTemp =
    tomorrowDay != null
      ? `${tomorrowDay.tempMax}°/${tomorrowDay.tempMin}°`
      : (staticTomorrow?.temp ?? "—");
  const tomorrowLabel =
    tomorrowDay != null
      ? `Tomorrow · ${tomorrowDay.conditionLabel}`
      : (staticTomorrow?.label ?? "");

  const weatherRegionFallback = locale === "ko" ? "제주 동쪽 지역" : "East Jeju region";
  const weatherStripTitle = liveForecast?.areaLabel
    ? locale === "ko"
      ? `실시간 날씨 · ${liveForecast.areaLabel}`
      : `Live weather · ${liveForecast.areaLabel}`
    : locale === "ko"
      ? `실시간 날씨 · ${weatherRegionFallback}`
      : `Live weather · ${weatherRegionFallback}`;

  /** API 응답 전·실패 시 기존 정적 카드와 동일: 좌 CloudSun, 우 CloudRain */
  const isTodayRain = !!(liveForecast && cur != null && isWmoPrecipitationCode(cur.weatherCode));
  const TodayIcon = isTodayRain ? CloudRain : CloudSun;
  const todayIconClass = isTodayRain ? "text-sky-500" : "text-amber-500";

  const isTomorrowRain = !liveForecast || !tomorrowDay
    ? true
    : isWmoPrecipitationCode(tomorrowDay.weatherCode);
  const TomorrowIcon = isTomorrowRain ? CloudRain : CloudSun;
  const tomorrowIconClass = isTomorrowRain ? "text-sky-500" : "text-amber-500";

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-title text-foreground">{sectionUi.practicalTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.practicalSubtitle}</p>
      </div>

      {/* 사용자 요청 (2026-05-18) §B-P7: Sprint 2.8 reversal — Weather 4-layer gradient 원본 복원 (마스터플랜 시작 전 baseline = 사용자 premium 인식 기준). */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-4 ring-1",
          "bg-gradient-to-br from-[#fcf9f4] via-[#fefcf8] to-[#f8f4ec]",
          "ring-amber-100/40",
          "shadow-[0_2px_4px_rgba(26,35,50,0.05),0_6px_14px_-4px_rgba(26,35,50,0.08),0_22px_44px_-18px_rgba(26,35,50,0.20),0_12px_24px_-12px_rgba(26,35,50,0.12)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/60 to-transparent" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
          {weatherStripTitle}
        </p>
        <div className="relative grid grid-cols-2 gap-2.5">
          <div
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-3 ring-1",
              isTodayRain
                ? "bg-gradient-to-br from-sky-50 via-white to-sky-100/55 ring-sky-100/70 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(14,165,233,0.28)]"
                : "bg-gradient-to-br from-amber-50 via-white to-amber-100/55 ring-amber-100/70 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(245,158,11,0.28)]",
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
            <div
              className={cn(
                "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1",
                isTodayRain
                  ? "bg-gradient-to-br from-sky-100 to-sky-200/70 ring-sky-200/70"
                  : "bg-gradient-to-br from-amber-100 to-amber-200/70 ring-amber-200/70",
              )}
            >
              <TodayIcon className={cn("h-5 w-5", todayIconClass)} strokeWidth={1.7} />
            </div>
            <div className="relative">
              <p className="text-xl font-semibold text-foreground leading-none tabular-nums">{todayTemp}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{todayLabel}</p>
            </div>
          </div>
          <div
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-3 ring-1",
              isTomorrowRain
                ? "bg-gradient-to-br from-sky-50 via-white to-sky-100/55 ring-sky-100/70 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(14,165,233,0.28)]"
                : "bg-gradient-to-br from-amber-50 via-white to-amber-100/55 ring-amber-100/70 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(245,158,11,0.28)]",
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
            <div
              className={cn(
                "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1",
                isTomorrowRain
                  ? "bg-gradient-to-br from-sky-100 to-sky-200/70 ring-sky-200/70"
                  : "bg-gradient-to-br from-amber-100 to-amber-200/70 ring-amber-200/70",
              )}
            >
              <TomorrowIcon className={cn("h-5 w-5", tomorrowIconClass)} strokeWidth={1.7} />
            </div>
            <div className="relative">
              <p className="text-xl font-semibold text-foreground leading-none tabular-nums">{tomorrowTemp}</p>
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
            {seasonalVariations.map((season, idx) => {
              // schema_version=1: { name, icon, tag, bgClass, iconColor, description }
              // schema_version=7: { season, description } (icon/tag/bgClass dropped)
              const seasonAny = season as {
                name?: string;
                season?: string;
                icon?: string;
                tag?: string;
                bgClass?: string;
                iconColor?: string;
                description: string;
              };
              const displayName = seasonAny.name ?? seasonAny.season ?? `Season ${idx + 1}`;
              const { theme, Icon } = resolveSeason(displayName, seasonAny.icon);
              return (
                <div
                  key={displayName}
                  className={cn(
                    "group relative shrink-0 snap-start overflow-hidden rounded-xl p-4 ring-1 transition-all duration-300",
                    "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_-4px_rgba(0,0,0,0.07)]",
                    "hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_20px_-4px_rgba(0,0,0,0.10)]",
                    "w-[min(280px,calc(100vw-3.5rem))] sm:w-[min(280px,calc(100%-1rem))]",
                    theme.card,
                    theme.ring,
                  )}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
                  <div className="relative flex items-start justify-between mb-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full ring-1 transition-transform duration-300 group-hover:scale-[1.06]",
                        theme.iconRing,
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", theme.iconColor)} strokeWidth={1.7} />
                    </div>
                    {seasonAny.tag ? (
                      <span className="text-[9px] font-medium text-muted-foreground bg-white/85 px-1.5 py-0.5 rounded-md ring-1 ring-border/40">
                        {seasonAny.tag}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="relative text-[14px] font-semibold tracking-tight text-foreground">{displayName}</h4>
                  <p className="relative mt-1 text-[11.5px] text-muted-foreground leading-relaxed">{seasonAny.description}</p>
                </div>
              );
            })}
            <div className="shrink-0 w-2 sm:w-0" aria-hidden />
          </div>
        </div>
      </div>

      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {practicalAccordionItems.map((item) => {
          const isOpen = expandedItems.includes(item.id);
          /* §B-P11 확장 #5: per-item content count → 동적 stagger 가이드. */
          const contentCount = item.content?.length ?? 0;
          const itemStagger =
            contentCount <= 3 ? "0ms" :
            contentCount <= 6 ? "60ms" :
            contentCount <= 10 ? "40ms" : "28ms";
          return (
            <div key={item.id}>
              <button
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="pr-4 min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  {item.preview && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {item.preview}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "flex-shrink-0 rounded-full p-1 transition-all duration-200",
                    isOpen ? "bg-primary/10 rotate-180" : "",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isOpen ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </div>
              </button>

              {/* §B-P11 확장 #5: FAQ accordion content book-page cascade. content lines가 cascade children. */}
              <div
                className="book-cascade"
                data-state={isOpen ? "open" : "closed"}
              >
                <div>
                  <div className="px-4 pb-5">
                    {/* Left accent rail visually separates answer from question */}
                    <ul
                      className="book-cascade-list ml-1 space-y-3 border-l-2 border-[var(--accent)]/40 pl-4"
                      style={{ ["--book-stagger" as string]: itemStagger }}
                    >
                      {(item.content ?? []).flatMap((rawLine, i) => {
                        // included variant keeps its check/X iconography unchanged
                        if (item.variant === "included") {
                          const splitAt = item.includedCount ?? 5;
                          const isIncluded = i < splitAt;
                          return [
                            <li
                              key={i}
                              className="-ml-[1.4rem] flex items-start gap-2.5 text-[13.5px] leading-[1.65]"
                            >
                              {isIncluded ? (
                                <>
                                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                                  <span className="text-slate-700">{rawLine}</span>
                                </>
                              ) : (
                                <>
                                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                                  <span className="text-muted-foreground">{rawLine}</span>
                                </>
                              )}
                            </li>,
                          ];
                        }
                        // For prose lines: optionally split comma-time sequences
                        // into discrete sub-bullets, then auto-bold inline times/
                        // prices/durations and dim the ≈ approximation marks.
                        const subLines = splitTimeSequences(rawLine);
                        return subLines.map((sub, j) => (
                          <li
                            key={`${i}-${j}`}
                            className="text-[13px] leading-[1.7] text-slate-600"
                          >
                            {renderInline(sub)}
                          </li>
                        ));
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
