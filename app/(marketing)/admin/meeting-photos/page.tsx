'use client';

/**
 * SG-4d — the meeting-photo review queue (/admin/meeting-photos).
 *
 * facility_pins' is_verified discipline, cloned: drivers capture, this page
 * verifies, and ONLY verified photos reach the free-time/rally hero band.
 * The reviewer sees exactly what a guest would (the public URL) and decides
 * in one tap. 주 1회 배치 리듬을 권장 (F-8 — 매일 돌리면 막힌다).
 */
import { useCallback, useEffect, useState } from 'react';

interface QueueRow {
  poi_key: string;
  meeting_point: string | null;
  meeting_photo_path: string | null;
  meeting_photo_status: string;
  meeting_photo_meta: Record<string, unknown> | null;
  updated_at: string;
  photo_url: string | null;
}

export default function MeetingPhotosAdminPage() {
  const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: 'pending' | 'verified' | 'rejected') => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/meeting-photos?status=${which}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setRows(body.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  const decide = async (poiKey: string, decision: 'verified' | 'rejected') => {
    setBusyKey(poiKey);
    try {
      const res = await fetch('/api/admin/meeting-photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poi_key: poiKey, status: decision }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((prev) => prev.filter((row) => row.poi_key !== poiKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="text-cjk-body mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">집합장소 사진 검수</h1>
      <p className="text-cjk-body mt-1 text-sm text-gray-500">
        기사가 현장에서 찍은 집합장소 사진입니다. 승인된 사진만 손님의 자유시간·집합 카드에 보입니다.
      </p>

      <div className="text-cjk-safe mt-4 flex gap-2">
        {(['pending', 'verified', 'rejected'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`text-cjk-safe rounded-full px-3 py-1.5 text-sm font-semibold ${
              status === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {key === 'pending' ? `대기 (${status === 'pending' ? rows.length : '…'})` : key === 'verified' ? '승인됨' : '반려됨'}
          </button>
        ))}
      </div>

      {error && <p className="text-cjk-body mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!error && rows.length === 0 && (
        <p className="mt-8 text-sm text-gray-400">이 상태의 사진이 없습니다.</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.poi_key} className="overflow-hidden rounded-2xl border border-gray-200">
            {row.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.photo_url} alt={row.poi_key} className="h-44 w-full object-cover" />
            )}
            <div className="px-4 py-3">
              <p className="font-semibold">{row.poi_key}</p>
              {row.meeting_point && <p className="text-sm text-gray-600">{row.meeting_point}</p>}
              <p className="mt-0.5 text-xs text-gray-400">
                {String((row.meeting_photo_meta as { captured_by_role?: string } | null)?.captured_by_role ?? '')}{' '}
                · {new Date(row.updated_at).toLocaleString('ko-KR')}
              </p>
              {status === 'pending' && (
                <div className="text-cjk-safe mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busyKey === row.poi_key}
                    onClick={() => void decide(row.poi_key, 'verified')}
                    className="text-cjk-safe flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    승인 — 손님에게 공개
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === row.poi_key}
                    onClick={() => void decide(row.poi_key, 'rejected')}
                    className="text-cjk-safe flex-1 rounded-lg bg-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
                  >
                    반려
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
