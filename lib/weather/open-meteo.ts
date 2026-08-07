/** Open-Meteo WMO weather interpretation (subset used for UI + advisories). */

/** Coarse condition buckets — the only granularity the UI needs. */
export type WmoCondition =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "rainShowers"
  | "snowShowers"
  | "thunderstorm"
  | "mixed"

export function wmoCondition(code: number): WmoCondition {
  if (code === 0) return "clear"
  if (code === 1) return "mainlyClear"
  if (code === 2) return "partlyCloudy"
  if (code === 3) return "overcast"
  if (code === 45 || code === 48) return "fog"
  if (code >= 51 && code <= 57) return "drizzle"
  if (code >= 61 && code <= 67) return "rain"
  if (code >= 71 && code <= 77) return "snow"
  if (code >= 80 && code <= 82) return "rainShowers"
  if (code === 85 || code === 86) return "snowShowers"
  if (code >= 95) return "thunderstorm"
  return "mixed"
}

/**
 * Condition wording per UI locale.
 *
 * This used to return English regardless of locale, so every non-English tour
 * page printed "Today · Mainly clear" inside an otherwise translated weather
 * card. Locales not listed here fall back to English, which is the old
 * behaviour rather than a blank.
 */
const WMO_LABELS: Record<string, Record<WmoCondition, string>> = {
  en: {
    clear: "Clear",
    mainlyClear: "Mainly clear",
    partlyCloudy: "Partly cloudy",
    overcast: "Overcast",
    fog: "Foggy",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    rainShowers: "Rain showers",
    snowShowers: "Snow showers",
    thunderstorm: "Thunderstorm",
    mixed: "Mixed conditions",
  },
  ko: {
    clear: "맑음",
    mainlyClear: "대체로 맑음",
    partlyCloudy: "구름 조금",
    overcast: "흐림",
    fog: "안개",
    drizzle: "이슬비",
    rain: "비",
    snow: "눈",
    rainShowers: "소나기",
    snowShowers: "소낙눈",
    thunderstorm: "천둥번개",
    mixed: "변화가 잦은 날씨",
  },
  ja: {
    clear: "晴れ",
    mainlyClear: "おおむね晴れ",
    partlyCloudy: "薄曇り",
    overcast: "曇り",
    fog: "霧",
    drizzle: "霧雨",
    rain: "雨",
    snow: "雪",
    rainShowers: "にわか雨",
    snowShowers: "にわか雪",
    thunderstorm: "雷雨",
    mixed: "変わりやすい天気",
  },
  zh: {
    clear: "晴",
    mainlyClear: "大致晴朗",
    partlyCloudy: "多云",
    overcast: "阴",
    fog: "雾",
    drizzle: "毛毛雨",
    rain: "雨",
    snow: "雪",
    rainShowers: "阵雨",
    snowShowers: "阵雪",
    thunderstorm: "雷阵雨",
    mixed: "天气多变",
  },
  "zh-tw": {
    clear: "晴",
    mainlyClear: "大致晴朗",
    partlyCloudy: "多雲",
    overcast: "陰",
    fog: "霧",
    drizzle: "毛毛雨",
    rain: "雨",
    snow: "雪",
    rainShowers: "陣雨",
    snowShowers: "陣雪",
    thunderstorm: "雷陣雨",
    mixed: "天氣多變",
  },
  es: {
    clear: "Despejado",
    mainlyClear: "Mayormente despejado",
    partlyCloudy: "Parcialmente nublado",
    overcast: "Nublado",
    fog: "Niebla",
    drizzle: "Llovizna",
    rain: "Lluvia",
    snow: "Nieve",
    rainShowers: "Chubascos",
    snowShowers: "Chubascos de nieve",
    thunderstorm: "Tormenta",
    mixed: "Tiempo variable",
  },
  fr: {
    clear: "Ciel dégagé",
    mainlyClear: "Plutôt dégagé",
    partlyCloudy: "Partiellement nuageux",
    overcast: "Couvert",
    fog: "Brouillard",
    drizzle: "Bruine",
    rain: "Pluie",
    snow: "Neige",
    rainShowers: "Averses",
    snowShowers: "Averses de neige",
    thunderstorm: "Orage",
    mixed: "Temps variable",
  },
  de: {
    clear: "Klar",
    mainlyClear: "Überwiegend klar",
    partlyCloudy: "Teils bewölkt",
    overcast: "Bedeckt",
    fog: "Nebel",
    drizzle: "Nieselregen",
    rain: "Regen",
    snow: "Schnee",
    rainShowers: "Regenschauer",
    snowShowers: "Schneeschauer",
    thunderstorm: "Gewitter",
    mixed: "Wechselhaft",
  },
  it: {
    clear: "Sereno",
    mainlyClear: "Prevalentemente sereno",
    partlyCloudy: "Parzialmente nuvoloso",
    overcast: "Coperto",
    fog: "Nebbia",
    drizzle: "Pioviggine",
    rain: "Pioggia",
    snow: "Neve",
    rainShowers: "Rovesci",
    snowShowers: "Rovesci di neve",
    thunderstorm: "Temporale",
    mixed: "Tempo variabile",
  },
  ru: {
    clear: "Ясно",
    mainlyClear: "Преимущественно ясно",
    partlyCloudy: "Переменная облачность",
    overcast: "Пасмурно",
    fog: "Туман",
    drizzle: "Морось",
    rain: "Дождь",
    snow: "Снег",
    rainShowers: "Ливень",
    snowShowers: "Снегопад",
    thunderstorm: "Гроза",
    mixed: "Переменная погода",
  },
}

export function wmoWeatherLabel(code: number, locale?: string | null): string {
  const cond = wmoCondition(code)
  let loc = (locale ?? "en").toLowerCase()
  if (loc === "zh-cn") loc = "zh"
  return (WMO_LABELS[loc] ?? WMO_LABELS.en)[cond]
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
