'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PoiStatsCards } from '@/components/admin/PoiStatsCards';
import { adminFetch } from '@/lib/admin-fetch';

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

type Row = {
  id: number;
  content_id: string;
  title: string | null;
  region_group: string | null;
  manual_hidden: boolean | null;
  base_score: number | null;
  manual_boost_score: number | null;
  first_image: string | null;
};

export default function AdminPoisPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [hidden, setHidden] = useState<'all' | 'true' | 'false'>('all');
  const [sort, setSort] = useState('base_score');
  const [boostedOnly, setBoostedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 30;
  const filtersRef = useRef({ search, region, hidden, sort, boostedOnly });
  filtersRef.current = { search, region, hidden, sort, boostedOnly };

  const load = useCallback(async (off: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const f = filtersRef.current;
      const p = new URLSearchParams();
      if (f.search.trim()) p.set('search', f.search.trim());
      if (f.region) p.set('region_group', f.region);
      if (f.hidden !== 'all') p.set('manual_hidden', f.hidden);
      if (f.boostedOnly) p.set('boosted', '1');
      p.set('sort', f.sort);
      p.set('limit', String(limit));
      p.set('offset', String(off));
      const res = await adminFetch(`/api/admin/pois?${p.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        const raw =
          typeof data.message === 'string'
            ? data.message
            : typeof data.error === 'string'
              ? data.error
              : 'Failed to load POIs';
        const code = typeof data.code === 'string' ? ` [${data.code}]` : '';
        throw new Error(`${raw}${code}`);
      }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
      setRows([]);
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load(offset);
  }, [offset, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Jeju POI (Tour API)</h1>
        <p className="text-slate-600 text-sm mt-1">
          Edit operator notes, short descriptions, scores, and visibility. Data source:{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">jeju_kor_tourapi_places</code>
        </p>
      </div>

      <PoiStatsCards />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm px-4 py-3">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm text-slate-600">
          Search
          <input
            className="mt-1 block border border-slate-200 rounded-lg px-3 py-2 text-sm w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setOffset(0);
                load(0);
              }
            }}
            placeholder="title / address"
          />
        </label>
        <label className="text-sm text-slate-600">
          Region
          <select
            className="mt-1 block border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">All</option>
            <option value="east">east</option>
            <option value="west">west</option>
            <option value="south">south</option>
            <option value="city">city</option>
            <option value="udo">udo</option>
            <option value="etc">etc</option>
          </select>
        </label>
        <label className="block text-sm text-slate-600">
          Boosted only
          <select
            className="mt-1 block border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={boostedOnly ? 'yes' : 'no'}
            onChange={(e) => setBoostedOnly(e.target.value === 'yes')}
          >
            <option value="no">All</option>
            <option value="yes">manual_boost_score &gt; 0</option>
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Hidden
          <select
            className="mt-1 block border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={hidden}
            onChange={(e) => setHidden(e.target.value as 'all' | 'true' | 'false')}
          >
            <option value="all">All</option>
            <option value="true">Hidden only</option>
            <option value="false">Visible</option>
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Sort
          <select
            className="mt-1 block border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="base_score">base_score</option>
            <option value="manual_priority">manual_priority</option>
            <option value="manual_boost_score">manual_boost_score</option>
            <option value="updated_at">updated_at</option>
            <option value="title">title</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setOffset(0);
            load(0);
          }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Boost</th>
                  <th className="px-4 py-3 font-medium">Hidden</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                      num(r.manual_boost_score) > 0 ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{r.title}</td>
                    <td className="px-4 py-2">{r.region_group ?? '—'}</td>
                    <td className="px-4 py-2">{r.base_score != null ? String(r.base_score) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {num(r.manual_boost_score) > 0 ? (
                        <span className="text-amber-800 font-medium">{String(r.manual_boost_score)}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="px-4 py-2">{r.manual_hidden ? 'yes' : 'no'}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/pois/${r.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm text-slate-600">
          <span>
            Total {total} · showing {rows.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset((o) => o + limit)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
