'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TourListCard from '@/components/tour/TourListCard';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { CURRENCY_LIST, useCurrencyOptional, type CurrencyCode } from '@/lib/currency';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { CatalogueHero } from '@/components/tours-list/CatalogueHero';
import { CatalogueFooterStrip } from '@/components/tours-list/CatalogueFooterStrip';
import { SortSegmented } from '@/components/tours-list/SortSegmented';
import { DestinationPillSelect } from '@/components/tours-list/DestinationPillSelect';
import { ActiveFilterStrip, type ActiveFilterChip } from '@/components/tours-list/ActiveFilterStrip';
import {
  LIST_FIELD_CLS,
  LIST_SELECT_CLS,
  LIST_CHIP_ACTIVE_CLS,
  LIST_CHIP_INACTIVE_CLS,
  LIST_RAIL_BG,
  LIST_RAIL_BORDER,
  LIST_SHADOW_WARM,
} from '@/lib/tours-list-tokens';

const TOURS_LIMIT = 500;
/** Client-side virtual pagination: render a first page, then stream more as the
 *  user scrolls. Keeps network to a single request while reducing initial DOM. */
const INITIAL_PAGE_SIZE = 24;
const PAGE_STEP = 24;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_KRW_RATE = 1480;

type TourTypeFilter = 'all' | 'private' | 'join' | 'bus';
type SortFilter = 'popular' | 'newest' | 'rating' | 'sales' | 'priceAsc' | 'priceDesc';
type DestinationOption = { city: string; count: number };

function isTourTypeFilter(value: string): value is TourTypeFilter {
  return value === 'all' || value === 'private' || value === 'join' || value === 'bus';
}

function isSortFilter(value: string): value is SortFilter {
  return (
    value === 'popular' ||
    value === 'newest' ||
    value === 'rating' ||
    value === 'sales' ||
    value === 'priceAsc' ||
    value === 'priceDesc'
  );
}

function readSortFilter(params: URLSearchParams): SortFilter {
  const sort = params.get('sort');
  if (sort && isSortFilter(sort)) return sort;

  const sortBy = params.get('sortBy');
  const sortOrder = params.get('sortOrder') ?? 'desc';
  const useScoreSort = params.get('useScoreSort');
  if (sortBy === 'rating') return 'rating';
  if (sortBy === 'bookings') return 'sales';
  if (sortBy === 'price') return sortOrder === 'asc' ? 'priceAsc' : 'priceDesc';
  if (sortBy === 'created_at' && useScoreSort === 'false') return 'newest';
  return 'popular';
}

function getCurrencySymbol(code: string): string {
  return CURRENCY_LIST.find((c) => c.code === code)?.symbol ?? '$';
}

/**
 * Convert a value typed in the user's *display* currency to USD (the unit the API
 * expects via `minPriceUsd`/`maxPriceUsd`). Keeps the price filter honest across
 * currency switches.
 */
function displayToUsd(
  value: number,
  currency: CurrencyCode,
  rates: Record<string, number> | null,
  krwRate: number,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (currency === 'USD') return value;
  if (currency === 'KRW') return value / (krwRate || DEFAULT_KRW_RATE);
  const r = rates?.[currency];
  return r && r > 0 ? value / r : value;
}

function translateCity(city: string, tFn: (key: string) => string): string {
  const n = city.trim().toLowerCase();
  if (n === 'seoul' || n === '서울') return tFn('home.hero.destinations.seoul');
  if (n === 'busan' || n === '부산') return tFn('home.hero.destinations.busan');
  if (n === 'jeju' || n === '제주') return tFn('home.hero.destinations.jeju');
  return city;
}

/** Numeric display for chip labels (no decimals, locale-neutral grouping). */
function formatTypedAmount(raw: string, symbol: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return `${symbol}${raw}`;
  return `${symbol}${Math.round(n).toLocaleString('en-US')}`;
}

