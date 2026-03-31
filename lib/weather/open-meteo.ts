/** Open-Meteo WMO weather interpretation (subset used for UI + advisories). */

export function wmoWeatherLabel(code: number): string {
  if (code === 0) return "Clear"
  if (code === 1) return "Mainly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Foggy"
  if (code >= 51 && code <= 57) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code === 85 || code === 86) return "Snow showers"
  if (code >= 95) return "Thunderstorm"
  return "Mixed conditions"
}

export function isWmoPrecipitationCode(code: number): boolean {
  if (code >= 51 && code <= 67) return true
  if (code >= 80 && code <= 82) return true
  if (code >= 95) return true
  return false
}

export type OpenMeteoDaily = {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
  precipitation_sum: number[]
  wind_speed_10m_max: number[]
  wind_gusts_10m_max: number[]
}

export type OpenMeteoCurrent = {
  temperature_2m: number
  relative_humidity_2m: number
  apparent_temperature: number
  weather_code: number
  wind_speed_10m: number
  wind_gusts_10m: number
}

export type OpenMeteoForecastJson = {
  current: OpenMeteoCurrent
  daily: OpenMeteoDaily
}
