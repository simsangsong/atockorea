'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EDITABLE_KEYS, type PoiRow } from './types';

/**
 * Resolve the current admin's Supabase access token, sent as a Bearer header on
 * every admin request (the API also supports cookie fallback). Mirrors the
 * products/v2 editor helper.
 */
export async function getAdminAccessToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

/**
 * Fetch one match_pois row by poi_key. A 404 is surfaced as `notFound` (not an
 * error) so the editor can open in create mode for a fresh poi_key.
 */
export function usePoiRow(poiKey: string | null) {
  const [data, setData] = useState<PoiRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!poiKey) {
      setData(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch(`/api/admin/match-pois/${encodeURIComponent(poiKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 404) {
        setData(null);
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to load (${res.status})`);
      setData((json?.data as PoiRow | null) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [poiKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, notFound, loading, error, refresh, setData };
}

/**
 * Auto-upsert save. Sends the full editable subset to PATCH
 * /api/admin/match-pois/[poi_key]; a new poi_key INSERTs, an existing one
 * UPDATEs. Returns the saved row + whether it was created. Throws on non-2xx.
 */
export async function savePoi(
  poiKey: string,
  draft: PoiRow,
): Promise<{ row: PoiRow; created: boolean; message: string }> {
  const token = await getAdminAccessToken();
  const body: Record<string, unknown> = {};
  for (const k of EDITABLE_KEYS) body[k] = (draft as Record<string, unknown>)[k] ?? null;

  const res = await fetch(`/api/admin/match-pois/${encodeURIComponent(poiKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);
  return {
    row: json.data as PoiRow,
    created: Boolean(json.created),
    message: typeof json.message === 'string' ? json.message : 'Saved',
  };
}
