'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TourListItem } from './types';

/**
 * Fetch the full list of tours for the v2 list pane. Uses the existing admin
 * tours endpoint, then trims the rows to a compact shape. Always uses
 * `cache: 'no-store'` so freshly-saved edits surface immediately.
 */
export function useProductsList() {
  const [items, setItems] = useState<TourListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = await supabase?.auth.getSession();
      const token = sess?.data.session?.access_token;
      if (!token) {
        setError('No session — please sign in again.');
        setItems([]);
        return;
      }
      const res = await fetch('/api/admin/tours', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to load tours (${res.status})`);
      }
      const j = await res.json();
      const list = Array.isArray(j?.data) ? j.data : [];
      const trimmed: TourListItem[] = list.map((t: Record<string, unknown>) => ({
        id: String(t.id ?? ''),
        slug: String(t.slug ?? ''),
        title: String(t.title ?? ''),
        city: (t.city as 'Seoul' | 'Busan' | 'Jeju') ?? 'Jeju',
        image_url: (t.image_url as string | null) ?? null,
        is_active: Boolean(t.is_active),
        is_featured: Boolean(t.is_featured),
        price: typeof t.price === 'number' ? (t.price as number) : null,
        rating: typeof t.rating === 'number' ? (t.rating as number) : null,
        review_count: typeof t.review_count === 'number' ? (t.review_count as number) : null,
        product_type: typeof t.product_type === 'string' ? (t.product_type as string) : null,
        updated_at: (t.updated_at as string | null) ?? null,
      }));
      setItems(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
