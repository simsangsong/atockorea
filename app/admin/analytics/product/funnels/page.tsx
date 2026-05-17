'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type FunnelListItem = {
  key: string;
  name: string;
  description: string | null;
  step_count: number;
  conversion_window_seconds: number;
  updated_at: string;
};

export default function FunnelsListPage() {
  const [funnels, setFunnels] = useState<FunnelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/admin/analytics/funnels')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setFunnels(json.funnels ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        펀널 정의(`analytics_funnels` 테이블) — Phase 1에서 5개 시드. 클릭 시 단계별 전환률 + breakdown 보기.
      </p>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            불러오는 중…
          </div>
        ) : funnels.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            펀널이 정의되어 있지 않습니다.
          </div>
        ) : (
          funnels.map((f) => (
            <Link
              key={f.key}
              href={`/admin/analytics/product/funnels/${encodeURIComponent(f.key)}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                  {f.description ? (
                    <p className="mt-1 text-xs text-slate-600">{f.description}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-slate-500">
                    {f.step_count} steps · 전환 window {f.conversion_window_seconds}s
                  </p>
                </div>
                <div className="text-[11px] text-slate-400">→</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
