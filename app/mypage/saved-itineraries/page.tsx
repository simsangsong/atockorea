'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { TrashIcon } from '@/components/Icons';
import { MYPAGE_SUBTITLE, MYPAGE_TITLE, mypagePageCard } from '@/lib/mypage-ui';

type ListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  summary: string | null;
  isFavorite: boolean;
  tourTitle: string | null;
  stopCount: number;
};

export default function SavedItinerariesPage() {
  const router = useRouter();
  const t = useTranslations();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase?.auth.getSession().then((r) => r.data.session);
      if (!session?.access_token) {
        router.push('/signin?redirect=/mypage/saved-itineraries');
        return;
      }
      const res = await fetch('/api/saved-itineraries', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFavorite = async (id: string, next: boolean) => {
    const session = await supabase?.auth.getSession().then((r) => r.data.session);
    if (!session?.access_token) return;
    const res = await fetch(`/api/saved-itineraries/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ isFavorite: next }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, isFavorite: next } : it)),
      );
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this saved itinerary?')) return;
    const session = await supabase?.auth.getSession().then((r) => r.data.session);
    if (!session?.access_token) return;
    const res = await fetch(`/api/saved-itineraries/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  return (
    <div className={mypagePageCard('p-6')}>
      <h1 className={`${MYPAGE_TITLE} mb-2`}>{t('mypage.savedItineraries')}</h1>
      <p className={`${MYPAGE_SUBTITLE} mb-8`}>
        Jeju itineraries you saved from the generator (request + result stored).
      </p>

      {loading && <p className="text-neutral-500 text-sm">Loading…</p>}
      {error && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-neutral-500 text-sm">
          Nothing saved yet.{' '}
          <Link href="/itinerary" className="underline underline-offset-2 text-neutral-800">
            Generate an itinerary
          </Link>{' '}
          and use &quot;Save to my account&quot;.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 px-4 py-3"
          >
            <div>
              <Link
                href={`/mypage/saved-itineraries/${it.id}`}
                className="font-medium text-neutral-900 hover:underline"
              >
                {it.title || it.tourTitle || 'Untitled itinerary'}
              </Link>
              <p className="text-xs text-neutral-500 mt-1">
                {it.stopCount} stops · {new Date(it.createdAt).toLocaleString()}
              </p>
              {it.summary && (
                <p className="text-sm text-neutral-600 mt-2 line-clamp-2">{it.summary}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={it.isFavorite}
                  onChange={(e) => void toggleFavorite(it.id, e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Favorite
              </label>
              <button
                type="button"
                onClick={() => void remove(it.id)}
                className="p-2 rounded-xl text-neutral-500 hover:text-red-600 hover:bg-red-50"
                aria-label="Delete"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
