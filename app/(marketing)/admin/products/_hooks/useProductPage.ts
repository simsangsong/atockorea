'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Locale, ProductPageRow } from './types';

/**
 * Resolve the current admin's Supabase access token. We send it as a Bearer
 * header on every admin request — the API supports cookie fallback too, but
 * the explicit header is more reliable in dev and across browsers.
 */
async function getAdminAccessToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

/**
 * Fetch a single (slug, locale) row from `tour_product_pages`. Returns null
 * when the slug/locale combination has no row.
 */
export function useProductPage(slug: string | null, locale: Locale) {
  const [data, setData] = useState<ProductPageRow | null>(null);
  // Start true: the fetch effect only runs after first paint, so without this
  // the editor would briefly render its "no data" empty state before the
  // request even begins.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackLocale, setFallbackLocale] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!slug) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    setFallbackLocale(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch(
        `/api/admin/tour-product-pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load (${res.status})`);
      }
      setData((json?.data as ProductPageRow | null) ?? null);
      setFallbackLocale((json?.fallbackLocale as string | null) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, fallbackLocale, refresh, setData };
}

/**
 * Save a patch to a (slug, locale) row. Returns the updated row on success.
 * Throws on non-2xx. Caller should toast on success/failure.
 */
export async function saveProductPage(
  slug: string,
  locale: Locale,
  patch: Partial<ProductPageRow>,
): Promise<ProductPageRow> {
  const token = await getAdminAccessToken();
  const body: Record<string, unknown> = { ...patch, locale };
  const res = await fetch(
    `/api/admin/tour-product-pages/${encodeURIComponent(slug)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || `Save failed (${res.status})`);
  }
  return json.data as ProductPageRow;
}
