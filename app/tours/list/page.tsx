'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TourListCard from '@/components/tour/TourListCard';
import { SearchSummaryBar } from '@/components/list/SearchSummaryBar';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { useCurrencyOptional } from '@/lib/currency';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';

const TOURS_LIMIT = 500;
type TourTypeFilter = 'all' | 'private' | 'join' | 'bus';
type SortFilter = 'popular' | 'newest' | 'rating' | 'sales' | 'priceAsc' | 'priceDesc';

export default function ToursListPage() {
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const currencyCtx = useCurrencyOptional();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tours, setTours] = useState<TourCardViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [destination, setDestination] = useState('all');
  const [tourType, setTourType] = useState<TourTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('popular');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const formatPrice = (priceKRW: number) => {
    if (currencyCtx) return currencyCtx.formatPrice(priceKRW);
    return `₩${Math.round(priceKRW).toLocaleString('ko-KR')}`;
  };

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const destinationFromUrl = searchParams.get('destination') || 'all';
    const typeFromUrl = (searchParams.get('type') as TourTypeFilter | null) || 'all';
    const sortFromUrl = (searchParams.get('sort') as SortFilter | null) || 'popular';
    const minFromUrl = searchParams.get('minPrice') || '';
    const maxFromUrl = searchParams.get('maxPrice') || '';

    setSearchInput(q);
    setDestination(destinationFromUrl);
    setTourType(typeFromUrl === 'private' || typeFromUrl === 'join' || typeFromUrl === 'bus' ? typeFromUrl : 'all');
    setSortBy(
      sortFromUrl === 'newest' ||
      sortFromUrl === 'rating' ||
      sortFromUrl === 'sales' ||
      sortFromUrl === 'priceAsc' ||
      sortFromUrl === 'priceDesc'
        ? sortFromUrl
        : 'popular'
    );
    setMinPrice(minFromUrl);
    setMaxPrice(maxFromUrl);
  }, [searchParams]);

  const apiSort = useMemo(() => {
    switch (sortBy) {
      case 'newest':
        return { sortKey: 'created_at', sortOrder: 'desc', useScoreSort: 'false' };
      case 'rating':
        return { sortKey: 'rating', sortOrder: 'desc', useScoreSort: 'false' };
      case 'priceAsc':
        return { sortKey: 'price', sortOrder: 'asc', useScoreSort: 'false' };
      case 'priceDesc':
        return { sortKey: 'price', sortOrder: 'desc', useScoreSort: 'false' };
      case 'sales':
        return { sortKey: 'bookings', sortOrder: 'desc', useScoreSort: 'false' };
      case 'popular':
      default:
        return { sortKey: 'created_at', sortOrder: 'desc', useScoreSort: 'true' };
    }
  }, [sortBy]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set('limit', String(TOURS_LIMIT));
    params.set('isActive', 'true');
    params.set('sortBy', apiSort.sortKey);
    params.set('sortOrder', apiSort.sortOrder);
    params.set('useScoreSort', apiSort.useScoreSort);
    params.set('locale', locale);
    if (searchInput.trim()) params.set('search', searchInput.trim());
    if (destination !== 'all') params.set('destinations', destination);
    if (tourType !== 'all') params.set('tourType', tourType);
    if (minPrice.trim()) params.set('minPrice', minPrice.trim());
    if (maxPrice.trim()) params.set('maxPrice', maxPrice.trim());

    fetch(`/api/tours?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        if (!mounted) return;
        const viewModels = adaptToursListResponse(data);
        setTours(viewModels);
      })
      .catch(() => {
        if (mounted) setError(t('toursList.loadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t, locale, apiSort, searchInput, destination, tourType, minPrice, maxPrice]);

  const applyFiltersToUrl = () => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('q', searchInput.trim());
    if (destination !== 'all') params.set('destination', destination);
    if (tourType !== 'all') params.set('type', tourType);
    if (sortBy !== 'popular') params.set('sort', sortBy);
    if (minPrice.trim()) params.set('minPrice', minPrice.trim());
    if (maxPrice.trim()) params.set('maxPrice', maxPrice.trim());
    const next = params.toString();
    router.replace(next ? `/tours/list?${next}` : '/tours/list');
  };

  const resetFilters = () => {
    setSearchInput('');
    setDestination('all');
    setTourType('all');
    setSortBy('popular');
    setMinPrice('');
    setMaxPrice('');
    router.replace('/tours/list');
  };

  const destinationOptions = useMemo(() => {
    const values = Array.from(new Set(tours.map((tour) => tour.city).filter(Boolean))).sort();
    return ['all', ...values];
  }, [tours]);

  const panelClass =
    'mx-auto w-[90%] max-w-3xl rounded-[1.75rem] border border-white/20 bg-white/55 px-4 py-10 text-center text-slate-600 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.18)] backdrop-blur-xl';

  return (
    <SitePageShell>
      <main className="pb-24">
        <section className="border-b border-white/25 bg-white/35 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-4 sm:pt-8 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {t('home.proposedTours.catalogTitle')}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{t('home.proposedTours.catalogSubtitle')}</p>
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/35 bg-white/70 p-3 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.25)] sm:grid-cols-2 lg:grid-cols-6">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('home.proposedTours.filterSearchPlaceholder')}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 lg:col-span-2"
              />
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">{t('home.proposedTours.filterRegionAll')}</option>
                {destinationOptions.filter((value) => value !== 'all').map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={tourType}
                onChange={(e) => setTourType(e.target.value as TourTypeFilter)}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">{t('home.proposedTours.filterTypeAll')}</option>
                <option value="join">{t('home.proposedTours.filterTypeJoin')}</option>
                <option value="private">{t('home.proposedTours.filterTypePrivate')}</option>
                <option value="bus">{t('home.proposedTours.filterTypeBus')}</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortFilter)}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="popular">{t('common.sort')} · 인기순</option>
                <option value="newest">{t('common.sort')} · 최신순</option>
                <option value="rating">{t('common.sort')} · 평점순</option>
                <option value="sales">{t('common.sort')} · 판매순</option>
                <option value="priceAsc">{t('common.sort')} · 가격 낮은순</option>
                <option value="priceDesc">{t('common.sort')} · 가격 높은순</option>
              </select>
              <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                <input
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Min"
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Max"
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
                <button
                  type="button"
                  onClick={applyFiltersToUrl}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {t('common.filter')}
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t('home.proposedTours.filterReset')}
                </button>
              </div>
            </div>
            {!loading && !error && (
              <div className="mt-3">
                <SearchSummaryBar
                  count={tours.length}
                  destination={destination === 'all' ? null : destination}
                  refineHref="/search"
                />
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
          {loading ? (
            <div className={panelClass}>
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-slate-800">{copy.listDetail.loadingTours}</p>
            </div>
          ) : error ? (
            <div className={`${panelClass} py-6`}>
              <p className="font-medium text-red-600">{error}</p>
            </div>
          ) : tours.length === 0 ? (
            <div className={panelClass}>
              <p className="font-medium text-slate-800">{copy.listDetail.noToursFound}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6">
              {tours.map((tour) => (
                <TourListCard
                  key={tour.id}
                  tour={tour}
                  detailHref={consumerTourDetailHref(tour.id)}
                  formatPriceFn={formatPrice}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </SitePageShell>
  );
}
