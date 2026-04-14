"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Cloud, CloudRain, CloudSun, Loader2, Sun, Umbrella, Wind } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { isWmoPrecipitationCode } from "@/lib/weather/open-meteo"
import { WEATHER_ADVISORY_COPY, type WeatherAdvisoryKind } from "@/lib/weather/advisory-templates"
import {
  advisoryKindsForTodayAndTomorrow,
  type ForecastApiPayload,
  type ForecastDayPayload,
} from "@/lib/weather/forecast-logic"
import { cn } from "@/lib/utils"

export type TourWeatherSectionProps = {
  /** Shown in subtitle, e.g. "East Jeju region" / "제주 동쪽 지역" */
  areaLabel?: string
  latitude?: number
  longitude?: number
  /** Merges onto outer wrapper (default horizontal padding for legacy template). */
  className?: string
  /**
   * `premium` — `.sg-dp-weather-premium` + nested day cells (small-group tour detail).
   * `default` — legacy gray card (classic template / CRO).
   * `v0EastPracticalEmbed` — same fetch/API as premium; markup matches East v0 practical card (two cells, no extra chrome).
   */
  appearance?: "default" | "premium" | "v0EastPracticalEmbed"
  /**
   * When true, fixed wear/coast copy and advisory blocks sit behind one disclosure.
   * Today / tomorrow grid stays visible (section remains present on the page).
   */
  collapseAuxiliaryByDefault?: boolean
}

function WeatherGlyph({ code, className }: { code: number; className?: string }) {
  const cn = className ?? "w-6 h-6"
  if (code === 0) return <Sun className={cn} />
  if (code >= 1 && code <= 3) return <CloudSun className={cn} />
  if (isWmoPrecipitationCode(code)) return <CloudRain className={cn} />
  return <Cloud className={cn} />
}

function buildQuery(props: TourWeatherSectionProps & { locale: string }): string {
  const p = new URLSearchParams()
  if (props.latitude != null && Number.isFinite(props.latitude)) {
    p.set("lat", String(props.latitude))
  }
  if (props.longitude != null && Number.isFinite(props.longitude)) {
    p.set("lon", String(props.longitude))
  }
  if (props.areaLabel?.trim()) {
    p.set("area", props.areaLabel.trim())
  }
  if (props.locale?.trim()) {
    p.set("locale", props.locale.trim())
  }
  const q = p.toString()
  return q ? `?${q}` : ""
}

