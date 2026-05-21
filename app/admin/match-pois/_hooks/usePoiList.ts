'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAdminAccessToken } from './usePoiRow';
import type { PoiListItem } from './types';

/**
 * Fetch the POI catalog list for the editor's list pane. `_`-prefixed junk rows
 * are already filtered server-side. Always `cache: 'no-store'` so a freshly
 * saved/created row shows up on refresh.
 */
export function usePoiList() {
  const [items, setItems] = useState<PoiListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch('/api/admin/match-pois', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to load POIs (${res.status})`);
      setItems(Array.isArray(json?.data) ? (json.data as PoiListItem[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
