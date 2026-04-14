import {
  WEATHER_ANCHOR_EAST_SEONGSAN,
  resolveTourWeatherAnchor,
} from '@/lib/weather/tour-weather-anchor';
import type { TourDetailViewModel } from '@/src/types/tours';

export type EastDetailWeatherCoords = {
  latitude: number;
  longitude: number;
  areaLabel: string;
};

/** Resolves lat/lon + default area label for forecast (same inputs as legacy template). */
export function resolveEastDetailWeatherCoords(
  tour: Pick<TourDetailViewModel, 'slug' | 'city'>
): EastDetailWeatherCoords {
  const a = resolveTourWeatherAnchor({ slug: tour.slug, city: tour.city });
  return {
    latitude: a.latitude,
    longitude: a.longitude,
    areaLabel: a.areaLabel,
  };
}

/**
 * KO: 좌표가 동쪽 앵커면 “제주 동쪽 지역” (성산일출봉 단일 명칭 노출 방지).
 */
export function weatherForecastAreaLabelForLocale(
  resolved: EastDetailWeatherCoords,
  locale: string
): string {
  if (locale === 'ko') {
    const nearEastSeongsan =
      Math.abs(resolved.latitude - WEATHER_ANCHOR_EAST_SEONGSAN.latitude) < 0.02 &&
      Math.abs(resolved.longitude - WEATHER_ANCHOR_EAST_SEONGSAN.longitude) < 0.02;
    if (nearEastSeongsan) return '제주 동쪽 지역';
  }
  return resolved.areaLabel;
}
