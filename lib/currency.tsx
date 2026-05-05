'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/** Supported display currencies (world major). List/checkout amounts are stored and passed as USD (major units). */
export type CurrencyCode =
  | 'KRW'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CNY'
  | 'HKD'
  | 'SGD'
  | 'THB'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'TWD'
  | 'INR'
  | 'MXN'
  | 'PHP'
  | 'IDR'
  | 'VND';

export const CURRENCY_LIST: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'KRW', label: '한국 원', symbol: '₩' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'TWD', label: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', label: 'Mexican Peso', symbol: 'MX$' },
  { code: 'PHP', label: 'Philippine Peso', symbol: '₱' },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'VND', label: 'Vietnamese Dong', symbol: '₫' },
];

const STORAGE_KEY = 'atoc_currency';

const VALID_CODES = new Set(CURRENCY_LIST.map((c) => c.code));

interface RateResponse {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
  source?: string;
  error?: string;
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** BCP 47 locale for `Intl.NumberFormat` (grouping/separators). Synced from UI language in `LocaleCurrencySync`. */
  displayNumberLocale: string;
  setDisplayNumberLocale: (loc: string) => void;
  rates: Record<string, number> | null;
  rateUpdatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  /** `amountUsd` = US dollars (major units). API tour prices & booking totals use this unit. */
  formatPrice: (amountUsd: number, options?: { showCents?: boolean }) => string;
  /** @deprecated Alias: amounts are USD; returns `amountUsd`. */
  convertToUSD: (amountUsd: number) => number;
  /** USD → KRW (rounded integer won) using live KRW per 1 USD. */
  convertToKRW: (amountUsd: number) => number;
  refetchRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const DEFAULT_KRW_RATE = 1480;

/** Default display USD; KRW/EUR/… are converted from USD list prices. */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [displayNumberLocale, setDisplayNumberLocale] = useState('en-US');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStored = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && VALID_CODES.has(stored)) setCurrencyState(stored);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const fetchRate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/currency/rate');
      const data: RateResponse = await res.json();
      if (data.rates && typeof data.rates.KRW === 'number') {
        setRates(data.rates);
        setRateUpdatedAt(data.updatedAt || null);
      }
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch rate');
      setRates({ USD: 1, KRW: DEFAULT_KRW_RATE });
      setRateUpdatedAt(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStored();
  }, [loadStored]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchRate();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [fetchRate]);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const krwRate = rates?.KRW ?? DEFAULT_KRW_RATE;

  const formatPrice = useCallback(
    (amountUsd: number, options?: { showCents?: boolean }): string => {
      if (currency === 'USD') {
        const showCents =
          options?.showCents !== false && amountUsd > 0 && amountUsd < 1000 && amountUsd % 1 !== 0;
        return new Intl.NumberFormat(displayNumberLocale, {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: showCents ? 2 : 0,
          maximumFractionDigits: showCents ? 2 : 0,
        }).format(amountUsd);
      }
      if (currency === 'KRW') {
        const krw = Math.round(amountUsd * krwRate);
        return new Intl.NumberFormat(displayNumberLocale, {
          style: 'currency',
          currency: 'KRW',
          maximumFractionDigits: 0,
        }).format(krw);
      }
      const targetRate = rates?.[currency];
      if (targetRate == null) {
        return new Intl.NumberFormat(displayNumberLocale, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(amountUsd);
      }
      const amount = amountUsd * targetRate;
      const showCents = options?.showCents !== false && amount < 100 && currency !== 'JPY';
      return new Intl.NumberFormat(displayNumberLocale, {
        style: 'currency',
        currency,
        minimumFractionDigits: showCents ? 2 : 0,
        maximumFractionDigits: showCents ? 2 : 0,
      }).format(amount);
    },
    [currency, displayNumberLocale, krwRate, rates]
  );

  const convertToUSD = useCallback((amountUsd: number) => amountUsd, []);
  const convertToKRW = useCallback(
    (amountUsd: number) => Math.round(amountUsd * krwRate),
    [krwRate]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      displayNumberLocale,
      setDisplayNumberLocale,
      rates,
      rateUpdatedAt,
      isLoading,
      error,
      formatPrice,
      convertToUSD,
      convertToKRW,
      refetchRate: fetchRate,
    }),
    [
      currency,
      setCurrency,
      displayNumberLocale,
      rates,
      rateUpdatedAt,
      isLoading,
      error,
      formatPrice,
      convertToUSD,
      convertToKRW,
      fetchRate,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}

export function useCurrencyOptional(): CurrencyContextValue | null {
  return useContext(CurrencyContext) ?? null;
}