export function TourWeatherSection({
  areaLabel,
  latitude,
  longitude,
  className,
  appearance = "default",
  collapseAuxiliaryByDefault = false,
}: TourWeatherSectionProps) {
  const { locale } = useI18n()
  const premium = appearance === "premium"
  const v0EastPracticalEmbed = appearance === "v0EastPracticalEmbed"
  const [data, setData] = useState<ForecastApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auxiliaryOpen, setAuxiliaryOpen] = useState(!collapseAuxiliaryByDefault)

  useEffect(() => {
    let cancelled = false
    const q = buildQuery({ areaLabel, latitude, longitude, locale })
    setLoading(true)
    setError(null)
    fetch(`/api/weather/forecast${q}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(typeof j?.error === "string" ? j.error : "Forecast unavailable")
        }
        return res.json() as Promise<ForecastApiPayload>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load weather")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [areaLabel, latitude, longitude, locale])

  const today: ForecastDayPayload | undefined = data?.days[0]
  const tomorrow: ForecastDayPayload | null = data?.days[1] ?? null

  const advisoryDisplayBlocks = useMemo(() => {
    if (!today || !data) return []
    if (data.advisoryBlocks != null) {
      return data.advisoryBlocks
    }
    const kinds = advisoryKindsForTodayAndTomorrow(today, tomorrow, data.current)
    return kinds.map((kind: WeatherAdvisoryKind) => ({
      kind,
      title: WEATHER_ADVISORY_COPY[kind].title,
      body: WEATHER_ADVISORY_COPY[kind].body,
    }))
  }, [today, tomorrow, data])

  if (v0EastPracticalEmbed) {
    const headlineArea = data?.areaLabel ?? areaLabel ?? "…"
    return (
      <div className={cn(className)}>
        <p className="text-[10px] font-medium text-muted-foreground tracking-wide mb-3">
          Live weather · {headlineArea}
        </p>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
            <span className="text-xs">Loading…</span>
          </div>
        ) : null}
        {!loading && error ? (
          <p className="py-2 text-center text-xs leading-snug text-muted-foreground">{error}</p>
        ) : null}
        {!loading && !error && data && today ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-mist-blue/60 border border-border/40 px-3.5 py-3">
              <WeatherGlyph
                code={data.current.weatherCode}
                className="h-8 w-8 text-amber-400 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xl font-semibold text-foreground leading-none tabular-nums">
                  {data.current.tempC}°
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  Today · {data.current.conditionLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-cloud-gray/60 border border-border/40 px-3.5 py-3">
              {tomorrow ? (
                <>
                  <WeatherGlyph
                    code={tomorrow.weatherCode}
                    className="h-8 w-8 text-slate-400 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-foreground leading-none tabular-nums">
                      {tomorrow.tempMax}°/{tomorrow.tempMin}°
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      Tomorrow · {tomorrow.conditionLabel}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground py-2">—</div>
              )}
            </div>
          </div>
        ) : null}
        {!loading && !error && (!data || !today) ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Forecast unavailable</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("px-5 pb-1", className)}>
      <div
        className={cn(
          premium ? "sg-dp-weather-premium" : "rounded-lg border border-gray-150 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.03)]",
        )}
        style={
          premium
            ? undefined
            : { background: "linear-gradient(180deg, #FFFFFF 0%, #FDFCFB 100%)" }
        }
      >
        <div
          className={cn(
            "flex justify-between gap-2",
            premium ? "mb-1.5 items-baseline sm:mb-2" : "mb-1 items-start",
          )}
        >
          <span
            className={cn(
              "font-semibold uppercase leading-none tracking-[0.12em]",
              premium ? "text-[10.5px] text-neutral-500 sm:text-[11px]" : "text-[11px] leading-snug text-gray-500",
            )}
          >
            Weather
          </span>
          <span
            className={cn(
              "line-clamp-2 max-w-[min(72%,14rem)] text-right leading-snug",
              premium
                ? "text-[10.5px] text-neutral-500 sm:max-w-[70%] sm:text-[11px]"
                : "text-[11px] text-gray-500",
            )}
          >
            {data ? data.areaLabel : "…"}
          </span>
        </div>

        {loading && (
          <div
            className={cn(
              "flex items-center justify-center gap-2 py-4",
              premium ? "text-neutral-400" : "text-gray-400",
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {!loading && error && (
          <p
            className={cn(
              "py-2 text-center text-xs leading-snug",
              premium ? "text-neutral-500" : "text-gray-500",
            )}
          >
            {error}
          </p>
        )}

        {!loading && !error && data && today && (
          <>
            {/* Compact square-ish cards: Today | Tomorrow — one row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div
                className={cn(
                  "flex aspect-[5/4] min-h-0 min-w-0 flex-col px-1.5 py-1 text-center",
                  premium
                    ? "sg-dp-weather-premium-day"
                    : "rounded-lg border border-amber-100/70 bg-amber-50/45 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase leading-none tracking-[0.1em]",
                    premium ? "text-neutral-500" : "text-gray-500",
                  )}
                >
                  Today
                </p>
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 pb-0.5 pt-1">
                  <WeatherGlyph
                    code={data.current.weatherCode}
                    className={cn(
                      "h-5 w-5 shrink-0",
                      premium ? "text-amber-700/85" : "text-amber-500",
                    )}
                  />
                  <p
                    className={cn(
                      "text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em]",
                      premium ? "text-neutral-900" : "text-gray-900",
                    )}
                  >
                    {data.current.tempC}°
                  </p>
                  <p
                    className={cn(
                      "text-[11px] font-medium tabular-nums leading-tight",
                      premium ? "text-neutral-600" : "text-gray-600",
                    )}
                  >
                    H {today.tempMax}° · L {today.tempMin}°
                  </p>
                  <p
                    className={cn(
                      "line-clamp-2 w-full text-[11px] font-medium leading-snug",
                      premium ? "text-neutral-800" : "text-gray-700",
                    )}
                  >
                    {data.current.conditionLabel}
                  </p>
                  <p
                    className={cn(
                      "line-clamp-2 w-full text-[10px] leading-snug",
                      premium ? "text-neutral-600" : "text-gray-600",
                    )}
                  >
                    Feels {data.current.feelsLikeC}° · Wind {data.current.windKmh} km/h
                  </p>
                  {today.popMax > 0 ? (
                    <p
                      className={cn(
                        "flex items-center justify-center gap-1 text-[11px] font-medium tabular-nums",
                        premium ? "text-neutral-800" : "text-gray-700",
                      )}
                    >
                      <Umbrella className="h-3 w-3 opacity-80" aria-hidden />
                      {today.popMax}%
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={cn(
                  "flex aspect-[5/4] min-h-0 min-w-0 flex-col px-1.5 py-1 text-center",
                  premium
                    ? "sg-dp-weather-premium-day"
                    : "rounded-lg border border-sky-100/60 bg-sky-50/35 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                )}
              >
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase leading-none tracking-[0.1em]",
                    premium ? "text-neutral-500" : "text-gray-500",
                  )}
                >
                  Tomorrow
                </p>
                {tomorrow ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5 pb-0.5 pt-1">
                    <WeatherGlyph
                      code={tomorrow.weatherCode}
                      className={cn(
                        "h-5 w-5 shrink-0",
                        premium ? "text-sky-800/75" : "text-sky-500",
                      )}
                    />
                    <p
                      className={cn(
                        "text-[20px] font-semibold tabular-nums leading-none tracking-[-0.02em]",
                        premium ? "text-neutral-900" : "text-gray-900",
                      )}
                    >
                      {tomorrow.tempMax}°
                      <span className={premium ? "text-neutral-400" : "text-gray-400"}>/</span>
                      {tomorrow.tempMin}°
                    </p>
                    <p
                      className={cn(
                        "line-clamp-2 w-full text-[11px] font-medium leading-snug",
                        premium ? "text-neutral-800" : "text-gray-800",
                      )}
                    >
                      {tomorrow.conditionLabel}
                    </p>
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] leading-snug",
                        premium ? "text-neutral-600" : "text-gray-600",
                      )}
                    >
                      {tomorrow.popMax > 0 ? (
                        <span className="inline-flex items-center gap-0.5 tabular-nums">
                          <Umbrella className="h-3 w-3 opacity-80" aria-hidden />
                          {tomorrow.popMax}%
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-0.5 tabular-nums">
                        <Wind className="h-3 w-3 opacity-80" aria-hidden />
                        {tomorrow.windMaxKmh} km/h
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex flex-1 items-center justify-center text-xs",
                      premium ? "text-neutral-400" : "text-gray-400",
                    )}
                  >
                    —
                  </div>
                )}
              </div>
            </div>

            {collapseAuxiliaryByDefault ? (
              <>
                <button
                  type="button"
                  onClick={() => setAuxiliaryOpen((o) => !o)}
                  aria-expanded={auxiliaryOpen}
                  className={cn(
                    "mt-2 flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors duration-200",
                    premium
                      ? "border-neutral-200/80 bg-white/55 text-[11px] font-semibold text-neutral-800 hover:bg-white/85"
                      : "border-gray-200/80 bg-white/70 text-[11px] font-semibold text-gray-800 hover:bg-gray-50/90",
                  )}
                >
                  <span>What to wear & forecast notes</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-300 ease-out",
                      auxiliaryOpen ? "rotate-180" : "",
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    auxiliaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div
                      className={cn(
                        "mt-2 space-y-1 border-t pt-2",
                        premium ? "border-neutral-200/75" : "border-gray-100/80",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[11px] leading-snug",
                          premium ? "text-neutral-700" : "text-gray-700",
                        )}
                      >
                        <span className={cn("font-semibold", premium ? "text-neutral-900" : "text-gray-800")}>
                          Wear:
                        </span>{" "}
                        layers + wind shell.
                      </p>
                      <p
                        className={cn(
                          "text-[11px] leading-snug",
                          premium ? "text-neutral-700" : "text-gray-700",
                        )}
                      >
                        <span className={cn("font-semibold", premium ? "text-neutral-900" : "text-gray-800")}>
                          Coast:
                        </span>{" "}
                        often cooler/windier than the number.
                      </p>
                    </div>
                    {advisoryDisplayBlocks.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {advisoryDisplayBlocks.map((block) => (
                          <div
                            key={block.kind}
                            className={cn(
                              "px-2 py-1.5",
                              premium
                                ? "sg-dp-card-nested"
                                : "rounded-lg border border-amber-200/70 bg-amber-50/50",
                            )}
                          >
                            <p
                              className={cn(
                                "text-[11px] font-semibold leading-snug",
                                premium ? "text-neutral-900" : "text-amber-950",
                              )}
                            >
                              {block.title}
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-[12px] leading-snug",
                                premium ? "text-neutral-700" : "text-amber-950/90",
                              )}
                            >
                              {block.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : premium ? (
              <>
                <div className="mt-2 grid gap-1 border-t border-neutral-200/75 pt-2 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-0.5">
                  <p className="text-[10.5px] leading-snug text-neutral-700 sm:text-[11px]">
                    <span className="font-semibold text-neutral-900">Wear</span>
                    <span className="text-neutral-400" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                    layers + wind shell
                  </p>
                  <p className="text-[10.5px] leading-snug text-neutral-700 sm:text-[11px]">
                    <span className="font-semibold text-neutral-900">Coast</span>
                    <span className="text-neutral-400" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                    often cooler / windier than the number
                  </p>
                </div>
                {advisoryDisplayBlocks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {advisoryDisplayBlocks.map((block) => (
                      <details
                        key={block.kind}
                        className="group sg-dp-weather-advisory-disclosure sg-dp-card-nested overflow-hidden"
                      >
                        <summary className="sg-dp-disclosure-summary flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors duration-200 hover:bg-white/70">
                          <span className="text-[11px] font-semibold leading-snug text-neutral-900">{block.title}</span>
                          <ChevronDown
                            className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ease-out group-open:rotate-180"
                            aria-hidden
                            strokeWidth={2}
                          />
                        </summary>
                        <p className="border-t border-neutral-200/55 px-2 pb-2 pt-1.5 text-[11.5px] leading-snug text-neutral-700">
                          {block.body}
                        </p>
                      </details>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "mt-2 space-y-1 border-t pt-2",
                    "border-gray-100/80",
                  )}
                >
                  <p className="text-[11px] leading-snug text-gray-700">
                    <span className="font-semibold text-gray-800">Wear:</span> layers + wind shell.
                  </p>
                  <p className="text-[11px] leading-snug text-gray-700">
                    <span className="font-semibold text-gray-800">Coast:</span> often cooler/windier than the number.
                  </p>
                </div>

                {advisoryDisplayBlocks.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {advisoryDisplayBlocks.map((block) => (
                      <div
                        key={block.kind}
                        className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-2 py-1.5"
                      >
                        <p className="text-[11px] font-semibold leading-snug text-amber-950">{block.title}</p>
                        <p className="mt-1 text-[12px] leading-snug text-amber-950/90">{block.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
