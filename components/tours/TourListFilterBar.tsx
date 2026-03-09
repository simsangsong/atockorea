'use client';

import { useTranslations } from '@/lib/i18n';

export type TourTypeFilter = 'all' | 'bus' | 'private' | 'cruise';

export interface TourListFilterState {
  destination: string;
  tourType: TourTypeFilter;
  priceMin: number;
  priceMax: number;
  duration: string;
}

const DEFAULT_PRICE_MAX = 500;

interface TourListFilterBarProps {
  destinations: string[];
  filters: TourListFilterState;
  onFiltersChange: (f: TourListFilterState) => void;
  priceRangeBounds: [number, number];
}

const TOUR_TYPE_KEYS: TourTypeFilter[] = ['all', 'bus', 'private', 'cruise'];

const DURATION_OPTIONS = [
  { value: '', labelKey: 'tour.filters.all' },
  { value: 'half', labelKey: 'tour.filters.halfDay' },
  { value: 'full', labelKey: 'tour.filters.fullDay' },
  { value: '2-3', labelKey: 'tour.filters.hours2to3' },
  { value: '4', labelKey: 'tour.filters.hours4' },
  { value: 'day', labelKey: 'tour.filters.multiDay' },
];

function matchDuration(durationText: string, filterValue: string): boolean {
  if (!filterValue) return true;
  const d = durationText.toLowerCase();
  if (filterValue === 'half') return /half|1\s*h|2\s*h|3\s*h|morning|afternoon/i.test(d);
  if (filterValue === 'full') return /full|8\s*h|9\s*h|10\s*h|day\s*tour/i.test(d);
  if (filterValue === '2-3') return /2\s*h|3\s*h|2-3|2\.5/i.test(d);
  if (filterValue === '4') return /4\s*h|4h/i.test(d);
  if (filterValue === 'day') return /day|2\s*day|3\s*day|multi/i.test(d);
  return true;
}

export function filterToursByState<T extends {
  city: string;
  price: number;
  duration: string;
  badges?: string[];
}>(
  tours: T[],
  filters: TourListFilterState,
  priceBounds: [number, number]
): T[] {
  const maxPrice = priceBounds[1] || DEFAULT_PRICE_MAX;
  const minPrice = filters.priceMin ?? 0;
  const maxP = filters.priceMax ?? maxPrice;

  return tours.filter((tour) => {
    if (filters.destination && filters.destination !== 'all') {
      if (tour.city !== filters.destination) return false;
    }
    if (filters.tourType && filters.tourType !== 'all') {
      const badges = (tour.badges || []).map((b) => String(b).toLowerCase());
      if (filters.tourType === 'bus' && !badges.some((b) => b.includes('bus'))) return false;
      if (filters.tourType === 'private' && !badges.some((b) => b.includes('private'))) return false;
      if (filters.tourType === 'cruise' && !badges.some((b) => b.includes('cruise') || b.includes('shore'))) return false;
    }
    const priceKRW = Number(tour.price) || 0;
    const priceInThousands = priceKRW / 1000;
    if (priceInThousands < minPrice || priceInThousands > maxP) return false;
    if (filters.duration && !matchDuration(tour.duration || '', filters.duration)) return false;
    return true;
  });
}

export default function TourListFilterBar({
  destinations,
  filters,
  onFiltersChange,
  priceRangeBounds,
}: TourListFilterBarProps) {
  const t = useTranslations();
  const [minBound, maxBound] = priceRangeBounds;
  const effectiveMax = maxBound || DEFAULT_PRICE_MAX;

  const update = (patch: Partial<TourListFilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm p-4 mb-6">
      {/* Destination */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('tour.filters.destination')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ destination: 'all' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
              filters.destination === 'all' || !filters.destination
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('tour.filters.all')}
          </button>
          {destinations.filter(Boolean).map((dest) => (
            <button
              key={dest}
              type="button"
              onClick={() => update({ destination: dest })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                filters.destination === dest ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dest}
            </button>
          ))}
        </div>
      </div>

      {/* Tour type */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('tour.filters.tourType')}
        </p>
        <div className="flex flex-wrap gap-2">
          {TOUR_TYPE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ tourType: key })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                filters.tourType === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {key === 'all' ? t('tour.filters.all') : t(`tour.filters.${key}Tours`)}
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('tour.filters.priceRange')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-price-min" className="text-sm text-gray-600 sr-only sm:not-sr-only">
              {t('tour.filters.minPrice')}
            </label>
            <input
              id="filter-price-min"
              type="number"
              min={0}
              max={effectiveMax}
              value={filters.priceMin ?? 0}
              onChange={(e) => update({ priceMin: Math.max(0, Number(e.target.value) || 0) })}
              className="w-20 sm:w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <span className="text-gray-400">–</span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-price-max" className="text-sm text-gray-600 sr-only sm:not-sr-only">
              {t('tour.filters.maxPrice')}
            </label>
            <input
              id="filter-price-max"
              type="number"
              min={minBound}
              max={effectiveMax}
              value={filters.priceMax ?? effectiveMax}
              onChange={(e) => update({ priceMax: Math.min(effectiveMax, Math.max(0, Number(e.target.value) || effectiveMax)) })}
              className="w-20 sm:w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <span className="text-sm text-gray-500">(×1000 ₩)</span>
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('tour.filters.duration')}
        </p>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => update({ duration: opt.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                (filters.duration || '') === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() =>
            onFiltersChange({
              destination: 'all',
              tourType: 'all',
              priceMin: 0,
              priceMax: effectiveMax,
              duration: '',
            })
          }
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {t('tour.filters.clearAll')}
        </button>
      </div>
    </div>
  );
}
