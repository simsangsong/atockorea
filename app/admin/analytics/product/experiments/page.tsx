'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Experiment = {
  key: string;
  description: string | null;
  status: 'draft' | 'running' | 'paused' | 'concluded';
  variants: Array<{ key: string; weight: number; label?: string }>;
  primary_metric_funnel_key: string | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<Experiment['status'], { text: string; cls: string }> = {
  draft: { text: '초안', cls: 'bg-slate-100 text-slate-700' },
  running: { text: '실행 중', cls: 'bg-emerald-100 text-emerald-800' },
  paused: { text: '일시정지', cls: 'bg-amber-100 text-amber-800' },
  concluded: { text: '종료됨', cls: 'bg-slate-200 text-slate-600' },
};

export default function ExperimentsListPage() {
  const [list, setList] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [variantA, setVariantA] = useState({ key: 'A', weight: 50, label: 'Control' });
  const [variantB, setVariantB] = useState({ key: 'B', weight: 50, label: 'Challenger' });
  const [funnelKey, setFunnelKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/analytics/experiments')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => setList(json.experiments ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/analytics/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          description: newDesc.trim() || undefined,
          status: 'draft',
          variants: [variantA, variantB],
          primary_metric_funnel_key: funnelKey.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `HTTP ${res.status}`);
      }
      setShowCreate(false);
      setNewKey('');
      setNewDesc('');
      setFunnelKey('');
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          A/B 실험 — `analytics_experiments` 테이블에 정의. 활성 실험은 클라이언트 SDK가 자동으로
          모든 이벤트에 variant를 첨부.
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-slate-900 inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium text-white hover:bg-slate-700"
        >
          {showCreate ? '취소' : '+ 새 실험'}
        </button>
      </div>

      {showCreate ? (
        <div className="space-y-3 rounded-lg border border-admin-border bg-admin-surface p-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">key (snake-case)</label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="home_sticky_threshold"
              className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-base font-mono focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">설명</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="StickyHomeCta noseong threshold A/B"
              className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-base focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-admin-border p-2">
              <p className="text-xs font-semibold text-slate-500">Variant A (control)</p>
              <input
                type="text"
                value={variantA.key}
                onChange={(e) => setVariantA({ ...variantA, key: e.target.value })}
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm font-mono"
                placeholder="key"
              />
              <input
                type="text"
                value={variantA.label}
                onChange={(e) => setVariantA({ ...variantA, label: e.target.value })}
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm"
                placeholder="label"
              />
              <input
                type="number"
                value={variantA.weight}
                onChange={(e) =>
                  setVariantA({ ...variantA, weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm"
                placeholder="weight (0-100)"
              />
            </div>
            <div className="rounded-md border border-admin-border p-2">
              <p className="text-xs font-semibold text-slate-500">Variant B (challenger)</p>
              <input
                type="text"
                value={variantB.key}
                onChange={(e) => setVariantB({ ...variantB, key: e.target.value })}
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm font-mono"
              />
              <input
                type="text"
                value={variantB.label}
                onChange={(e) => setVariantB({ ...variantB, label: e.target.value })}
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm"
              />
              <input
                type="number"
                value={variantB.weight}
                onChange={(e) =>
                  setVariantB({ ...variantB, weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">
              primary metric (펀널 key, 선택)
            </label>
            <input
              type="text"
              value={funnelKey}
              onChange={(e) => setFunnelKey(e.target.value)}
              placeholder="matcher_funnel"
              className="mt-1 w-full rounded-md border border-admin-border min-h-11 px-3 text-base font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              funnel의 마지막 단계 event를 conversion event로 사용.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            weight 합계는 정확히 100이어야 합니다 ({variantA.weight + variantB.weight}/100).
          </p>
          {createError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {createError}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || variantA.weight + variantB.weight !== 100 || !newKey}
              className="rounded-md bg-slate-900 inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? '생성 중…' : '생성 (status=draft)'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-md border border-admin-border bg-admin-surface p-6 text-center text-sm text-slate-400">
            불러오는 중…
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-admin-surface p-6 text-center text-sm text-slate-500">
            아직 실험이 없습니다. `+ 새 실험`으로 시작.
          </div>
        ) : (
          list.map((exp) => {
            const status = STATUS_LABEL[exp.status];
            return (
              <Link
                key={exp.key}
                href={`/admin/analytics/product/experiments/${encodeURIComponent(exp.key)}`}
                className="block rounded-lg border border-admin-border bg-admin-surface p-4 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-slate-900">{exp.key}</p>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.text}
                      </span>
                    </div>
                    {exp.description ? (
                      <p className="mt-1 text-xs text-slate-600">{exp.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {exp.variants.map((v) => `${v.key}(${v.weight}%)`).join(' / ')}{' '}
                      {exp.primary_metric_funnel_key
                        ? `· metric: ${exp.primary_metric_funnel_key}`
                        : null}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">→</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
