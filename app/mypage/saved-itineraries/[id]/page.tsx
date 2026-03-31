'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { generatedItineraryResponseSchema, type GeneratedItineraryResponse } from '@/lib/itinerary/types';
import { ItineraryResult } from '@/components/itinerary/ItineraryResult';
import { MYPAGE_SUBTITLE, MYPAGE_TITLE, mypagePageCard } from '@/lib/mypage-ui';

export default function SavedItineraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations();
  const [data, setData] = useState<GeneratedItineraryResponse | null>(null);
  const [requestJson, setRequestJson] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const session = await supabase?.auth.getSession().then((r) => r.data.session);
        if (!session?.access_token) {
          router.push(`/signin?redirect=/mypage/saved-itineraries/${id}`);
          return;
        }
        const res = await fetch(`/api/saved-itineraries/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Not found');
        setRequestJson(
          body.requestJson && typeof body.requestJson === 'object'
            ? (body.requestJson as Record<string, unknown>)
            : null,
        );
        const parsed = generatedItineraryResponseSchema.safeParse(body.itineraryJson);
        if (!parsed.success) {
          throw new Error('Stored itinerary is in an unexpected format.');
        }
        setData(parsed.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <div className={mypagePageCard('p-6')}>
        <p className="text-neutral-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={mypagePageCard('p-6')}>
        <p className="text-red-600 text-sm mb-4">{error ?? 'Not found'}</p>
        <Link href="/mypage/saved-itineraries" className="text-sm underline underline-offset-2">
          Back to saved itineraries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={mypagePageCard('p-6')}>
        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
          {t('mypage.savedItineraries')}
        </p>
        <h1 className={`${MYPAGE_TITLE} mb-2`}>{data.tourTitle}</h1>
        <p className={MYPAGE_SUBTITLE}>
          <Link href="/mypage/saved-itineraries" className="underline underline-offset-2">
            ← Back to list
          </Link>
        </p>
      </div>

      {requestJson && (
        <details className="rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm">
          <summary className="cursor-pointer text-neutral-600 font-medium">Original request (JSON)</summary>
          <pre className="mt-3 text-xs overflow-x-auto text-neutral-700 whitespace-pre-wrap break-words">
            {JSON.stringify(requestJson, null, 2)}
          </pre>
        </details>
      )}

      <ItineraryResult data={data} requestPayload={requestJson} showSaveAction={false} />
    </div>
  );
}
