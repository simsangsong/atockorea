'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ReviewDisplayCard, { reviewRowToDisplayData } from '@/components/reviews/ReviewDisplayCard';
import { mypagePageCard, MYPAGE_SECTION_TITLE } from '@/lib/mypage-ui';

/**
 * Authenticated user’s reviews on /reviews, including shadow (mine=1). Not shown to guests.
 */
export default function MyReviewsSection() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews?mine=1&limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load your reviews');
      }
      setRows(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (cancelled) return;
      setReady(true);
      if (!session) {
        setHasSession(false);
        return;
      }
      setHasSession(true);
      await load(session.access_token);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!ready || !hasSession) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-8 sm:px-6">
      <div className={mypagePageCard('p-6 sm:p-8')}>
        <h2 className={`${MYPAGE_SECTION_TITLE} mb-1`}>Your reviews</h2>
        <p className="mb-6 text-sm text-slate-600">
          Includes reviews that are only visible to you when marked below.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-sm text-slate-500">You have not submitted a review yet.</p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="space-y-4">
            {rows.map((row) => {
              const d = reviewRowToDisplayData(row);
              if (!d) return null;
              return (
                <li key={d.id}>
                  <ReviewDisplayCard review={d} variant="list" showShadowBadge />
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
