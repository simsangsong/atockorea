'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import TourListCard from '@/components/tour/TourListCard';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { CURRENCY_LIST, useCurrencyOptional, type CurrencyCode } from '@/lib/currency';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { ITINERARY_BUILDER_ENABLED } from '@/lib/itinerary-builder/builder-visibility';
import { CatalogueHero } from '@/components/tours-list/CatalogueHero';
import { CatalogueFooterStrip } from '@/components/tours-list/CatalogueFooterStrip';
import { SortSegmented } from '@/components/tours-list/SortSegmented';
import { DestinationPillSelect } from '@/components/tours-list/DestinationPillSelect';
import { ActiveFilterStrip, type ActiveFilterChip } from '@/components/tours-list/ActiveFilterStrip';
import { ContextualVignetteBand } from '@/components/tours-list/ContextualVignetteBand';
import { EmptyStateRecovery } from '@/components/tours-list/EmptyStateRecovery';
import { ResultsMetaStrip, type CatalogueViewMode } from '@/components/tours-list/ResultsMetaStrip';
import { ShelvesContainer } from '@/components/tours-list/ShelvesContainer';
import { EditorialInsert } from '@/components/tours-list/EditorialInsert';
import { insertForSlot } from '@/lib/tours-list-editorial-inserts';
import { ConversionRescueBand } from '@/components/tours-list/ConversionRescueBand';
import {
  getCardImageFromAdminMedia,
  useTourProductCardMedia,
} from '@/hooks/useTourProductCardMedia';
import type { TourProductCardMediaMap } from '@/lib/tour-product/cardMediaTypes';
import {
  LIST_FIELD_CLS,
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

/**
 * `initialMediaBySlug` is the server-rendered admin-media snapshot for the
 * static catalog slugs (PR #92). Seeded into:
 *   - `<ShelvesContainer initialMediaBySlug={…} />` for the no-filter view
 *   - `useTourProductCardMedia(…, initialMediaBySlug)` for the flat-grid view
 * so the very first render already shows the freshest thumbnail — no
 * "static-catalog flashes then flips to admin-saved" flicker users
 * reported on 2026-05-25.
 */
export type ToursListClientProps = {
  initialMediaBySlug?: TourProductCardMediaMap;
};

export default function ToursListClient({ initialMediaBySlug }: ToursListClientProps = {}) {
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const currencyCtx = useCurrencyOptional();
  const router = useRouter();

  // CSR-bailout guard (same class as the Wave-2 fix, 2026-07-04): this page is
  // ISR'd, and a top-level `useSearchParams()` would suspend the static
  // prerender so the cached HTML ships fallback-only. Filters are deep-link
  // inputs, so parse `window.location.search` on mount + back/forward instead;
  // `push()`/`resetFilters()` mirror their own URL writes into this state
  // (router.replace does not fire popstate) so the URL→state sync effect below
  // keeps firing exactly as it did with useSearchParams.
  const [searchParams, setSearchParamsState] = useState(() => new URLSearchParams());
  useEffect(() => {
    const readLocationParams = () =>
      setSearchParamsState(new URLSearchParams(window.location.search));
    readLocationParams();
    window.addEventListener('popstate', readLocationParams);
    return () => window.removeEventListener('popstate', readLocationParams);
  }, []);

  const currencyCode: CurrencyCode = (currencyCtx?.currency ?? 'USD') as CurrencyCode;
  const rates = currencyCtx?.rates ?? null;
  const krwRate = rates?.KRW ?? DEFAULT_KRW_RATE;
  const currencySymbol = getCurrencySymbol(currencyCode);
  const reducedMotion = useReducedMotion() === true;

  /**
   * `useTranslations()` returns a fresh function reference every render, so we must
   * NOT include `t` in stateful effect deps (caused an abort/refetch loop that
   * pinned `loading=true` forever). Primitive strings are stable by value in React
   * deps; pull translation labels used inside effects out here.
   */
  const loadFailedLabel = t('toursList.loadFailed');

  const [tours, setTours] = useState<TourCardViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * True once a grid fetch has settled (B1). The default entry skips the
   * `/api/tours` fetch entirely (shelves don't use it), so `loading` alone no
   * longer means "results are on the way" — this distinguishes "never fetched"
   * (first filter activation → skeleton) from "fetched empty" (empty state).
   */
  const [hasFetchedResults, setHasFetchedResults] = useState(false);
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
  /** Mobile full-sheet filter drawer (Phase 2.9). */
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  /** Grid view mode (Phase 4.0 — B7: Editorial 3-up is default). Persisted. */
  const [viewMode, setViewMode] = useState<CatalogueViewMode>('editorial');

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

  // --- U9 carry-through ------------------------------------------------------------------
  // The upstream `?party=` group size (home stepper → list) rides onto each
  // tour's detail link so the booking card opens with the size the visitor
  // already chose instead of re-asking. Party is a booking quantity, not a
  // catalogue filter, so it is forwarded only — never folded into list/API
  // filter state.
  const carriedParty = (() => {
    const raw = searchParams.get('party');
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const detailHrefWithParty = (id: string | null | undefined, slug?: string | null): string => {
    const base = consumerTourDetailHref(id, slug);
    if (carriedParty == null || base === '/tours/list') return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}party=${carriedParty}`;
  };

  // --- Debounce search input ------------------------------------------------------------
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // --- Destination master list (fetched once, independent of current filters) ----------
  // B3: deferred to idle — the pill counts are filter-rail garnish, not initial
  // content, so this shouldn't compete with hydration on the tab-tap critical path.
  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (!mounted) return;
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
    };
    // Safari still lacks requestIdleCallback — feature-detect, don't assume.
    const canIdle = typeof window.requestIdleCallback === 'function';
    const idleId = canIdle
      ? window.requestIdleCallback(load, { timeout: 2000 })
      : window.setTimeout(load, 500);
    return () => {
      mounted = false;
      if (canIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
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
    // B1 (2026-07-04 perf): the default entry renders the curated shelves
    // (static catalog + server-seeded admin media) and never shows the flat
    // grid — fetching 500 tours + per-slug media there was invisible work that
    // held `loading` for the whole `/api/tours` round trip (2.5s on a CDN
    // MISS). Skip it; the first real filter/sort/search change fetches.
    const isDefaultCatalogueEntry =
      !debouncedSearch &&
      destination === 'all' &&
      tourType === 'all' &&
      sortBy === 'popular' &&
      !minPrice.trim() &&
      !maxPrice.trim() &&
      !features.trim();
    if (isDefaultCatalogueEntry) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setError(null);
      return;
    }

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
        setHasFetchedResults(true);
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
      // Stay on the current path — the page is served from both the bare EN
      // route and `/{locale}/tours/list`; hardcoding the bare path would bounce
      // localized visitors through the middleware locale 307 on every filter.
      const basePath =
        typeof window !== 'undefined' ? window.location.pathname : '/tours/list';
      return next ? `${basePath}?${next}` : basePath;
    },
    [debouncedSearch, destination, tourType, sortBy, minPrice, maxPrice, features],
  );

  const push = useCallback(
    (overrides?: Parameters<typeof buildUrl>[0]) => {
      const url = buildUrl(overrides);
      router.replace(url);
      // Mirror the write locally — several callers (e.g. type chips) rely on
      // the URL→state sync effect instead of setting their own state.
      const qIndex = url.indexOf('?');
      setSearchParamsState(new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : ''));
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
    router.replace(typeof window !== 'undefined' ? window.location.pathname : '/tours/list');
    setSearchParamsState(new URLSearchParams());
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

  // --- View mode: hydrate from localStorage (Phase 4.0/3.5) ----------------------------
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('toursList.view');
      if (saved === 'editorial' || saved === 'compact') setViewMode(saved);
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  const changeViewMode = useCallback((v: CatalogueViewMode) => {
    setViewMode(v);
    try {
      window.localStorage.setItem('toursList.view', v);
    } catch {
      /* ignore persistence failure */
    }
  }, []);

  // --- Mobile filter drawer: body scroll lock + ESC ------------------------------------
  useEffect(() => {
    if (!showMobileFilters) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileFilters(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [showMobileFilters]);

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

  // Tier B Features multi-select (Phase 4.10). Keywords substring-match the
  // tour `badges` server-side; values verified against live data (UNESCO/Cruise/
  // Seasonal/Hotel pickup/Customizable all present). Duration filter was dropped
  // — every active tour is an 8–13h full-day tour, so Half/Full/Multi-day has no
  // useful split (B13: never ship a filter that can't meaningfully narrow).
  const featureOptions = useMemo(
    () => [
      { value: 'unesco', label: t('toursList.featUnesco') },
      { value: 'cruise', label: t('toursList.featCruise') },
      { value: 'seasonal', label: t('toursList.featSeasonal') },
      { value: 'hotel pickup', label: t('toursList.featPickup') },
      { value: 'customizable', label: t('toursList.featCustom') },
    ],
    [t],
  );
  const activeFeatures = useMemo(
    () => features.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean),
    [features],
  );
  const toggleFeature = useCallback(
    (val: string) => {
      const set = new Set(activeFeatures);
      if (set.has(val)) set.delete(val);
      else set.add(val);
      const next = Array.from(set).join(',');
      setFeatures(next);
      push({ features: next });
    },
    [activeFeatures, push],
  );
  const [showTierB, setShowTierB] = useState(false);

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
    // One dismissible chip per active feature (Phase 4.10 multi-select).
    for (const fv of activeFeatures) {
      const label = featureOptions.find((o) => o.value === fv)?.label ?? fv;
      chips.push({
        key: `feature:${fv}`,
        label,
        onRemove: () => toggleFeature(fv),
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, destination, tourType, hasPriceFilter, priceChipLabel, activeFeatures, featureOptions, tourTypeOptions, t]);

  // Most-constraining filter for empty-state recovery (Phase 3.7) — heuristic
  // priority: price > destination > features > type > search (the filters most
  // likely to zero out results, in order). Returns the single best filter to
  // suggest removing, or null when only search is active.
  const suggestedFilterToRemove = useMemo((): { label: string; onRemove: () => void } | null => {
    if (hasPriceFilter) {
      return {
        label: priceChipLabel,
        onRemove: () => {
          setMinPrice('');
          setMaxPrice('');
          push({ minPrice: '', maxPrice: '' });
        },
      };
    }
    if (destination !== 'all') {
      return {
        label: translateCity(destination, t),
        onRemove: () => {
          setDestination('all');
          push({ destination: 'all' });
        },
      };
    }
    if (features.trim() !== '') {
      return {
        label: features.trim(),
        onRemove: () => {
          setFeatures('');
          push({ features: '' });
        },
      };
    }
    if (tourType !== 'all') {
      return {
        label: tourTypeOptions.find((o) => o.value === tourType)?.label ?? tourType,
        onRemove: () => {
          setTourType('all');
          push({ type: 'all' });
        },
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPriceFilter, priceChipLabel, destination, features, tourType, tourTypeOptions, t]);

  const panelClass =
    'home-panel-refinement mx-auto w-full max-w-3xl px-5 py-10 text-center text-slate-600';

  /**
   * Filter field / chip styles — Phase 2 (B4 + B32): h-11 + text-[13.5px] +
   * site-native translucent-white + slate, sourced from lib/tours-list-tokens.
   * (The destination/sort `<select>`s were replaced by DestinationPillSelect +
   * SortSegmented, so LIST_SELECT_CLS is no longer consumed here.)
   */
  const fieldCls = LIST_FIELD_CLS;

  const chipCls = (active: boolean) =>
    `${active ? LIST_CHIP_ACTIVE_CLS : LIST_CHIP_INACTIVE_CLS} h-9 !min-h-0 !min-w-0 shrink-0`;

  const visibleTours = tours.slice(0, visibleCount);
  // `!hasFetchedResults` covers the debounce window after the first filter
  // activation (B1: no eager default fetch) — without it the grid would flash
  // the empty state for 300ms before the fetch even starts.
  const isInitialLoading = (loading || !hasFetchedResults) && tours.length === 0;
  const isRefetching = loading && tours.length > 0;

  /**
   * Pull the latest admin-saved thumbnails from `/api/tour-product-card-media`
   * (which reads `tour_product_pages.thumbnail_url`) and override
   * `tour.imageUrl` per card. Without this the flat-grid view keeps showing
   * stale images from `tours.image_url` whenever the admin-v2 mirror to the
   * tours table fell behind — confirmed drift on 15+ rows as of 2026-05-25
   * (e.g. `southwest-hallasan-osulloc-aewol`, `jeju-grand-highlights-loop`,
   * `east-signature-nature-core`). The shelves view already does this via
   * `TourShelf`/`ShelfCard`; this brings the filtered view to parity.
   */
  const visibleSlugs = useMemo(
    () => visibleTours.map((t) => t.slug).filter((s): s is string => Boolean(s)),
    [visibleTours],
  );
  const flatGridMediaBySlug = useTourProductCardMedia(visibleSlugs, locale, initialMediaBySlug);

  return (
    <SitePageShell>
      {/* B32: site-native — neutral white veil over the page's pastel mesh
          (body::before), NOT a solid ivory that covers it. bg-white/55 keeps
          the mesh faintly visible so list matches every other consumer page. */}
      {/*
        Scroll-jitter fix (B11 scroll-freeze guard): the CatalogueHero collapses
        240→88 on scroll via a scrollY-linked height (Phase 1/6). That collapse
        shrinks the sticky header's flow box, which shortens the document. On a
        SHORT result set (e.g. ?type=private — few cards) on a tall viewport, the
        document can become shorter than the scroll position mid-collapse, so the
        browser clamps scrollY back up → the hero re-expands → the page grows →
        clamp again: a violent up/down oscillation. Flooring the page to
        viewport + 16rem pins the document height while the header collapses
        (natural content < floor), so maxScroll stays constant and the loop can
        never form. Tall result sets exceed the floor and are unaffected. No new
        scroll-linked animation or library (B11/B12 preserved).
      */}
      <main className="min-h-[calc(100vh+16rem)] bg-white/55 pb-24">
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

              {/* More — toggles Tier B (Features) row (Phase 4.10 / 2.7). */}
              <button
                type="button"
                onClick={() => setShowTierB((v) => !v)}
                aria-expanded={showTierB}
                className={`${chipCls(showTierB || activeFeatures.length > 0)} gap-1`}
              >
                {t('toursList.moreFilters')}
                {activeFeatures.length > 0 ? (
                  <span className="ml-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white/25 px-1 text-[9px] font-bold">
                    {activeFeatures.length}
                  </span>
                ) : null}
              </button>

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

            {/* Desktop Tier B row — Features (Phase 4.10), revealed by More. */}
            {showTierB ? (
              <div className="hidden items-center gap-2 border-t border-slate-200/55 py-2.5 lg:flex">
                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">
                  {t('toursList.featuresLabel')}
                </span>
                <div className="mx-1 h-4 w-px shrink-0 bg-slate-200/70" />
                {featureOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={activeFeatures.includes(opt.value)}
                    onClick={() => toggleFeature(opt.value)}
                    className={chipCls(activeFeatures.includes(opt.value))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Mobile: compact row — search + Filter button (Phase 2.9). */}
            <div className="flex items-center gap-2 py-2.5 lg:hidden">
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
              <button
                type="button"
                onClick={() => setShowMobileFilters(true)}
                aria-label={t('toursList.filtersTitle')}
                className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/85 px-3.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeWidth={2} d="M3 6h18M6 12h12M10 18h4" />
                </svg>
                {t('toursList.filters')}
                {activeFilterChips.length > 0 ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">
                    {activeFilterChips.length}
                  </span>
                ) : null}
              </button>
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

        {/* Contextual vignette band (Phase 3.2) — destination/feature 7-accent (B6).
            Upgraded 2026-05-25 to the shelf magazine typography so the filter
            view doesn't visibly drop to an older Phase 4 layout. */}
        <ContextualVignetteBand
          destination={destination}
          features={features}
          contextLabel={destination !== 'all' ? translateCity(destination, t) : features.trim()}
          line={t('toursList.contextBandLine', {
            context: destination !== 'all' ? translateCity(destination, t) : features.trim(),
          })}
          eyebrowPrefix={t('toursList.contextBandEyebrow')}
          resetLabel={t('toursList.contextBandReset')}
          onReset={resetFilters}
        />

        {/* Mobile full-sheet filter drawer (Phase 2.9) — framer bottom-sheet,
            0.3s ease (detail-page drawer policy). reduce-motion → instant. */}
        <AnimatePresence>
          {showMobileFilters ? (
            <motion.div
              className="fixed inset-0 z-[60] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                onClick={() => setShowMobileFilters(false)}
                aria-hidden
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={t('toursList.filtersTitle')}
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.4)]"
                initial={reducedMotion ? { y: 0 } : { y: '100%' }}
                animate={{ y: 0 }}
                exit={reducedMotion ? { y: 0 } : { y: '100%' }}
                transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Grab handle + header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-5 pb-3 pt-3 backdrop-blur-md">
                  <span className="text-[15px] font-bold tracking-[-0.01em] text-slate-900">
                    {t('toursList.filtersTitle')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(false)}
                    aria-label={t('toursList.filtersTitle')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 px-5 py-5">
                  {/* Sort */}
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t('toursList.sortAriaLabel')}
                    </span>
                    <SortSegmented
                      value={sortBy}
                      options={sortOptions}
                      onChange={(v) => {
                        setSortBy(v);
                        push({ sort: v });
                      }}
                      ariaLabel={t('toursList.sortAriaLabel')}
                      className="w-full"
                    />
                  </div>

                  {/* Destination */}
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t('toursList.destinationAriaLabel')}
                    </span>
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
                  </div>

                  {/* Tour type */}
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t('toursList.typeLabel')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tourTypeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={tourType === opt.value}
                          onClick={() => {
                            setTourType(opt.value);
                            push({ type: opt.value });
                          }}
                          className={`${chipCls(tourType === opt.value)} h-9`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t('toursList.priceAriaLabel')}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={`${t('toursList.minPlaceholder')} (${currencySymbol})`}
                        aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.minPlaceholder')}`}
                        className={`${fieldCls} min-w-0 flex-1`}
                        inputMode="decimal"
                      />
                      <span className="text-[13px] text-slate-400" aria-hidden>—</span>
                      <input
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={`${t('toursList.maxPlaceholder')} (${currencySymbol})`}
                        aria-label={`${t('toursList.priceAriaLabel')} ${t('toursList.maxPlaceholder')}`}
                        className={`${fieldCls} min-w-0 flex-1`}
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  {/* Features (Tier B, Phase 4.10) */}
                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t('toursList.featuresLabel')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {featureOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={activeFeatures.includes(opt.value)}
                          onClick={() => toggleFeature(opt.value)}
                          className={`${chipCls(activeFeatures.includes(opt.value))} h-9`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="sticky bottom-0 flex gap-2 border-t border-slate-200/70 bg-white/95 px-5 py-3 backdrop-blur-md">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-5 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {t('toursList.resetFilters')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      push({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
                      setShowMobileFilters(false);
                    }}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-900 px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.5)] transition hover:bg-slate-800"
                  >
                    {t('toursList.viewResults')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <section
          className={`mx-auto w-full px-2 py-4 transition-[max-width] duration-300 sm:px-4 sm:py-5 ${
            viewMode === 'editorial' ? 'max-w-[1320px]' : 'max-w-5xl'
          }`}
        >
          {!hasActiveFilters ? (
            /* Phase 7 B33 — default entry = curated shelves; filter activation flips to
               the flat grid below. Checked BEFORE the loading skeleton (B1): shelves
               don't depend on the /api/tours fetch, so they must paint immediately. */
            <ShelvesContainer initialMediaBySlug={initialMediaBySlug} />
          ) : isInitialLoading ? (
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
            hasActiveFilters ? (
              <EmptyStateRecovery
                title={t('toursList.emptyRecoveryTitle')}
                hint={t('toursList.emptyRecoveryHint')}
                suggestRemoveLabel={
                  suggestedFilterToRemove
                    ? t('toursList.emptySuggestRemove', { filter: suggestedFilterToRemove.label })
                    : undefined
                }
                onRemoveSuggested={suggestedFilterToRemove?.onRemove}
                builderHref={ITINERARY_BUILDER_ENABLED ? '/itinerary-builder' : undefined}
                builderCta={ITINERARY_BUILDER_ENABLED ? t('toursList.emptyBuilderCta') : undefined}
                conciergeHref="/support"
                conciergeCta={t('toursList.emptyConciergeCta')}
              />
            ) : (
              <div className={panelClass}>
                <p className="font-medium text-slate-800">{copy.listDetail.noToursFound}</p>
              </div>
            )
          ) : (
            <>
              {/* Results meta + view toggle (Phase 4.0). */}
              <ResultsMetaStrip
                sortLabel={t('toursList.sortedBy', {
                  sort: sortOptions.find((o) => o.value === sortBy)?.label ?? '',
                })}
                view={viewMode}
                onViewChange={changeViewMode}
                editorialLabel={t('toursList.viewEditorial')}
                compactLabel={t('toursList.viewCompact')}
                viewAriaLabel={t('toursList.viewEditorial')}
              />

              <div
                className={`grid transition-opacity duration-200 ${
                  viewMode === 'editorial'
                    ? 'grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 md:grid-cols-2 md:gap-x-6 md:gap-y-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10'
                    : 'grid-cols-1 gap-y-5 sm:gap-y-6 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-7'
                } ${isRefetching ? 'opacity-70' : 'opacity-100'}`}
                aria-busy={isRefetching}
              >
                {visibleTours.map((tour, i) => {
                  // Editorial insert after the 6th / 12th / 18th card (B8).
                  const insert = insertForSlot(i + 1);
                  // Admin-v2 thumbnail override (see flatGridMediaBySlug
                  // doc comment above): the card uses the freshest image
                  // from `tour_product_pages.thumbnail_url`, falling back
                  // to the `tours.image_url` we already have on the row.
                  const overriddenImageUrl = tour.slug
                    ? getCardImageFromAdminMedia(
                        tour.slug,
                        tour.imageUrl ?? '',
                        flatGridMediaBySlug,
                      )
                    : tour.imageUrl;
                  const cardTour = overriddenImageUrl && overriddenImageUrl !== tour.imageUrl
                    ? { ...tour, imageUrl: overriddenImageUrl }
                    : tour;
                  return (
                    <React.Fragment key={tour.id}>
                      <TourListCard
                        tour={cardTour}
                        detailHref={detailHrefWithParty(tour.id, tour.slug)}
                        formatPriceFn={formatPrice}
                        layout={viewMode === 'editorial' ? 'vertical' : 'horizontal'}
                        imageSizes={
                          viewMode === 'editorial'
                            ? '(min-width: 1024px) 420px, (min-width: 768px) 46vw, 47vw'
                            : '(min-width: 1024px) 240px, 38vw'
                        }
                      />
                      {insert ? <EditorialInsert content={insert} t={t} /> : null}
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Conversion rescue band — only after 28+ cards browsed (B9).
                  Klook prep 2026-06-29: gated off (its CTA targets the hidden builder). */}
              {ITINERARY_BUILDER_ENABLED && visibleCount >= 28 ? (
                <ConversionRescueBand
                  eyebrow={t('toursList.insertCuratorEyebrow')}
                  title={t('toursList.rescueTitle')}
                  body={t('toursList.rescueBody')}
                  cta={t('toursList.rescueCta')}
                  href="/itinerary-builder"
                />
              ) : null}

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
              ) : (
                /* End-of-results signature (Phase 4.9). */
                <p className="py-8 text-center text-[12.5px] text-slate-400">
                  {t('toursList.endOfResults')}
                </p>
              )}
            </>
          )}
        </section>

        {/* Catalogue editorial footer — closes the magazine bracket opened by
            CatalogueHero. Mounted under the shelves (default entry — B1 skips the
            grid fetch there, so don't gate on `tours`) and under a populated grid
            (skip on initial load / error / empty state). */}
        {!hasActiveFilters || (!isInitialLoading && !error && tours.length > 0) ? (
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
