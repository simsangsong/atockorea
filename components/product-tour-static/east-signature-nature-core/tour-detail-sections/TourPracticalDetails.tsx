"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, CloudSun, CloudRain, Check, X, Flower2, Sun, Leaf, Snowflake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SegmentedToggle } from "@/components/product-tour-static/_shared/SegmentedToggle";

/**
 * °C / °F pill toggle rendered below the two live-weather cards. Stays inside
 * the weather strip's amber card so it visually groups with the temperatures
 * it controls.
 */
function TempUnitToggle({
  unit,
  onChange,
  locale,
}: {
  unit: TempUnit;
  onChange: (next: TempUnit) => void;
  locale: string;
}) {
  const labels: Record<TempUnit, string> = {
    C: locale === "ko" ? "섭씨로 보기" : locale === "ja" ? "摂氏で表示" : locale.startsWith("zh") ? "切换为摄氏度" : locale === "es" ? "Mostrar en Celsius" : "Show in Celsius",
    F: locale === "ko" ? "화씨로 보기" : locale === "ja" ? "華氏で表示" : locale.startsWith("zh") ? "切换为华氏度" : locale === "es" ? "Mostrar en Fahrenheit" : "Show in Fahrenheit",
  };
  const units: readonly TempUnit[] = ["C", "F"];
  return (
    <div
      role="group"
      aria-label={locale === "ko" ? "온도 단위" : "Temperature unit"}
      className="inline-flex rounded-full bg-white/85 p-0.5 ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(26,35,50,0.04)]"
    >
      {units.map((u) => {
        const active = u === unit;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            aria-pressed={active}
            aria-label={labels[u]}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
              active
                ? "bg-foreground text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            °{u}
          </button>
        );
      })}
    </div>
  );
}

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
import {
  convertStaticTempString,
  formatLiveTemp,
  useTempUnit,
  cToF,
  type TempUnit,
} from "@/lib/weather/temperature-units";
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

