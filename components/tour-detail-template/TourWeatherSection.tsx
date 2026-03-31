"use client"

import { useEffect, useMemo, useState } from "react"
import { Cloud, CloudRain, CloudSun, Loader2, Sun, Umbrella, Wind } from "lucide-react"
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
  /** Shown in subtitle, e.g. "Seongsan area" */
  areaLabel?: string
  latitude?: number
  longitude?: number
  /** Merges onto outer wrapper (default horizontal padding for legacy template). */
  className?: string
  /**
   * `premium` — `.sg-dp-weather-premium` + nested day cells (small-group tour detail).
   * `default` — legacy gray card (classic template / CRO).
   */
  appearance?: "default" | "premium"
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
}: TourWeatherSectionProps) {
  const { locale } = useI18n()
  const premium = appearance === "premium"
  const [data, setData] = useState<ForecastApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <div className="mb-1 flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase leading-snug tracking-[0.12em]",
              premium ? "text-neutral-500" : "text-gray-500",
            )}
          >
            Weather
          </span>
          <span
            className={cn(
              "line-clamp-2 max-w-[70%] text-right text-[11px] leading-snug",
              premium ? "text-neutral-500" : "text-gray-500",
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
          </>
        )}
      </div>
    </div>
  )
}
