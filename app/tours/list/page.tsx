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
    const destinationFromUrl = searchParams.get('destination') || 'all';
    const typeFromUrl = (searchParams.get('type') as TourTypeFilter | null) || 'all';
    const sortFromUrl = (searchParams.get('sort') as SortFilter | null) || 'popular';
    const minFromUrl = searchParams.get('minPrice') || '';
    const maxFromUrl = searchParams.get('maxPrice') || '';

    setSearchInput(q);
    setDebouncedSearch(q);
    setDestination(destinationFromUrl);
    setTourType(
      typeFromUrl === 'private' || typeFromUrl === 'join' || typeFromUrl === 'bus'
        ? typeFromUrl
        : 'all',
    );
    setSortBy(
      sortFromUrl === 'newest' ||
        sortFromUrl === 'rating' ||
        sortFromUrl === 'sales' ||
        sortFromUrl === 'priceAsc' ||
        sortFromUrl === 'priceDesc'
        ? sortFromUrl
        : 'popular',
    );
    setMinPrice(minFromUrl);
    setMaxPrice(maxFromUrl);
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
      } = {},
    ) => {
      const q = 'q' in overrides ? overrides.q ?? '' : debouncedSearch;
      const dest = 'destination' in overrides ? overrides.destination ?? 'all' : destination;
      const ty = 'type' in overrides ? overrides.type ?? 'all' : tourType;
      const so = 'sort' in overrides ? overrides.sort ?? 'popular' : sortBy;
      const mn = 'minPrice' in overrides ? overrides.minPrice ?? '' : minPrice.trim();
      const mx = 'maxPrice' in overrides ? overrides.maxPrice ?? '' : maxPrice.trim();

      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (dest !== 'all') p.set('destination', dest);
      if (ty !== 'all') p.set('type', ty);
      if (so !== 'popular') p.set('sort', so);
      if (mn) p.set('minPrice', mn);
      if (mx) p.set('maxPrice', mx);
      const next = p.toString();
      return next ? `/tours/list?${next}` : '/tours/list';
    },
    [debouncedSearch, destination, tourType, sortBy, minPrice, maxPrice],
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
    maxPrice !== '';
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

  const panelClass =
    'home-panel-refinement mx-auto w-full max-w-3xl px-5 py-10 text-center text-slate-600';

  /** Shared compact field style — inputs. Focus ring now uses slate-900/30 for visibility. */
  const fieldCls =
    'h-8 rounded-xl border border-slate-200/75 bg-white/88 px-3 text-[12px] text-slate-900 outline-none transition focus:border-slate-900/60 focus-visible:ring-2 focus-visible:ring-slate-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.90)]';

  const selectCls =
    'h-8 cursor-pointer rounded-xl border border-slate-200/75 bg-white/88 px-2.5 text-[12px] text-slate-900 outline-none transition focus:border-slate-900/60 focus-visible:ring-2 focus-visible:ring-slate-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.90)]';

  const chipCls = (active: boolean) =>
    active
      ? 'inline-flex h-7 !min-h-0 !min-w-0 shrink-0 items-center rounded-full bg-slate-900 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
      : 'inline-flex h-7 !min-h-0 !min-w-0 shrink-0 items-center rounded-full border border-slate-200/85 bg-white/82 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

  const visibleTours = tours.slice(0, visibleCount);
  const isInitialLoading = loading && tours.length === 0;
  const isRefetching = loading && tours.length > 0;

  return (
    <SitePageShell>
      <main className="pb-24">
        {/* Sticky filter bar */}
        <div className="sticky top-0 z-30 isolate border-b border-white/55 bg-white/72 backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)] [padding-top:env(safe-area-inset-top)]">
          <div className="mx-auto max-w-5xl px-3 sm:px-4">
            {/* Desktop: single row */}
            <div className="hidden h-[52px] items-center gap-2 lg:flex">
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">
                  {t('toursList.eyebrow')}
                </span>
              </div>

              <div className="mx-1 h-3.5 w-px shrink-0 bg-slate-200/80" />

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

              <select
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  push({ destination: e.target.value });
                }}
                aria-label={t('toursList.destinationAriaLabel')}
                className={`${selectCls} w-32`}
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
                title={sortBy === 'popular' ? t('toursList.popularHint') : undefined}
                className={`${selectCls} w-36`}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="mx-0.5 h-3.5 w-px shrink-0 bg-slate-200/80" />

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

              <div className="mx-0.5 h-3.5 w-px shrink-0 bg-slate-200/80" />

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
                    className="absolute right-0 top-[calc(100%+8px)] z-40 flex items-center gap-2 rounded-2xl border border-white/85 bg-white/95 p-3 shadow-[0_24px_56px_-22px_rgba(15,23,42,0.36)] backdrop-blur-xl"
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
                      className="inline-flex h-7 !min-h-0 !min-w-0 items-center rounded-xl bg-slate-900 px-3 text-[11px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                  className="inline-flex h-7 w-7 !min-h-0 !min-w-0 shrink-0 items-center justify-center rounded-full border border-slate-200/85 bg-white/82 text-slate-500 transition hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                  className={`${fieldCls} h-9 min-w-0 flex-1 text-[13px]`}
                />
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    aria-label={t('toursList.resetFilters')}
                    className="inline-flex h-9 w-9 !min-h-0 !min-w-0 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-white/82 text-slate-500 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
                    className={`inline-flex h-7 !min-h-0 !min-w-0 flex-1 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      tourType === opt.value
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200/85 bg-white/82 text-slate-600 hover:border-slate-300 hover:bg-white'
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
                  className={`${selectCls} h-8 min-w-0 flex-1 text-[12px]`}
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
                  className={`${selectCls} h-8 min-w-0 flex-1 text-[12px]`}
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
                  className={`${chipCls(hasPriceFilter)} h-8 flex-1 justify-center text-[11px]`}
                >
                  {priceChipLabel}
                </button>
                {showPricePanel ? (
                  <div
                    role="dialog"
                    aria-label={t('toursList.priceAriaLabel')}
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 flex items-center gap-2 rounded-2xl border border-white/85 bg-white/95 p-3 shadow-[0_24px_56px_-22px_rgba(15,23,42,0.36)] backdrop-blur-xl"
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
                      className="inline-flex h-7 !min-h-0 !min-w-0 shrink-0 items-center rounded-xl bg-slate-900 px-3 text-[11px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {t('toursList.apply')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {isRefetching ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
              aria-hidden="true"
            >
              <div className="h-full w-1/3 animate-pulse bg-slate-900/50" />
            </div>
          ) : null}
        </div>
        {/* End filter bar */}

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
                className={`grid grid-cols-2 gap-x-3 gap-y-4 transition-opacity duration-200 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6 ${
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
      </main>
    </SitePageShell>
  );
}

/** Card skeleton grid — mirrors TourListCard proportions so the layout doesn't jump. */
function SkeletonGrid({ count }: { count: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/95 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.22)]"
        >
          <div className="aspect-[4/3.15] w-full animate-pulse bg-slate-200/70 sm:aspect-[4/3.35]" />
          <div className="space-y-2 px-3 py-3">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/70" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-200/70" />
            <div className="flex gap-2 pt-1">
              <div className="h-4 w-14 animate-pulse rounded-full bg-slate-200/70" />
              <div className="h-4 w-12 animate-pulse rounded-full bg-slate-200/70" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