export default function ToursListPage() {
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const currencyCtx = useCurrencyOptional();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currencyCode: CurrencyCode = (currencyCtx?.currency ?? 'USD') as CurrencyCode;
  const rates = currencyCtx?.rates ?? null;
  const krwRate = rates?.KRW ?? DEFAULT_KRW_RATE;
  const currencySymbol = getCurrencySymbol(currencyCode);

  /**
   * `useTranslations()` returns a fresh function reference every render, so we must
   * NOT include `t` in stateful effect deps (caused an abort/refetch loop that
   * pinned `loading=true` forever). Primitive strings are stable by value in React
   * deps; pull translation labels used inside effects out here.
   */
  const loadFailedLabel = t('toursList.loadFailed');

  const [tours, setTours] = useState<TourCardViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  /** Raw input (synchronous with keystrokes) — for the search box visual state. */
  const [searchInput, setSearchInput] = useState('');
  /** Debounced value — drives fetch & URL. */
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [destination, setDestination] = useState('all');
  const [tourType, setTourType] = useState<TourTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('popular');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [features, setFeatures] = useState('');
  const [showPricePanel, setShowPricePanel] = useState(false);

  const priceAnchorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([]);

  const formatPrice = useCallback(
    (priceUsd: number) => {
      if (currencyCtx) return currencyCtx.formatPrice(priceUsd);
      return `₩${Math.round(priceUsd).toLocaleString('ko-KR')}`;
    },
    [currencyCtx],
  );

  // --- URL → state (handles first mount and back/forward navigation) --------------------
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const destinationFromUrl =
      searchParams.get('destination') || searchParams.get('destinations') || 'all';
    const typeRaw = searchParams.get('type') || searchParams.get('tourType') || 'all';
    const typeFromUrl: TourTypeFilter = isTourTypeFilter(typeRaw) ? typeRaw : 'all';
    const sortFromUrl = readSortFilter(searchParams);
    const minFromUrl = searchParams.get('minPrice') || '';
    const maxFromUrl = searchParams.get('maxPrice') || '';
    const featuresFromUrl = searchParams.get('features') || '';

    setSearchInput(q);
    setDebouncedSearch(q);
    setDestination(destinationFromUrl);
    setTourType(typeFromUrl);
    setSortBy(sortFromUrl);
    setMinPrice(minFromUrl);
    setMaxPrice(maxFromUrl);
    setFeatures(featuresFromUrl);
  }, [searchParams]);

  // --- Debounce search input ------------------------------------------------------------
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // --- Destination master list (fetched once, independent of current filters) ----------
  useEffect(() => {
    let mounted = true;
    fetch('/api/tours/destinations')
      .then((res) => (res.ok ? res.json() : { destinations: [] }))
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data?.destinations)
          ? (data.destinations as DestinationOption[])
          : [];
        setDestinationOptions(list);
      })
      .catch(() => {
        if (mounted) setDestinationOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  // --- Fetch tours (AbortController cancels stale requests) ----------------------------
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set('limit', String(TOURS_LIMIT));
    params.set('compact', '1');
    params.set('isActive', 'true');
    params.set('sortBy', apiSort.sortKey);
    params.set('sortOrder', apiSort.sortOrder);
    params.set('useScoreSort', apiSort.useScoreSort);
    params.set('locale', locale);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (destination !== 'all') params.set('destinations', destination);
    if (tourType !== 'all') params.set('tourType', tourType);
    if (features.trim()) params.set('features', features.trim());

    const minNum = parseFloat(minPrice);
    const maxNum = parseFloat(maxPrice);
    if (Number.isFinite(minNum) && minNum > 0) {
      params.set('minPriceUsd', String(displayToUsd(minNum, currencyCode, rates, krwRate)));
    }
    if (Number.isFinite(maxNum) && maxNum > 0) {
      params.set('maxPriceUsd', String(displayToUsd(maxNum, currencyCode, rates, krwRate)));
    }

    setLoading(true);
    setError(null);
    setVisibleCount(INITIAL_PAGE_SIZE);

    fetch(`/api/tours?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        if (controller.signal.aborted) return;
        setTours(adaptToursListResponse(data));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err && (err.name === 'AbortError' || err.code === 20)) return;
        setError(loadFailedLabel);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
    // `t` intentionally omitted — see `loadFailedLabel` note above. `rates` is read
    // for non-USD/KRW conversion; we track the primitive `krwRate` instead so the
    // effect doesn't thrash on every exchange-rate object refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadFailedLabel,
    locale,
    apiSort,
    debouncedSearch,
    destination,
    tourType,
    features,
    minPrice,
    maxPrice,
    currencyCode,
    krwRate,
  ]);

  // --- URL push (explicit / on-change only; NOT tied to debounced search typing) --------
  const buildUrl = useCallback(
    (
      overrides: {
        q?: string;
        destination?: string;
        type?: TourTypeFilter;
        sort?: SortFilter;
        minPrice?: string;
        maxPrice?: string;
        features?: string;
      } = {},
    ) => {
      const q = 'q' in overrides ? overrides.q ?? '' : debouncedSearch;
      const dest = 'destination' in overrides ? overrides.destination ?? 'all' : destination;
      const ty = 'type' in overrides ? overrides.type ?? 'all' : tourType;
      const so = 'sort' in overrides ? overrides.sort ?? 'popular' : sortBy;
      const mn = 'minPrice' in overrides ? overrides.minPrice ?? '' : minPrice.trim();
      const mx = 'maxPrice' in overrides ? overrides.maxPrice ?? '' : maxPrice.trim();
      const ft = 'features' in overrides ? overrides.features ?? '' : features.trim();

      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (dest !== 'all') p.set('destination', dest);
      if (ty !== 'all') p.set('type', ty);
      if (so !== 'popular') p.set('sort', so);
      if (mn) p.set('minPrice', mn);
      if (mx) p.set('maxPrice', mx);
      if (ft) p.set('features', ft);
      const next = p.toString();
      return next ? `/tours/list?${next}` : '/tours/list';
    },
    [debouncedSearch, destination, tourType, sortBy, minPrice, maxPrice, features],
  );

  const push = useCallback(
    (overrides?: Parameters<typeof buildUrl>[0]) => {
      router.replace(buildUrl(overrides));
    },
    [router, buildUrl],
  );

  const resetFilters = useCallback(() => {
    abortRef.current?.abort();
    setSearchInput('');
    setDebouncedSearch('');
    setDestination('all');
    setTourType('all');
    setSortBy('popular');
    setMinPrice('');
    setMaxPrice('');
    setFeatures('');
    setShowPricePanel(false);
    router.replace('/tours/list');
  }, [router]);

  // --- Price panel: outside click + ESC ------------------------------------------------
  useEffect(() => {
    if (!showPricePanel) return;
    const onPointerDown = (e: PointerEvent) => {
      const anchor = priceAnchorRef.current;
      if (!anchor || anchor.contains(e.target as Node)) return;
      setShowPricePanel(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPricePanel(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPricePanel]);

  // --- Infinite scroll sentinel --------------------------------------------------------
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= tours.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((n) => Math.min(n + PAGE_STEP, tours.length));
            break;
          }
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tours.length, visibleCount]);

  // --- Derived options -----------------------------------------------------------------
  const tourTypeOptions: { value: TourTypeFilter; label: string }[] = useMemo(
    () => [
      { value: 'all', label: t('home.proposedTours.filterTypeAll') },
      { value: 'join', label: t('home.proposedTours.filterTypeJoin') },
      { value: 'private', label: t('home.proposedTours.filterTypePrivate') },
      { value: 'bus', label: t('home.proposedTours.filterTypeBus') },
    ],
    [t],
  );

  const sortOptions: { value: SortFilter; label: string }[] = useMemo(
    () => [
      { value: 'popular', label: t('home.proposedTours.sortPopular') },
      { value: 'newest', label: t('home.proposedTours.sortNewest') },
      { value: 'rating', label: t('home.proposedTours.sortRating') },
      { value: 'sales', label: t('home.proposedTours.sortSales') },
      { value: 'priceAsc', label: t('home.proposedTours.sortPriceAsc') },
      { value: 'priceDesc', label: t('home.proposedTours.sortPriceDesc') },
    ],
    [t],
  );

  const hasActiveFilters =
    searchInput.trim() !== '' ||
    destination !== 'all' ||
    tourType !== 'all' ||
    sortBy !== 'popular' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    features.trim() !== '';
  const hasPriceFilter = minPrice !== '' || maxPrice !== '';

  const priceChipLabel = useMemo(() => {
    if (!hasPriceFilter) return t('toursList.price');
    const mn = minPrice.trim();
    const mx = maxPrice.trim();
    const mnFmt = mn ? formatTypedAmount(mn, currencySymbol) : '';
    const mxFmt = mx ? formatTypedAmount(mx, currencySymbol) : '';
    if (mnFmt && mxFmt) return t('toursList.priceRange', { min: mnFmt, max: mxFmt });
    if (mnFmt) return t('toursList.priceFrom', { amount: mnFmt });
    if (mxFmt) return t('toursList.priceUpTo', { amount: mxFmt });
    return t('toursList.price');
  }, [hasPriceFilter, minPrice, maxPrice, currencySymbol, t]);

  // Active-filter chips (Phase 2.8 / B5) — one dismissible chip per applied
  // filter; each removes only itself + syncs the URL. Sort is excluded (it's a
  // view preference, not a filter that narrows results).
  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (searchInput.trim() !== '') {
      chips.push({
        key: 'search',
        label: `"${searchInput.trim()}"`,
        onRemove: () => {
          setSearchInput('');
          setDebouncedSearch('');
          push({ q: '' });
        },
      });
    }
    if (destination !== 'all') {
      chips.push({
        key: 'destination',
        label: translateCity(destination, t),
        onRemove: () => {
          setDestination('all');
          push({ destination: 'all' });
        },
      });
    }
    if (tourType !== 'all') {
      const label = tourTypeOptions.find((o) => o.value === tourType)?.label ?? tourType;
      chips.push({
        key: 'type',
        label,
        onRemove: () => {
          setTourType('all');
          push({ type: 'all' });
        },
      });
    }
    if (hasPriceFilter) {
      chips.push({
        key: 'price',
        label: priceChipLabel,
        onRemove: () => {
          setMinPrice('');
          setMaxPrice('');
          push({ minPrice: '', maxPrice: '' });
        },
      });
    }
    if (features.trim() !== '') {
      chips.push({
        key: 'features',
        label: features.trim(),
        onRemove: () => {
          setFeatures('');
          push({ features: '' });
        },
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, destination, tourType, hasPriceFilter, priceChipLabel, features, tourTypeOptions, t]);

  const panelClass =
    'home-panel-refinement mx-auto w-full max-w-3xl px-5 py-10 text-center text-slate-600';

  /**
   * Filter field / select / chip styles — Phase 2 (B4 + B1): h-11 + text-[13.5px]
   * + amber-200/70 borders, sourced from lib/tours-list-tokens. The slate-200/
   * slate-900 form-tool tone is gone (B1 enforcement). Chip variants append the
   * height + shrink utilities the rail layout needs on top of the token base.
   */
  const fieldCls = LIST_FIELD_CLS;
  const selectCls = LIST_SELECT_CLS;

  const chipCls = (active: boolean) =>
    `${active ? LIST_CHIP_ACTIVE_CLS : LIST_CHIP_INACTIVE_CLS} h-9 !min-h-0 !min-w-0 shrink-0`;

  const visibleTours = tours.slice(0, visibleCount);
  const isInitialLoading = loading && tours.length === 0;
  const isRefetching = loading && tours.length > 0;

  return (
    <SitePageShell>
      {/* B32: site-native — neutral white veil over the page's pastel mesh
          (body::before), NOT a solid ivory that covers it. bg-white/55 keeps
          the mesh faintly visible so list matches every other consumer page. */}
      <main className="bg-white/55 pb-24">
        {/*
          Sticky header stack — Catalogue Hero (Phase 1) + filter rail share a
          single sticky context so the hero's 240→88 collapse (driven by
          useScroll inside CatalogueHero) does not collide with the rail's
          natural position. Phase 2 will reskin the filter rail; the wrapper
          stays.
        */}
        <div className="sticky top-0 z-30 isolate">
          <CatalogueHero />

          {/* Filter bar — Phase 2 ivory+amber rail (B1/B4). */}
          <div className={`relative ${LIST_RAIL_BG} ${LIST_RAIL_BORDER} ${LIST_SHADOW_WARM}`}>
            <div className="mx-auto max-w-5xl px-3 sm:px-4">
            {/* Desktop: single row */}
            <div className="hidden h-[64px] items-center gap-2.5 lg:flex">
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">
                  {t('toursList.eyebrow')}
                </span>
              </div>

              <div className="mx-1 h-4 w-px shrink-0 bg-slate-200/70" />

              {/* Search with leading magnifier icon (Phase 2.3). */}
              <div className="relative min-w-0 flex-1">
                <svg
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') push({ q: e.currentTarget.value.trim() });
                  }}
                  placeholder={t('home.proposedTours.filterSearchPlaceholder')}
                  aria-label={t('toursList.searchAriaLabel')}
                  className={`${fieldCls} w-full !pl-10`}
                />
              </div>

              <DestinationPillSelect
                value={destination}
                options={destinationOptions.map(({ city }) => ({
                  value: city,
                  label: translateCity(city, t),
                }))}
                onChange={(v) => {
                  setDestination(v);
                  push({ destination: v });
                }}
                ariaLabel={t('toursList.destinationAriaLabel')}
                allLabel={t('home.proposedTours.filterRegionAll')}
              />

              <SortSegmented
                value={sortBy}
                options={sortOptions}
                onChange={(v) => {
                  setSortBy(v);
                  push({ sort: v });
                }}
                ariaLabel={t('toursList.sortAriaLabel')}
                activeTitle={sortBy === 'popular' ? t('toursList.popularHint') : undefined}
              />

              {/* Refetch indicator (Phase 2.10) — spinning dot, no layout shift. */}
              {isRefetching ? (
                <span
                  className="h-2 w-2 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
                  aria-hidden
                />
              ) : null}

              <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200/70" />

              <div className="flex shrink-0 items-center gap-1">
                {tourTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={tourType === opt.value}
                    onClick={() => {
                      setTourType(opt.value);
                      push({ type: opt.value });
                    }}
                    className={chipCls(tourType === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200/70" />

              <div className="relative shrink-0" ref={priceAnchorRef}>
                <button
                  type="button"
                  onClick={() => setShowPricePanel((v) => !v)}
                  aria-label={t('toursList.priceAriaLabel')}
                  aria-expanded={showPricePanel}
                  className={chipCls(hasPriceFilter)}
                >
                  {priceChipLabel}
                </button>
                {showPricePanel ? (
                  <div
                    role="dialog"
                    aria-label={t('toursList.priceAriaLabel')}
                    className="absolute right-0 top-[calc(100%+8px)] z-40 flex items-center gap-2 rounded-2xl border border-white/85 bg-white/95 p-3 shadow-[0_24px_56px_-22px_rgba(15,23,42,0.36)] backdrop-blur-md"
                  >
                    <input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          push({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
                          setShowPricePanel(false);
                        }
                      }}
                      placeholder={`${t('toursList.minPlaceholder')} (${currencySymbol})`}
                      aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.minPlaceholder')}`}
                      className={`${fieldCls} w-24`}
                      inputMode="decimal"
                    />
                    <span className="text-[11px] text-slate-400" aria-hidden>
                      —
                    </span>
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          push({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
                          setShowPricePanel(false);
                        }
                      }}
                      placeholder={`${t('toursList.maxPlaceholder')} (${currencySymbol})`}
                      aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.maxPlaceholder')}`}
                      className={`${fieldCls} w-24`}
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        push({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
                        setShowPricePanel(false);
                      }}
                      className="inline-flex h-7 !min-h-0 !min-w-0 items-center rounded-xl bg-slate-900 px-3 text-[11px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {t('toursList.apply')}
                    </button>
                  </div>
                ) : null}
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  aria-label={t('toursList.resetFilters')}
                  className="inline-flex h-9 w-9 !min-h-0 !min-w-0 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Mobile: 3 rows */}
            <div className="lg:hidden">
              <div className="flex items-center gap-2 pt-2.5 pb-1.5">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') push({ q: e.currentTarget.value.trim() });
                  }}
                  placeholder={t('home.proposedTours.filterSearchPlaceholder')}
                  aria-label={t('toursList.searchAriaLabel')}
                  className={`${fieldCls} min-w-0 flex-1`}
                />
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    aria-label={t('toursList.resetFilters')}
                    className="inline-flex h-11 w-11 !min-h-0 !min-w-0 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-500 transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1 py-1">
                {tourTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={tourType === opt.value}
                    onClick={() => {
                      setTourType(opt.value);
                      push({ type: opt.value });
                    }}
                    className={`inline-flex h-9 !min-h-0 !min-w-0 flex-1 items-center justify-center rounded-full px-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      tourType === opt.value
                        ? 'bg-slate-900 text-white shadow-[0_2px_8px_-3px_rgba(15,23,42,0.4)]'
                        : 'border border-slate-200/80 bg-white/85 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pb-2 pt-1">
                <select
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    push({ destination: e.target.value });
                  }}
                  aria-label={t('toursList.destinationAriaLabel')}
                  className={`${selectCls} min-w-0 flex-1`}
                >
                  <option value="all">{t('home.proposedTours.filterRegionAll')}</option>
                  {destinationOptions.map(({ city }) => (
                    <option key={city} value={city}>
                      {translateCity(city, t)}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortFilter);
                    push({ sort: e.target.value as SortFilter });
                  }}
                  aria-label={t('toursList.sortAriaLabel')}
                  className={`${selectCls} min-w-0 flex-1`}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile price row */}
              <div className="relative flex gap-2 pb-2.5 pt-0.5" ref={priceAnchorRef}>
                <button
                  type="button"
                  onClick={() => setShowPricePanel((v) => !v)}
                  aria-label={t('toursList.priceAriaLabel')}
                  aria-expanded={showPricePanel}
                  className={`${chipCls(hasPriceFilter)} flex-1 justify-center`}
                >
                  {priceChipLabel}
                </button>
                {showPricePanel ? (
                  <div
                    role="dialog"
                    aria-label={t('toursList.priceAriaLabel')}
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 flex items-center gap-2 rounded-2xl border border-white/85 bg-white/95 p-3 shadow-[0_24px_56px_-22px_rgba(15,23,42,0.36)] backdrop-blur-md"
                  >
                    <input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder={`${t('toursList.minPlaceholder')} (${currencySymbol})`}
                      aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.minPlaceholder')}`}
                      className={`${fieldCls} min-w-0 flex-1`}
                      inputMode="decimal"
                    />
                    <span className="text-[11px] text-slate-400" aria-hidden>
                      —
                    </span>
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder={`${t('toursList.maxPlaceholder')} (${currencySymbol})`}
                      aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.maxPlaceholder')}`}
                      className={`${fieldCls} min-w-0 flex-1`}
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        push({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
                        setShowPricePanel(false);
                      }}
                      className="inline-flex h-7 !min-h-0 !min-w-0 shrink-0 items-center rounded-xl bg-slate-900 px-3 text-[11px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {t('toursList.apply')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {/* Refetch indicator moved into the rail as a spinning dot (Phase 2.10). */}
          </div>
          {/* End filter bar */}

          {/* Active filter chip strip (Phase 2.8 / B5) — sticks with the rail. */}
          <ActiveFilterStrip
            chips={activeFilterChips}
            onClearAll={resetFilters}
            clearAllLabel={t('toursList.clearAll')}
            ariaLabel={t('toursList.activeFilters')}
            removeAriaLabel={t('toursList.removeFilter')}
          />
        </div>
        {/* End sticky header stack (CatalogueHero + filter rail) */}

        <section className="mx-auto w-full max-w-5xl px-2 py-4 sm:px-4 sm:py-5">
          {isInitialLoading ? (
            <SkeletonGrid count={INITIAL_PAGE_SIZE} />
          ) : error ? (
            <div className={`${panelClass} py-6`}>
              <p className="font-medium text-red-600">{error}</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2"
                >
                  {t('toursList.resetFilters')}
                </button>
              ) : null}
            </div>
          ) : tours.length === 0 ? (
            <div className={panelClass}>
              <p className="font-medium text-slate-800">
                {hasActiveFilters ? t('toursList.emptyTitle') : copy.listDetail.noToursFound}
              </p>
              {hasActiveFilters ? (
                <>
                  <p className="mt-2 text-[13px] text-slate-500">{t('toursList.emptyHint')}</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 inline-flex h-9 items-center rounded-full bg-slate-900 px-5 text-[13px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2"
                  >
                    {t('toursList.resetFilters')}
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <>
              <div
                className={`grid grid-cols-1 gap-y-5 transition-opacity duration-200 sm:gap-y-6 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-7 ${
                  isRefetching ? 'opacity-60' : 'opacity-100'
                }`}
                aria-busy={isRefetching}
              >
                {visibleTours.map((tour) => (
                  <TourListCard
                    key={tour.id}
                    tour={tour}
                    detailHref={consumerTourDetailHref(tour.id, tour.slug)}
                    formatPriceFn={formatPrice}
                    layout="horizontal"
                    imageSizes="(min-width: 1024px) 240px, 38vw"
                  />
                ))}
              </div>
              {visibleCount < tours.length ? (
                <div ref={sentinelRef} className="flex items-center justify-center py-8">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((n) => Math.min(n + PAGE_STEP, tours.length))
                    }
                    className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white/90 px-5 text-[13px] font-semibold text-slate-900 shadow-[0_6px_18px_-10px_rgba(15,23,42,0.2)] transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2"
                  >
                    {t('toursList.loadMore')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Catalogue editorial footer — closes the magazine bracket opened by
            CatalogueHero. Only mounted once a populated catalogue is showing
            (skip on initial load / error / empty state). */}
        {!isInitialLoading && !error && tours.length > 0 ? (
          <CatalogueFooterStrip />
        ) : null}
      </main>
    </SitePageShell>
  );
}

/** Card skeleton grid — mirrors TourListCard horizontal proportions so the layout doesn't jump. */
function SkeletonGrid({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-y-5 sm:gap-y-6 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-7"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-row overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/95 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.22)]"
        >
          <div className="m-2.5 aspect-square w-[36%] min-w-[112px] max-w-[168px] shrink-0 animate-pulse rounded-2xl bg-slate-200/70 sm:m-3 sm:max-w-[188px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/70" />
            <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-slate-200/70" />
            <div className="mt-auto space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-14 animate-pulse rounded-full bg-slate-200/70" />
                <div className="h-4 w-12 animate-pulse rounded-full bg-slate-200/70" />
              </div>
              <div className="h-5 w-28 animate-pulse rounded-md bg-slate-200/80" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
