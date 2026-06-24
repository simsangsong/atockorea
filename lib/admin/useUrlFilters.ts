'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * URL-backed filter state for admin lists (W1.6 / spec §3.2). Keeps filter
 * state in the query string so it survives refresh, back/forward and deep links.
 * Values equal to their default are dropped from the URL to keep it clean.
 */

/** Pure: serialize a filter map to a stable (sorted) query string. Exported for tests. */
export function serializeFilters(filters: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') sp.set(key, String(value));
  }
  sp.sort();
  return sp.toString();
}

export function useUrlFilters<T extends Record<string, string>>(defaults: T): {
  filters: T;
  setFilter: (key: keyof T, value: string | null) => void;
  setFilters: (next: Partial<T>) => void;
  resetFilters: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const out = { ...defaults } as Record<string, string>;
    for (const key of Object.keys(defaults)) {
      const value = searchParams?.get(key);
      if (value != null) out[key] = value;
    }
    return out as T;
  }, [searchParams, defaults]);

  const apply = useCallback(
    (next: Partial<T>) => {
      const merged = { ...filters, ...next } as Record<string, string>;
      const cleaned: Record<string, string | null> = {};
      for (const key of Object.keys(merged)) {
        const value = merged[key];
        cleaned[key] = value === (defaults as Record<string, string>)[key] ? null : value;
      }
      const qs = serializeFilters(cleaned);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, defaults, pathname, router],
  );

  const setFilter = useCallback(
    (key: keyof T, value: string | null) =>
      apply({ [key]: value ?? (defaults as Record<string, string>)[key as string] } as Partial<T>),
    [apply, defaults],
  );

  const setFilters = useCallback((next: Partial<T>) => apply(next), [apply]);

  const resetFilters = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [router, pathname],
  );

  return { filters, setFilter, setFilters, resetFilters };
}
