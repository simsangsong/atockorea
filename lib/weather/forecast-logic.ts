import {
  isWmoPrecipitationCode,
  wmoWeatherLabel,
  type OpenMeteoForecastJson,
} from "./open-meteo"
import { resolveAdvisoryKinds, type WeatherAdvisoryKind } from "./advisory-templates"
import type { WeatherAdvisoryBlock } from "./resolve-advisory-copy"

/** Max POP (%) to treat as meaningful rain risk for tour messaging */
const RAIN_POP_THRESHOLD = 42
/** Daily liquid precip (mm) from model — light but visible rain */
const RAIN_PRECIP_MM_THRESHOLD = 1.5
/** Sustained daily max wind (km/h) — coastal “breezy / strong” */
const WIND_SUSTAINED_KMH = 38
/** Gusts (km/h) — “강풍”-ish for open areas; Open-Meteo gusts are model estimates */
const WIND_GUST_KMH = 52

export type ForecastDayPayload = {
  date: string
  weekdayShort: string
  slotLabel: "Today" | "Tomorrow" | string
  tempMax: number
  tempMin: number
  weatherCode: number
  conditionLabel: string
  popMax: number
  precipSumMm: number
  windMaxKmh: number
  gustMaxKmh: number
}

export type ForecastCurrentPayload = {
  tempC: number
  feelsLikeC: number
  humidityPct: number
  weatherCode: number
  conditionLabel: string
  windKmh: number
  gustKmh: number
}

export type ForecastApiPayload = {
  areaLabel: string
  latitude: number
  longitude: number
  source: "open-meteo"
  current: ForecastCurrentPayload
  /** Daily rows from Open-Meteo (typically today + tomorrow for the tour UI). */
  days: ForecastDayPayload[]
  /** Filled by `/api/weather/forecast` from DB + rain/wind detection (empty array = no alert). */
  advisoryBlocks?: WeatherAdvisoryBlock[]
}

function weekdayShortSeoul(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00+09:00`)
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Seoul" })
}

function dayLabel(index: number, isoDate: string): "Today" | "Tomorrow" | string {
  if (index === 0) return "Today"
  if (index === 1) return "Tomorrow"
  return weekdayShortSeoul(isoDate)
}

function dayHasRainRisk(args: {
  code: number
  popMax: number
  precipSumMm: number
}): boolean {
  if (args.precipSumMm >= RAIN_PRECIP_MM_THRESHOLD) return true
  if (args.popMax >= RAIN_POP_THRESHOLD) return true
  return isWmoPrecipitationCode(args.code)
}

function dayHasStrongWind(args: { windMaxKmh: number; gustMaxKmh: number }): boolean {
  return args.gustMaxKmh >= WIND_GUST_KMH || args.windMaxKmh >= WIND_SUSTAINED_KMH
}

/** Rain/wind advisories for one selected day; merges live `current` when that day is “today” in Seoul. */
export function advisoryKindsForSelectedDay(
  day: ForecastDayPayload,
  isSeoulToday: boolean,
  current: ForecastCurrentPayload | null
): WeatherAdvisoryKind[] {
  let rain = dayHasRainRisk({
    code: day.weatherCode,
    popMax: day.popMax,
    precipSumMm: day.precipSumMm,
  })
  let wind = dayHasStrongWind({ windMaxKmh: day.windMaxKmh, gustMaxKmh: day.gustMaxKmh })
  if (isSeoulToday && current) {
    if (current.gustKmh >= WIND_GUST_KMH || current.windKmh >= WIND_SUSTAINED_KMH - 4) {
      wind = true
    }
    if (isWmoPrecipitationCode(current.weatherCode)) {
      rain = true
    }
  }
  return resolveAdvisoryKinds({ rain, strongWind: wind })
}

function advisoryHasRain(kinds: WeatherAdvisoryKind[]): boolean {
  return kinds.some((k) => k === "rain" || k === "rain_and_wind")
}

function advisoryHasWind(kinds: WeatherAdvisoryKind[]): boolean {
  return kinds.some((k) => k === "strong_wind" || k === "rain_and_wind")
}

/** If either today (live) or tomorrow triggers rain/wind, show merged tour advisories. */
export function advisoryKindsForTodayAndTomorrow(
  today: ForecastDayPayload,
  tomorrow: ForecastDayPayload | null,
  current: ForecastCurrentPayload
): WeatherAdvisoryKind[] {
  const todayKinds = advisoryKindsForSelectedDay(today, true, current)
  const tomorrowKinds = tomorrow ? advisoryKindsForSelectedDay(tomorrow, false, null) : []
  const rain = advisoryHasRain(todayKinds) || advisoryHasRain(tomorrowKinds)
  const wind = advisoryHasWind(todayKinds) || advisoryHasWind(tomorrowKinds)
  return resolveAdvisoryKinds({ rain, strongWind: wind })
}

export function buildForecastPayload(
  raw: OpenMeteoForecastJson,
  areaLabel: string,
  latitude: number,
  longitude: number
): ForecastApiPayload {
  const d = raw.daily
  const n = Math.min(2, d.time.length)

  const days: ForecastDayPayload[] = []
  for (let i = 0; i < n; i++) {
    const date = d.time[i]
    const code = d.weather_code[i]
    const popMax = d.precipitation_probability_max[i] ?? 0
    const precipSumMm = d.precipitation_sum[i] ?? 0
    const windMaxKmh = d.wind_speed_10m_max[i] ?? 0
    const gustMaxKmh = d.wind_gusts_10m_max[i] ?? windMaxKmh

    days.push({
      date,
      weekdayShort: weekdayShortSeoul(date),
      slotLabel: dayLabel(i, date),
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      weatherCode: code,
      conditionLabel: wmoWeatherLabel(code),
      popMax: Math.round(popMax),
      precipSumMm,
      windMaxKmh: Math.round(windMaxKmh),
      gustMaxKmh: Math.round(gustMaxKmh),
    })
  }

  const cur = raw.current

  return {
    areaLabel,
    latitude,
    longitude,
    source: "open-meteo",
    current: {
      tempC: Math.round(cur.temperature_2m),
      feelsLikeC: Math.round(cur.apparent_temperature),
      humidityPct: Math.round(cur.relative_humidity_2m),
      weatherCode: cur.weather_code,
      conditionLabel: wmoWeatherLabel(cur.weather_code),
      windKmh: Math.round(cur.wind_speed_10m),
      gustKmh: Math.round(cur.wind_gusts_10m ?? cur.wind_speed_10m),
    },
    days,
  }
}
