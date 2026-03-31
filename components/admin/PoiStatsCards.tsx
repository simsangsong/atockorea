'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

type Stats = {
  total: number;
  hidden: number;
  missingImage: number;
  missingUseTime: number;
  withAdminNoteKo: number;
  boostedCount: number;
  regionCounts: Record<string, number>;
  topByScore: { id: number; title: string | null; base_score: number | null; region_group: string | null }[];
};

export function PoiStatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/pois/stats');
        const data = await res.json();
        if (!res.ok) {
          const raw =
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : 'Stats request failed';
          const code = typeof data.code === 'string' ? ` [${data.code}]` : '';
          throw new Error(`${raw}${code}`);
        }
        setStats(data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
  }, []);

  if (err) {
    const looksSchema =
      /column|relation|PGRST|schema|migrat/i.test(err) ||
      err.includes('42P01') ||
      err.includes('42703');
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3 space-y-1">
        <p>Stats unavailable: {err}</p>
        {looksSchema ? (
          <p className="text-amber-800/90 text-xs">
            If this mentions missing tables/columns, apply the latest Supabase migrations.
          </p>
        ) : null}
      </div>
    );
  }
  if (!stats) {
    return <div className="text-slate-500 text-sm">Loading stats…</div>;
  }

  const cards = [
    { label: 'Total POIs', value: stats.total },
    { label: 'Hidden', value: stats.hidden },
    { label: 'Boosted (gen)', value: stats.boostedCount ?? 0 },
    { label: 'Missing image', value: stats.missingImage },
    { label: 'Missing hours text', value: stats.missingUseTime },
    { label: 'With admin note (KO)', value: stats.withAdminNoteKo },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">By region</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            {Object.entries(stats.regionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Top base_score (preview)</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            {stats.topByScore.slice(0, 10).map((t) => (
              <li key={t.id} className="truncate">
                {t.title} — {t.base_score != null ? String(t.base_score) : '—'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
