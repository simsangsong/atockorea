/**
 * B6 — tour-day weather line (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * Conservative default chosen for the overnight session (user asleep,
 * 2026-07-21): Open-Meteo — no API key, no billing, generous free tier. The
 * daily forecast becomes ONE localized line on the morning briefing with a
 * rule-based clothing hint (umbrella / warm layer / windbreaker). Zero-LLM:
 * numeric interpolation into 5-locale constants. Best-effort everywhere —
 * any failure simply omits the line.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

export interface DayWeather {
  tminC: number;
  tmaxC: number;
  /** Daily max precipitation probability, 0-100. */
  rainProbPct: number;
  /** Daily max wind speed, m/s. */
  windMaxMs: number;
}

/** Tour-city centroids (same match keys the overtime table uses). */
const CITY_COORDS: Array<{ match: RegExp; lat: number; lng: number }> = [
  { match: /jeju|제주/i, lat: 33.4996, lng: 126.5312 },
  { match: /busan|부산/i, lat: 35.1796, lng: 129.0756 },
  { match: /seoul|서울/i, lat: 37.5665, lng: 126.978 },
];

export function cityCoords(city?: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  for (const entry of CITY_COORDS) {
    if (entry.match.test(city)) return { lat: entry.lat, lng: entry.lng };
  }
  return null;
}

/** Open-Meteo daily forecast for one date (YYYY-MM-DD, KST). Never throws. */
export async function fetchDayWeather(
  coords: { lat: number; lng: number },
  date: string,
  fetcher: typeof fetch = fetch,
): Promise<DayWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
      `&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max` +
      `&wind_speed_unit=ms&timezone=Asia%2FSeoul&start_date=${date}&end_date=${date}`;
    const res = await fetcher(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        temperature_2m_min?: number[];
        temperature_2m_max?: number[];
        precipitation_probability_max?: Array<number | null>;
        wind_speed_10m_max?: number[];
      };
    };
    const d = json.daily;
    const tmin = d?.temperature_2m_min?.[0];
    const tmax = d?.temperature_2m_max?.[0];
    if (typeof tmin !== 'number' || typeof tmax !== 'number') return null;
    return {
      tminC: Math.round(tmin),
      tmaxC: Math.round(tmax),
      rainProbPct: Math.round(d?.precipitation_probability_max?.[0] ?? 0),
      windMaxMs: Math.round(d?.wind_speed_10m_max?.[0] ?? 0),
    };
  } catch {
    return null;
  }
}

const BASE_LINE: Record<RoomLocale, string> = {
  en: "🌤️ Today's weather: {tmin}–{tmax}°C, rain chance {rain}%.",
  ko: '🌤️ 오늘 날씨: {tmin}–{tmax}°C, 강수확률 {rain}%.',
  ja: '🌤️ 本日の天気：{tmin}–{tmax}°C、降水確率{rain}%。',
  es: '🌤️ El clima de hoy: {tmin}–{tmax}°C, prob. de lluvia {rain}%.',
  zh: '🌤️ 今日天气：{tmin}–{tmax}°C，降水概率{rain}%。',
};

const HINT_RAIN: Record<RoomLocale, string> = {
  en: 'Bring an umbrella.',
  ko: '우산을 챙겨주세요.',
  ja: '傘をお持ちください。',
  es: 'Lleva paraguas.',
  zh: '请携带雨伞。',
};
const HINT_COLD: Record<RoomLocale, string> = {
  en: 'A warm layer is recommended.',
  ko: '따뜻한 겉옷을 추천해요.',
  ja: '暖かい上着をおすすめします。',
  es: 'Se recomienda una capa de abrigo.',
  zh: '建议穿保暖外套。',
};
const HINT_WIND: Record<RoomLocale, string> = {
  en: 'It will be windy — a windbreaker helps.',
  ko: '바람이 강해요 — 바람막이가 좋아요.',
  ja: '風が強いです — ウインドブレーカーがあると安心です。',
  es: 'Habrá viento: una cortavientos ayuda.',
  zh: '风较大 — 建议穿防风衣。',
};

/** Rule-based clothing hint (rain > cold > wind; one hint max, keep it calm). */
function hintFor(weather: DayWeather, locale: RoomLocale): string | null {
  if (weather.rainProbPct >= 50) return HINT_RAIN[locale];
  if (weather.tmaxC <= 10) return HINT_COLD[locale];
  if (weather.windMaxMs >= 10) return HINT_WIND[locale];
  return null;
}

/** The 5-locale weather line map (append to the morning briefing). */
export function renderWeatherLines(weather: DayWeather): Record<string, string> {
  const lines: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    const base = BASE_LINE[locale]
      .replaceAll('{tmin}', String(weather.tminC))
      .replaceAll('{tmax}', String(weather.tmaxC))
      .replaceAll('{rain}', String(weather.rainProbPct));
    const hint = hintFor(weather, locale);
    lines[locale] = hint ? `${base} ${hint}` : base;
  }
  return lines;
}