const SEASON_THEMES: Record<string, SeasonTheme> = {
  flower: {
    card: "bg-[color:var(--tpc-rose-wash)]",
    ring: "ring-slate-900/[0.06]",
    iconRing: "bg-[color:var(--tpc-rose-wash)] ring-slate-900/[0.06]",
    iconColor: "text-[color:var(--tpc-rose-full)]",
  },
  sun: {
    card: "bg-[color:var(--tpc-amber-wash)]",
    ring: "ring-slate-900/[0.06]",
    iconRing: "bg-[color:var(--tpc-amber-wash)] ring-slate-900/[0.06]",
    iconColor: "text-[color:var(--tpc-amber-full)]",
  },
  leaf: {
    card: "bg-[color:var(--tpc-orange-wash)]",
    ring: "ring-slate-900/[0.06]",
    iconRing: "bg-[color:var(--tpc-orange-wash)] ring-slate-900/[0.06]",
    iconColor: "text-[color:var(--tpc-orange-full)]",
  },
  snow: {
    card: "bg-[color:var(--tpc-sapphire-wash)]",
    ring: "ring-slate-900/[0.06]",
    iconRing: "bg-[color:var(--tpc-sapphire-wash)] ring-slate-900/[0.06]",
    iconColor: "text-[color:var(--tpc-sapphire-full)]",
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
  const [tempUnit, setTempUnit] = useTempUnit();

  /**
   * W3.5 — seasons render as one card behind the shared segmented toggle,
   * defaulting to the season that contains today (KST). `seasonIdx` is null
   * until the visitor picks; the computed default keeps SSG HTML and client
   * hydration aligned except across a month boundary inside a stale ISR hour
   * (harmless).
   */
  const seasonMeta = (seasonalVariations ?? []).map((season, idx) => {
    const seasonAny = season as {
      name?: string;
      season?: string;
      icon?: string;
      tag?: string;
      description: string;
    };
    const displayName = seasonAny.name ?? seasonAny.season ?? `Season ${idx + 1}`;
    const { theme, Icon } = resolveSeason(displayName, seasonAny.icon);
    return { displayName, tag: seasonAny.tag, description: seasonAny.description, theme, Icon };
  });
  const [seasonIdx, setSeasonIdx] = useState<number | null>(null);
  const month = new Date().getMonth() + 1;
  const currentKind = month >= 3 && month <= 5 ? "flower" : month >= 6 && month <= 8 ? "sun" : month >= 9 && month <= 11 ? "leaf" : "snow";
  const defaultSeasonIdx = Math.max(
    0,
    seasonMeta.findIndex((s) => s.theme === SEASON_THEMES[currentKind]),
  );
  const effectiveSeasonIdx = seasonIdx ?? defaultSeasonIdx;

  useEffect(() => {
    if (!useLiveWeather) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ locale });
        if (tourProductSlug) qs.set("slug", tourProductSlug);
        const res = await fetch(`/api/weather/forecast?${qs.toString()}`, {
          cache: "no-store",
        });
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
    cur != null
      ? formatLiveTemp(cur.tempC, tempUnit)
      : convertStaticTempString(staticToday?.temp, tempUnit);
  const todayLabel =
    cur != null ? `Today · ${cur.conditionLabel}` : (staticToday?.label ?? "");
  const tomorrowTemp =
    tomorrowDay != null
      ? tempUnit === "C"
        ? `${tomorrowDay.tempMax}°/${tomorrowDay.tempMin}°`
        : `${cToF(tomorrowDay.tempMax)}°/${cToF(tomorrowDay.tempMin)}°`
      : convertStaticTempString(staticTomorrow?.temp, tempUnit);
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
  const todayIconClass = isTodayRain ? "text-[color:var(--tpc-sapphire-full)]" : "text-[color:var(--tpc-amber-full)]";

  const isTomorrowRain = !liveForecast || !tomorrowDay
    ? true
    : isWmoPrecipitationCode(tomorrowDay.weatherCode);
  const TomorrowIcon = isTomorrowRain ? CloudRain : CloudSun;
  const tomorrowIconClass = isTomorrowRain ? "text-[color:var(--tpc-sapphire-full)]" : "text-[color:var(--tpc-amber-full)]";

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.practicalTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.practicalSubtitle}</p>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-4 ring-1",
          "bg-gradient-to-br from-[#fcf9f4] via-[#fefcf8] to-[#f8f4ec]",
          "ring-slate-900/[0.06]",
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
                ? "bg-[color:var(--tpc-sapphire-wash)] ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(14,165,233,0.28)]"
                : "bg-[color:var(--tpc-amber-wash)] ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(245,158,11,0.28)]",
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
            <div
              className={cn(
                "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1",
                isTodayRain
                  ? "bg-[color:var(--tpc-sapphire-wash)] ring-slate-900/[0.06]"
                  : "bg-[color:var(--tpc-amber-wash)] ring-slate-900/[0.06]",
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
                ? "bg-[color:var(--tpc-sapphire-wash)] ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(14,165,233,0.28)]"
                : "bg-[color:var(--tpc-amber-wash)] ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(26,35,50,0.04),0_10px_24px_-14px_rgba(245,158,11,0.28)]",
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
            <div
              className={cn(
                "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1",
                isTomorrowRain
                  ? "bg-[color:var(--tpc-sapphire-wash)] ring-slate-900/[0.06]"
                  : "bg-[color:var(--tpc-amber-wash)] ring-slate-900/[0.06]",
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
        <div className="relative mt-3 flex items-center justify-end">
          <TempUnitToggle unit={tempUnit} onChange={setTempUnit} locale={locale} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{sectionUi.seasonalTitle}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sectionUi.seasonalSubtitle}</p>
        </div>
        {/* W3.5 — the 4-card carousel becomes ONE card behind the shared
            segmented toggle (§F-8 ③), defaulting to the current season. All 4
            season hues survive (each card keeps its wash + icon tone) and the
            inactive seasons stay mounted (hidden) for the DOM round-trip. */}
        <div role="region" aria-label={sectionUi.seasonalTitle}>
          {seasonMeta.length > 1 ? (
            <SegmentedToggle
              ariaLabel={sectionUi.seasonalTitle}
              value={String(effectiveSeasonIdx)}
              onChange={(v) => setSeasonIdx(Number(v))}
              options={seasonMeta.map((s, idx) => ({ value: String(idx), label: s.displayName }))}
              className="mb-3"
            />
          ) : null}
          {seasonMeta.map((s, idx) => {
            const { theme, Icon } = s;
            return (
              <div
                key={s.displayName}
                hidden={idx !== effectiveSeasonIdx}
                className={cn(
                  "relative overflow-hidden rounded-xl p-4 ring-1",
                  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_-4px_rgba(0,0,0,0.07)]",
                  theme.card,
                  theme.ring,
                )}
              >
                <div className="relative mb-2.5 flex items-start justify-between">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-full ring-1", theme.iconRing)}>
                    <Icon className={cn("h-3.5 w-3.5", theme.iconColor)} strokeWidth={1.7} />
                  </div>
                  {s.tag ? (
                    <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground ring-1 ring-border/40">
                      {s.tag}
                    </span>
                  ) : null}
                </div>
                <h4 className="relative text-[14px] font-semibold tracking-tight text-foreground">{s.displayName}</h4>
                <p className="relative mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-premium overflow-hidden divide-y divide-border/60">
        {practicalAccordionItems.map((item) => {
          const isOpen = expandedItems.includes(item.id);
          return (
            <div key={item.id}>
              <button
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="pr-4 min-w-0">
                  <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 truncate text-[12px] leading-snug text-slate-500">
                    {item.preview}
                  </p>
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

              <div
                className={cn(
                  "grid transition-all duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="px-4 pb-5">
                    {/* Left accent rail visually separates answer from question */}
                    <ul className="ml-1 space-y-3 border-l-2 border-amber-200/60 pl-4">
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
                                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--tpc-jade-full)]" />
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
