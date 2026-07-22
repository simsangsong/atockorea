'use client';

/**
 * POI-video review queue (video W3 / VP-D10 approval gate).
 *
 * Every render uploaded by `npm run video:upload` lands here as
 * pending_review. The admin watches the actual MP4 inline (native <video>,
 * public Storage URL), sees the QC summary, and approves or rejects per
 * language. Only approved rows serve in arrival cards; approving supersedes
 * any older approved version of the same (poi_key, language) server-side.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, RotateCcw, Clapperboard, RefreshCw } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

type VideoStatus = 'pending_review' | 'approved' | 'rejected';

interface VideoRow {
  id: string;
  poi_key: string;
  language: string;
  version: number;
  video_url: string;
  poster_url: string | null;
  duration_seconds: number | null;
  status: VideoStatus;
  qc: { checks?: Array<{ name: string; status: string; detail: string }> } | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const TABS: Array<{ key: VideoStatus | 'all'; label: string }> = [
  { key: 'pending_review', label: '검수 대기' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '거절됨' },
  { key: 'all', label: '전체' },
];

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
}

function qcBadge(row: VideoRow): { label: string; tone: string } {
  const checks = row.qc?.checks ?? [];
  const failed = checks.filter((c) => c.status === 'failed').length;
  const warned = checks.filter((c) => c.status === 'warning').length;
  if (failed > 0) return { label: `QC 실패 ${failed}`, tone: 'bg-red-100 text-red-700' };
  if (warned > 0) return { label: `QC 경고 ${warned}`, tone: 'bg-amber-100 text-amber-700' };
  return { label: 'QC 통과', tone: 'bg-emerald-100 text-emerald-700' };
}

export default function PoiVideosPage() {
  const [tab, setTab] = useState<VideoStatus | 'all'>('pending_review');
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: VideoStatus | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/poi-videos?status=${status}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const setStatus = useCallback(
    async (row: VideoRow, status: VideoStatus) => {
      setBusyId(row.id);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/poi-videos/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        await load(tab);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [load, tab],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, VideoRow[]>();
    for (const row of rows) {
      const key = `${row.poi_key} · v${row.version}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(row);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Clapperboard size={24} className="text-stone-700" aria-hidden />
        <div>
          <h1 className="text-xl font-bold text-stone-900">POI 동영상 검수</h1>
          <p className="text-sm text-stone-500">승인한 렌더만 도착 카드에 서빙됩니다 (언어별 최신 승인 1건).</p>
        </div>
        <button
          type="button"
          onClick={() => void load(tab)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw size={14} aria-hidden /> 새로고침
        </button>
      </div>

      <div className="mb-5 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              tab === t.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="py-16 text-center text-sm text-stone-500">불러오는 중…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-stone-500">이 상태의 동영상이 없습니다.</p>
      ) : null}

      <div className="flex flex-col gap-8">
        {grouped.map(([groupKey, groupRows]) => (
          <section key={groupKey}>
            <h2 className="mb-3 text-sm font-bold text-stone-800">{groupKey}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {groupRows.map((row) => {
                const badge = qcBadge(row);
                return (
                  <div key={row.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                    <video
                      src={row.video_url}
                      poster={row.poster_url ?? undefined}
                      controls
                      playsInline
                      preload="none"
                      className="aspect-[9/16] w-full bg-black object-contain"
                    />
                    <div className="flex flex-col gap-2 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-900">{row.language}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>{badge.label}</span>
                      </div>
                      {row.duration_seconds ? (
                        <p className="text-xs text-stone-500">{Math.round(row.duration_seconds)}초 · {new Date(row.created_at).toLocaleDateString('ko-KR')}</p>
                      ) : null}
                      {row.status === 'pending_review' ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'approved')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Check size={14} aria-hidden /> 승인
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'rejected')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-300 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                          >
                            <X size={14} aria-hidden /> 거절
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${row.status === 'approved' ? 'text-emerald-700' : 'text-stone-500'}`}>
                            {row.status === 'approved' ? '승인됨' : '거절됨'}
                            {row.reviewed_by ? ` · ${row.reviewed_by}` : ''}
                          </span>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'pending_review')}
                            className="flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                          >
                            <RotateCcw size={12} aria-hidden /> 대기로
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
