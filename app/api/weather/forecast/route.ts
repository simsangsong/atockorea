import { NextRequest, NextResponse } from "next/server"
import { getCmsContentOverridesFromDb } from "@/lib/cms-content.server"
import { defaultLocale, normalizeLocaleQueryParam, type Locale } from "@/lib/locale"
import {
  advisoryKindsForTodayAndTomorrow,
  buildForecastPayload,
} from "@/lib/weather/forecast-logic"
import type { OpenMeteoForecastJson } from "@/lib/weather/open-meteo"
import { resolveAdvisoryBlocksFromDb } from "@/lib/weather/resolve-advisory-copy"
import { WEATHER_ANCHOR_EAST_SEONGSAN } from "@/lib/weather/tour-weather-anchor"

const DEFAULT_LAT = WEATHER_ANCHOR_EAST_SEONGSAN.latitude
const DEFAULT_LON = WEATHER_ANCHOR_EAST_SEONGSAN.longitude
const DEFAULT_AREA = WEATHER_ANCHOR_EAST_SEONGSAN.areaLabel

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const lat = Number(sp.get("lat") ?? DEFAULT_LAT)
  const lon = Number(sp.get("lon") ?? DEFAULT_LON)
  const areaLabel = (sp.get("area") ?? DEFAULT_AREA).trim() || DEFAULT_AREA
  const locale: Locale = normalizeLocaleQueryParam(sp.get("locale")) ?? defaultLocale

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid lat or lon" }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 })
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m"
  )
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max"
  )
  url.searchParams.set("timezone", "Asia/Seoul")
  url.searchParams.set("forecast_days", "2")
  url.searchParams.set("windspeed_unit", "kmh")

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 900 } })
    if (!res.ok) {
      return NextResponse.json(
        { error: "Weather provider error", status: res.status },
        { status: 502 }
      )
    }
    const json = (await res.json()) as OpenMeteoForecastJson
    if (!json?.current || !json?.daily?.time?.length) {
      return NextResponse.json({ error: "Invalid forecast payload" }, { status: 502 })
    }
    const payload = buildForecastPayload(json, areaLabel, lat, lon)
    const today = payload.days[0]
    const tomorrow = payload.days[1] ?? null
    const kinds =
      today != null
        ? advisoryKindsForTodayAndTomorrow(today, tomorrow, payload.current)
        : []
    const overrides = await getCmsContentOverridesFromDb()
    const advisoryBlocks = resolveAdvisoryBlocksFromDb(kinds, overrides, locale)

    return NextResponse.json({ ...payload, advisoryBlocks }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
