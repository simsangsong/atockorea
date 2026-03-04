'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type CurrencyCode = 'USD' | 'KRW';

const STORAGE_KEY = 'atoc_currency';

interface RateResult {
  rate: number;
  base: string;
  target: string;
  updatedAt: string;
  source?: string;
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rate: number | null;
  rateUpdatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  /** Format a price stored in KRW for display in current currency */
  formatPrice: (priceKRW: number, options?: { showCents?: boolean }) => string;
  /** Convert KRW to USD using current rate */
  convertToUSD: (priceKRW: number) => number;
  /** Convert USD to KRW using current rate */
  convertToKRW: (priceUSD: number) => number;
  refetchRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const DEFAULT_RATE = 1350;

/** 기준 통화: KRW. DB/API는 모두 원화(KRW). USD는 이 환율로 KRW→USD 변환하여 표시. */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('KRW');
  const [rate, setRate] = useState<number | null>(null);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStored = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored === 'USD' || stored === 'KRW') setCurrencyState(stored);
    } catch (_) {}
  }, []);

  const fetchRate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/currency/rate');
      const data: RateResult & { error?: string } = await res.json();
      if (data.rate != null && typeof data.rate === 'number') {
        setRate(data.rate);
        setRateUpdatedAt(data.updatedAt || null);
      }
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch rate');
      setRate(DEFAULT_RATE);
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

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch (_) {}
  }, []);

  const effectiveRate = rate ?? DEFAULT_RATE;

  const formatPrice = useCallback(
    (priceKRW: number, options?: { showCents?: boolean }): string => {
      if (currency === 'KRW') {
        return `₩${Math.round(priceKRW).toLocaleString('ko-KR')}`;
      }
      const usd = priceKRW / effectiveRate;
      if (options?.showCents !== false && usd < 100) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(usd);
      }
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usd);
    },
    [currency, effectiveRate]
  );

  const convertToUSD = useCallback((priceKRW: number) => priceKRW / effectiveRate, [effectiveRate]);
  const convertToKRW = useCallback((priceUSD: number) => priceUSD * effectiveRate, [effectiveRate]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      rate,
      rateUpdatedAt,
      isLoading,
      error,
      formatPrice,
      convertToUSD,
      convertToKRW,
      refetchRate: fetchRate,
    }),
    [currency, setCurrency, rate, rateUpdatedAt, isLoading, error, formatPrice, convertToUSD, convertToKRW, fetchRate]
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

/** Safe hook that returns a default format if outside provider (e.g. KRW only) */
export function useCurrencyOptional(): CurrencyContextValue | null {
  return useContext(CurrencyContext) ?? null;
}
