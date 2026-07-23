'use client';

/**
 * AtoC 통합 Phase 2 — 인박스 리뷰 큐 (plan §3.1 A-6 + §3.3 안전장치).
 *
 * ops_email_parse_logs를 두 필터로 본다:
 *   · 리뷰 대기(기본): review_queued + failed — 사람 처리 필요
 *   · 전체: auto_committed 건도 'auto' 뱃지로 병행 표시 (§3.3 첫 2주 사후 검증)
 * 행 확장 → 마스킹 요약(이니셜·상품·날짜·사유·confidence) + 액션:
 *   [승인 커밋](원문 재fetch → approveMode 재커밋) / [무시] /
 *   미매핑 상품이면 tours 드롭다운 + join/private 선택 → [매핑+재커밋].
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, X } from 'lucide-react';
import { getOpsToken, kstTimeLabel } from '@/components/tour-ops/opsShared';

interface ReviewSummaryItem {
  lead_name?: string | null;
  party_size?: number | null;
  tour_date?: string | null;
  product_name?: string | null;
  pickup?: string | null;
  confidence?: number | null;
  commit_result?: string | null;
  reason?: string | null;
  external_booking_id?: string | null;
}

interface ReviewLog {
  id: string;
  channel: string | null;
  intent: string | null;
  message_id: string | null;
  confidence: number | null;
  commit_result: string | null;
  booking_id: string | null;
  external_booking_id: string | null;
  masked_summary: { items?: ReviewSummaryItem[] } | null;
  error: string | null;
  created_at: string;
}

interface TourOption {
  id: string;
  title: string;
  city?: string | null;
}

type Filter = 'review' | 'all';

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  review_queued: { label: '리뷰 대기', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' },
  auto_committed: { label: 'auto', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  cancelled: { label: '취소 처리', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200' },
  changed: { label: '변경 처리', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' },
  ignored: { label: '무시됨', cls: 'bg-slate-200 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400' },
};

export default function OpsReviewQueueView({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('review');
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tours, setTours] = useState<TourOption[]>([]);
  // 미매핑 해결 폼 상태 (expanded 행 전용)
  const [mapTourId, setMapTourId] = useState('');
  const [mapKind, setMapKind] = useState<'join' | 'private'>('join');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/admin/tour-ops/inbox-review?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setLogs((json.logs ?? []) as ReviewLog[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // tours 목록 (미매핑 해결 드롭다운) — 기존 manual-booking GET 재사용.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getOpsToken();
        const res = await fetch('/api/admin/tour-ops/manual-booking', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await res.json();
        if (!cancelled && res.ok) setTours((json.tours ?? []) as TourOption[]);
      } catch {
        /* 드롭다운 없이도 승인/무시는 동작 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const post = useCallback(
    async (payload: Record<string, unknown>, logId: string) => {
      setBusyId(logId);
      try {
        const token = await getOpsToken();
        const res = await fetch('/api/admin/tour-ops/inbox-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '처리 실패');
        toast.success(
          json.commit_result ? `처리 완료 — ${json.commit_result}` : '처리 완료',
        );
        await load();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '처리 실패');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const reviewCount = useMemo(
    () => logs.filter((l) => l.commit_result === 'review_queued' || l.commit_result === 'failed').length,
    [logs],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]" data-testid="ops-review-queue">
      <header
        className="border-b border-[var(--tr-hairline)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between">
          <h2 className="text-[15px] font-bold">인박스 리뷰 큐{reviewCount > 0 ? ` (${reviewCount})` : ''}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              aria-label="새로고침"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 pb-1">
          {(
            [
              { key: 'review', label: '리뷰 대기' },
              { key: 'all', label: '전체 (auto 포함)' },
            ] as Array<{ key: Filter; label: string }>
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`h-8 rounded-full px-3.5 text-[12px] font-semibold ${
                filter === key
                  ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                  : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2 pb-8">
        {loading && <p className="mt-16 text-center text-[13px] text-[var(--tr-ink-3)]">불러오는 중…</p>}
        {!loading && logs.length === 0 && (
          <p className="mt-16 text-center text-[13px] text-[var(--tr-ink-3)]">
            {filter === 'review' ? '리뷰 대기 항목이 없습니다. ✅' : '인박스 로그가 없습니다.'}
          </p>
        )}

        <ul className="space-y-1.5">
          {logs.map((log) => {
            const badge = RESULT_BADGE[log.commit_result ?? ''] ?? {
              label: log.commit_result ?? '-',
              cls: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]',
            };
            const items = log.masked_summary?.items ?? [];
            const first = items[0];
            const expanded = expandedId === log.id;
            const unmapped = items.some((i) => i.reason === 'unmapped_product' || i.reason === 'missing_product_name');
            const actionable = log.commit_result === 'review_queued' || log.commit_result === 'failed';
            return (
              <li key={log.id} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : log.id);
                    setMapTourId('');
                    setMapKind('join');
                  }}
                  className="w-full px-3 py-2.5 text-left"
                  aria-expanded={expanded}
                >
                  <p className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
                    <span className="rounded bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--tr-ink-2)]">
                      {log.channel ?? '?'}
                    </span>
                    <span className="text-[10px] text-[var(--tr-ink-3)]">{log.intent ?? '-'}</span>
                    {typeof log.confidence === 'number' && (
                      <span className="text-[10px] tabular-nums text-[var(--tr-ink-3)]">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="shrink-0 text-[10px] tabular-nums text-[var(--tr-ink-3)]">
                      {kstTimeLabel(log.created_at)}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-[13px] text-[var(--tr-ink)]">
                    {first
                      ? `${first.lead_name ?? '?'} · ${first.party_size ?? '?'}명 · ${first.product_name ?? '(상품명 없음)'} · ${first.tour_date ?? '(날짜 없음)'}`
                      : log.error ?? '(요약 없음)'}
                  </p>
                  {first?.reason && <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">사유: {first.reason}</p>}
                </button>

                {expanded && (
                  <div className="border-t border-[var(--tr-hairline)] px-3 py-2.5">
                    {items.map((item, i) => (
                      <p key={i} className="text-[12px] text-[var(--tr-ink-2)]">
                        #{i + 1} {item.lead_name ?? '?'} · {item.party_size ?? '?'}명 · {item.product_name ?? '-'} ·{' '}
                        {item.tour_date ?? '-'} · 픽업 {item.pickup ?? '-'} · ext {item.external_booking_id ?? '-'} →{' '}
                        {item.commit_result ?? '-'}
                        {item.reason ? ` (${item.reason})` : ''}
                      </p>
                    ))}

                    {actionable && unmapped && (
                      <div className="mt-2 rounded-lg bg-[var(--tr-surface-2)] p-2.5">
                        <p className="text-[11px] font-semibold text-[var(--tr-ink-2)]">
                          미매핑 상품 해결 — “{first?.product_name ?? ''}”
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <select
                            value={mapTourId}
                            onChange={(e) => setMapTourId(e.target.value)}
                            aria-label="투어 선택"
                            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[12px] text-[var(--tr-ink)]"
                          >
                            <option value="">투어 선택…</option>
                            {tours.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.city ? `[${t.city}] ` : ''}
                                {t.title}
                              </option>
                            ))}
                          </select>
                          <select
                            value={mapKind}
                            onChange={(e) => setMapKind(e.target.value === 'private' ? 'private' : 'join')}
                            aria-label="투어 종류"
                            className="h-9 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[12px] text-[var(--tr-ink)]"
                          >
                            <option value="join">조인(버스)</option>
                            <option value="private">프라이빗</option>
                          </select>
                          <button
                            type="button"
                            disabled={!mapTourId || busyId === log.id}
                            onClick={() =>
                              void post(
                                {
                                  action: 'map_product',
                                  logId: log.id,
                                  channel: log.channel,
                                  productNameRaw: first?.product_name ?? '',
                                  tourId: mapTourId,
                                  tourKind: mapKind,
                                },
                                log.id,
                              )
                            }
                            className="h-9 rounded-lg bg-blue-600 px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                          >
                            매핑 + 재커밋
                          </button>
                        </div>
                      </div>
                    )}

                    {actionable && (
                      <div className="mt-2 flex gap-1.5">
                        {!unmapped && (
                          <button
                            type="button"
                            disabled={busyId === log.id}
                            onClick={() => void post({ action: 'approve', logId: log.id }, log.id)}
                            className="h-9 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                          >
                            승인 커밋
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === log.id}
                          onClick={() => void post({ action: 'ignore', logId: log.id }, log.id)}
                          className="h-9 rounded-lg bg-[var(--tr-surface-2)] px-3 text-[12px] font-semibold text-[var(--tr-ink-2)] disabled:opacity-40"
                        >
                          무시
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
