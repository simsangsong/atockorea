'use client';

/**
 * 오토파일럿 — 제안 큐 (관제 W5).
 *
 * 🔴 이 화면은 **아무것도 실행하지 않는다.** 향후 2주를 점검해 "사람이 봐야 할
 * 것"을 목록으로 만들고, 각 항목은 그 일을 하는 화면으로 보낼 뿐이다. 자동 배정·
 * 자동 발송은 MVP에서 제외했다 — 잘못되면 손님에게 직접 노출되고, 그 비용이
 * 자동화의 이득보다 크다(설계안 §1-7).
 *
 * [처리함]/[무시]는 사후 기록이다. 한 번 처리한 항목은 재점검이 되살리지 않는다 —
 * 무시한 항목이 매번 돌아오면 큐 전체를 안 보게 된다.
 */

import { useCallback, useEffect, useState } from 'react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Bus, Check, Loader2, Receipt, RefreshCw, Send, UserX, Wallet, X } from 'lucide-react';
import { getOpsToken } from '@/components/tour-ops/opsShared';
import { ACTION_LABEL, KIND_LABEL, actionHref, type SuggestionKind } from '@/lib/ops/autopilot/detectors';

interface SuggestionRow {
  id: string;
  kind: SuggestionKind;
  severity: 'high' | 'medium' | 'low';
  subject_key: string;
  tour_date: string | null;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  status: 'suggested' | 'done' | 'dismissed';
  resolved_by: string | null;
}

const KIND_ICON: Record<SuggestionKind, typeof UserX> = {
  guide_unassigned: UserX,
  vehicle_unassigned: Bus,
  capacity_over: AlertTriangle,
  rate_missing: Wallet,
  settlement_pending: Receipt,
  guest_message_pending: Send,
};

const SEVERITY_TONE: Record<SuggestionRow['severity'], string> = {
  high: 'border-[var(--tr-danger-soft)] bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]   ',
  medium:
    'border-[var(--tr-warn-soft)] bg-[var(--tr-warn-soft)] text-[var(--tr-warn)]   ',
  low: 'border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]',
};

export default function OpsAutopilotView({ onClose }: { onClose: () => void }) {
  // O5 — Escape closes this overlay. It covers the whole screen, and on the
  // desktop the board actually runs on, 닫기 was the only way out.
  useEscapeClose(onClose);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getOpsToken();
      const res = await fetch(`/api/admin/tour-ops/autopilot?status=${showResolved ? 'all' : 'suggested'}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setRows(json.data as SuggestionRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = useCallback(async () => {
    setRunning(true);
    try {
      const token = await getOpsToken();
      const res = await fetch('/api/admin/tour-ops/autopilot', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '점검 실패');
      setLastRun(`향후 ${json.horizonDays}일 · 발견 ${json.found}건 · 새 항목 ${json.created}건`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '점검 실패');
    } finally {
      setRunning(false);
    }
  }, [load]);

  const setStatus = useCallback(
    async (row: SuggestionRow, status: 'done' | 'dismissed' | 'suggested') => {
      setBusyId(row.id);
      try {
        const token = await getOpsToken();
        const res = await fetch(`/api/admin/tour-ops/autopilot/${row.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '처리 실패');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '처리 실패');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const open = rows.filter((r) => r.status === 'suggested');

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--tr-canvas)] text-[var(--tr-ink)]"
      data-testid="ops-autopilot"
    >
      <header
        className="border-b border-[var(--tr-hairline)] px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="flex min-h-[40px] items-center justify-between gap-2">
          <h2 className="text-cjk-safe tr-body font-bold">오토파일럿</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              aria-label="새로고침"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
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

        <p className="text-cjk-body mt-0.5 tr-meta leading-relaxed text-[var(--tr-ink-3)]">
          자동으로 배정하거나 발송하지 않습니다. 향후 2주를 점검해 <b>사람이 볼 것</b>만 모읍니다.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running}
            className="text-cjk-safe flex h-10 items-center gap-1.5 rounded-lg bg-[var(--tr-ink)] px-3 tr-label font-bold text-[var(--tr-canvas)] disabled:opacity-60"
            data-testid="autopilot-run"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="text-cjk-safe">지금 점검</span>
          </button>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            aria-pressed={showResolved}
            className={`text-cjk-safe h-10 rounded-lg px-3 tr-label font-semibold ${
              showResolved ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]' : 'text-[var(--tr-ink-3)]'
            }`}
          >
            처리한 것도 보기
          </button>
          <span className="ml-auto tr-meta font-semibold tabular-nums text-[var(--tr-ink-2)]">
            처리할 항목 {open.length}
          </span>
        </div>
        {lastRun && <p className="mt-1 tr-meta text-[var(--tr-ink-3)]">{lastRun}</p>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && rows.length === 0 ? (
          <p className="py-12 text-center tr-card-text text-[var(--tr-ink-3)]">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-cjk-body py-12 text-center tr-card-text text-[var(--tr-ink-3)]">
            처리할 항목이 없습니다. [지금 점검]으로 향후 2주를 확인해 보세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const Icon = KIND_ICON[row.kind] ?? AlertTriangle;
              const resolved = row.status !== 'suggested';
              return (
                <li
                  key={row.id}
                  className={`flex items-start gap-3 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 ${
                    resolved ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${SEVERITY_TONE[row.severity]}`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-cjk-body tr-card-text font-bold">{row.title}</p>
                    {row.detail && (
                      <p className="text-cjk-body mt-0.5 tr-meta leading-relaxed text-[var(--tr-ink-3)]">
                        {row.detail}
                      </p>
                    )}
                    <p className="mt-0.5 tr-meta text-[var(--tr-ink-3)]">
                      {KIND_LABEL[row.kind] ?? row.kind}
                      {resolved && row.resolved_by ? ` · ${row.status === 'done' ? '처리' : '무시'} ${row.resolved_by}` : ''}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Link
                        href={actionHref(row)}
                        className="text-cjk-safe rounded-md border border-[var(--tr-hairline)] px-2 py-1 tr-meta font-semibold text-[var(--tr-ink-2)]"
                      >
                        {ACTION_LABEL[row.kind] ?? '화면으로'} →
                      </Link>
                      {resolved ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row, 'suggested')}
                          className="text-cjk-safe rounded-md border border-[var(--tr-hairline)] px-2 py-1 tr-meta font-semibold text-[var(--tr-ink-3)] disabled:opacity-50"
                        >
                          되돌리기
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'done')}
                            className="text-cjk-safe flex items-center gap-1 rounded-md border border-[var(--tr-hairline)] px-2 py-1 tr-meta font-semibold text-[var(--tr-safe)] disabled:opacity-50"
                          >
                            <Check className="size-3" />
                            <span className="text-cjk-safe">처리함</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'dismissed')}
                            className="text-cjk-safe flex items-center gap-1 rounded-md border border-[var(--tr-hairline)] px-2 py-1 tr-meta font-semibold text-[var(--tr-ink-3)] disabled:opacity-50"
                          >
                            <X className="size-3" />
                            <span className="text-cjk-safe">무시</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
