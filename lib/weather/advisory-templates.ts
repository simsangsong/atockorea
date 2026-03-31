export type WeatherAdvisoryKind = "rain" | "strong_wind" | "rain_and_wind"

export const WEATHER_ADVISORY_COPY: Record<
  WeatherAdvisoryKind,
  { title: string; body: string }
> = {
  rain: {
    title: "Rain in the forecast",
    body:
      "We usually run with weather-aware route tweaks. Pack a compact umbrella or rain shell; non-slip shoes help on wet paths. If conditions become unsafe, we’ll adjust stops or timing and keep you posted.",
  },
  strong_wind: {
    title: "Strong winds possible",
    body:
      "Coastal and viewpoint stops can feel much windier than the temperature suggests. A secure hat, light windproof layer, and grippy shoes make a big difference. Your guide may shorten exposed segments if gusts are high.",
  },
  rain_and_wind: {
    title: "Wet & windy conditions",
    body:
      "Expect cooler feels-like temperatures in wind and rain. Waterproof outer layer, hood, and layers you can adjust are ideal. We’ll favor sheltered alternatives where it improves comfort without losing the core route.",
  },
}

export function resolveAdvisoryKinds(flags: { rain: boolean; strongWind: boolean }): WeatherAdvisoryKind[] {
  if (flags.rain && flags.strongWind) return ["rain_and_wind"]
  if (flags.rain) return ["rain"]
  if (flags.strongWind) return ["strong_wind"]
  return []
}
