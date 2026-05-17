'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Range = '7d' | '30d';
type Status = 'draft' | 'running' | 'paused' | 'concluded';

type ExperimentDetail = {
  experiment: {
    key: string;
    description: string | null;
    status: Status;
    variants: Array<{ key: string; weight: number; label?: string }>;
    primary_metric_funnel_key: string | null;
    start_date: string | null;
    end_date: string | null;
    conclusion_notes: string | null;
  };
  range: Range;
  start: string;
  conversion_event_name: string | null;
  variant_stats: Array<{
    key: string;
    label: string;
    weight: number;
    sessions: number;
    conversions: number;
    conversion_rate: number;
  }>;
  chi_square: { chi2: number; p: number | null } | null;
  summary: { events_scanned: number };
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}
function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  draft: { text: '초안', cls: 'bg-slate-100 text-slate-700' },
  running: { text: '실행 중', cls: 'bg-emerald-100 text-emerald-800' },
  paused: { text: '일시정지', cls: 'bg-amber-100 text-amber-800' },
  concluded: { text: '종료됨', cls: 'bg-slate-200 text-slate-600' },
};

export default function ExperimentDetailPage() {
  const params = useParams<{ key: string }>();
  const expKey = params?.key ? decodeURIComponent(params.key) : '';
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const refresh = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/experiments/${encodeURIComponent(expKey)}?range=${range}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<ExperimentDetail>;
      })
      .then((json) => setData(json))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!expKey) return;
    refresh();
  }, [expKey, range]);

  const updateStatus = async (status: Status) => {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/analytics/experiments/${encodeURIComponent(expKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const exp = data?.experiment;
  const variants = data?.variant_stats ?? [];
  const maxSessions = Math.max(...variants.map((v) => v.sessions), 1);
  const status = exp ? STATUS_LABEL[exp.status] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/analytics/product/experiments"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          ← 목록
        </Link>
        <h2 className="font-mono text-base font-semibold text-slate-900">{expKey}</h2>
        {status ? (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${status.cls}`}>
            {status.text}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {(['7d', '30d'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ' +
                (range === r
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {exp?.description ? <p className="text-xs text-slate-600">{exp.description}</p> : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {exp ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <span className="font-semibold text-slate-700">상태 변경:</span>
          {(['draft', 'running', 'paused', 'concluded'] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={savingStatus || exp.status === s}
              onClick={() => updateStatus(s)}
              className={
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ' +
                (exp.status === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {STATUS_LABEL[s].text}
            </button>
          ))}
          {exp.start_date ? (
            <span className="ml-2 text-slate-500">
              시작: {exp.start_date.slice(0, 10)}
            </span>
          ) : null}
          {exp.end_date ? <span className="text-slate-500">· 종료: {exp.end_date.slice(0, 10)}</span> : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Variant 분포 + 전환률
          </p>
          {data?.conversion_event_name ? (
            <p className="text-[10px] text-slate-500">
              conversion event: <span className="font-mono">{data.conversion_event_name}</span>
            </p>
          ) : (
            <p className="text-[10px] text-amber-600">
              primary metric 펀널 미설정 — 전환률 0
            </p>
          )}
        </div>
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-400">불러오는 중…</p>
        ) : variants.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">variant 정의 없음</p>
        ) : (
          <div className="space-y-3">
            {variants.map((v, idx) => {
              const widthPct = (v.sessions / maxSessions) * 100;
              return (
                <div key={v.key} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate font-mono font-semibold text-slate-900">
                      {v.key}
                      <span className="ml-1 text-slate-500">({v.label})</span>
                    </span>
                    <span className="text-slate-500">{v.weight}% 할당</span>
                    <span className="ml-auto text-slate-700">
                      <strong>{formatPct(v.conversion_rate)}</strong>{' '}
                      <span className="text-slate-400">
                        ({formatNumber(v.conversions)} / {formatNumber(v.sessions)})
                      </span>
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className={
                        'h-3 rounded-full ' +
                        (idx === 0 ? 'bg-slate-500' : 'bg-amber-500')
                      }
                      style={{ width: `${Math.max(widthPct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data?.chi_square ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            통계 유의성 (간이 카이제곱, df=1)
          </p>
          <p className="text-sm text-slate-800">
            χ² = <strong>{data.chi_square.chi2.toFixed(3)}</strong>
            {data.chi_square.p !== null ? (
              <>
                {' · '}
                p {'<'}{' '}
                <strong>{data.chi_square.p}</strong>{' '}
                {data.chi_square.p <= 0.05 ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    유의함
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    유의차 없음
                  </span>
                )}
              </>
            ) : (
              <span className="ml-2 text-slate-500">(샘플 부족 — 각 셀 5 미만)</span>
            )}
          </p>
          <p className="mt-2 text-[10px] text-slate-500">
            * 첫 variant를 control로, 두 번째 variant를 challenger로 비교. 3+ variants는 별도 트랙.
          </p>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        스캔된 이벤트: {formatNumber(data?.summary.events_scanned ?? 0)}. variant 할당은
        anonymous_id + experiment_key 안정 해시로 결정되며 같은 사용자는 항상 같은 variant.
      </p>
    </div>
  );
}
