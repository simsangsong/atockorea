'use client';

import { useMemo } from 'react';
import type { TourDetailViewModel } from '@/src/types/tours';
import {
  resolveEastDetailWeatherCoords,
  weatherForecastAreaLabelForLocale,
  type EastDetailWeatherCoords,
} from '@/lib/tour-detail/east/services/weather-presentation';

export type EastDetailWeatherPresentation = EastDetailWeatherCoords & {
  forecastAreaLabel: string;
};

/**
 * Same memo keys as legacy: `tour.slug`, `tour.city`, `locale`.
 */
export function useEastDetailWeatherPresentation(
  tour: Pick<TourDetailViewModel, 'slug' | 'city'>,
  locale: string
): EastDetailWeatherPresentation {
  return useMemo(() => {
    const coords = resolveEastDetailWeatherCoords(tour);
    return {
      ...coords,
      forecastAreaLabel: weatherForecastAreaLabelForLocale(coords, locale),
    };
  }, [tour.slug, tour.city, locale]);
}
