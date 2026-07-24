'use client';

/**
 * /admin/guide-settlements — 가이드 월 정산 (§6.9).
 *
 * 월을 고르고 [정산 실행]을 누르면 그 달의 status='worked' 배정을 집계해
 * 가이드별 3.3% 원천징수 스냅샷을 만든다. 화면이 지켜야 할 사실 세 가지:
 *
 *   1. **용역대가와 실비변상은 다른 줄이다.** 실비는 원천징수 대상이 아니고,
 *      한 칸에 합쳐 보이면 다음 사람이 반드시 gross에 합산해 버린다.
 *   2. **[지급 완료]는 이체 버튼이 아니다.** 사람이 은행에서 보낸 뒤 남기는
 *      기록이고, 누르는 순간 금액이 잠긴다.
 *   3. 단가를 못 찾은 배정은 0원으로 조용히 넘어가지 않고 경고로 뜬다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calculator,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { ConfirmSheet } from '@/components/admin/ConfirmSheet';
import { TAX_FORM_KEYS, TAX_FORM_LABELS, type TaxFormKey } from '@/lib/ops/tax/forms';

interface SettlementRow {
  id: string;
  guide_id: string;
  guide_name: string | null;
  period: string;
  gross_krw: number;
  income_tax_krw: number;
  local_tax_krw: number;
  withheld_krw: number;
  net_krw: number;
  reimbursement_krw: number;
  payout_krw: number;
  assignment_count: number;
  status: string;
  paid_at: string | null;
  paid_note: string | null;
}

interface Summary {
  guideCount: number;
  grossKrw: number;
  withheldKrw: number;
  netKrw: number;
  reimbursementKrw: number;
  payoutKrw: number;
  assignmentCount: number;
  unpaidKrw: number;
}

interface Unresolved {
  assignmentId: string;
  guideId: string;
  tourDate: string;
  tourType: string;
}

function currentKstPeriod(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function krw(n: number): string {
  return `₩${Math.round(n || 0).toLocaleString('ko-KR')}`;
}

const STATUS_LABEL: Record<string, string> = { draft: '초안', confirmed: '확인', paid: '지급 완료' };
const STATUS_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-sky-100 text-sky-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAdminAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
}

export default function GuideSettlementsPage() {
  const [period, setPeriod] = useState(currentKstPeriod());
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unresolved, setUnresolved] = useState<Unresolved[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/guide-settlements?period=${encodeURIComponent(period)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '정산 목록을 불러오지 못했습니다.');
      setRows(json.data ?? []);
      setSummary(json.summary ?? null);
      setTableMissing(Boolean(json.tableMissing));
      setUnresolved([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await authedFetch('/api/admin/guide-settlements', {
        method: 'POST',
        body: JSON.stringify({ period }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '정산 실행에 실패했습니다.');
      setRows(json.data ?? []);
      setSummary(json.summary ?? null);
      setUnresolved(json.unresolved ?? []);
      if ((json.ledgerErrors ?? []).length > 0) {
        toast.warning('정산은 저장됐지만 원장 기입에 실패한 건이 있습니다. 로그를 확인하세요.');
      }
      toast.success(json.message || '정산했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '정산 실행에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  }, [period]);

  const patch = useCallback(
    async (row: SettlementRow, body: Record<string, unknown>, successMessage: string) => {
      setBusyId(row.id);
      try {
        const res = await authedFetch(`/api/admin/guide-settlements/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || '저장하지 못했습니다.');
        toast.success(json.message || successMessage);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '저장하지 못했습니다.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  // 실비 입력은 인라인 편집이다 — window.prompt는 iOS WebView에서 조용히 통과되고,
  // 금액을 다루는 칸에서 그건 사고다(admin ConfirmSheet가 기록한 그 사고 패턴).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const saveReimbursement = useCallback(
    (row: SettlementRow) => {
      const value = Number(editingValue.replace(/[, ₩]/g, ''));
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        toast.error('0 이상의 정수(원)를 입력해 주세요.');
        return;
      }
      setEditingId(null);
      void patch(row, { reimbursementKrw: value }, '실비변상을 저장했습니다.');
    },
    [editingValue, patch],
  );

  // 지급 완료는 되돌릴 수 없는 기록이라 시트로 확인받는다(금액 + 경고 노출).
  const [payTarget, setPayTarget] = useState<SettlementRow | null>(null);
  const [payNote, setPayNote] = useState('');

  // 연간 서식만 'YYYY'를 받는다 — 나머지는 그 달 그대로.
  const formHref = useMemo(
    () => (form: TaxFormKey) =>
      `/admin/guide-settlements/${encodeURIComponent(form === 'annual' ? period.slice(0, 4) : period)}/forms/${form}`,
    [period],
  );

  const downloadCsv = useCallback(
    async (form: TaxFormKey) => {
      try {
        const key = form === 'annual' ? period.slice(0, 4) : period;
        const res = await authedFetch(
          `/api/admin/guide-settlements/${encodeURIComponent(key)}/forms/${form}?format=csv`,
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.message || 'CSV를 만들지 못했습니다.');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `atockorea-${form}-${key}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'CSV를 만들지 못했습니다.');
      }
    },
    [period],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="guide-settlements-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/guides"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            가이드 관리
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">가이드 월 정산</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
            [일했음] 표시된 배정만 집계해 3.3% 원천징수를 계산합니다. 지급 실행과 홈택스 제출은
            사람이 합니다 — 시스템은 계산·서식 생성·기록까지만 합니다.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            정산 대상 월
            <input
              type="month"
              value={period}
              max={currentKstPeriod()}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-11 rounded-lg border border-slate-200 px-2.5 text-sm text-slate-900"
              data-testid="settlement-period-input"
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || !/^\d{4}-\d{2}$/.test(period)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="run-settlement-button"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            {running ? '집계 중…' : '정산 실행'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {tableMissing ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">정산 테이블이 아직 적용되지 않았습니다.</p>
            <p className="mt-0.5 text-amber-700">
              supabase/migrations/20260724210000_ops_guide_settlements.sql 을 검토 후 적용하면
              배정·정산·서식을 쓸 수 있습니다.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {unresolved.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">단가를 찾지 못한 배정 {unresolved.length}건 — 0원으로 집계됐습니다.</p>
            <ul className="mt-1 space-y-0.5 text-amber-700">
              {unresolved.slice(0, 8).map((u) => (
                <li key={u.assignmentId} className="tabular-nums">
                  {u.tourDate} · {u.tourType}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-amber-700">
              가이드 관리 → 단가 탭에서 해당 투어 유형의 단가를 등록하거나, 배정에 금액을 직접
              적은 뒤 다시 정산하세요.
            </p>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label={`용역대가 (${summary.guideCount}명 · ${summary.assignmentCount}건)`} value={krw(summary.grossKrw)} />
          <SummaryCard label="원천징수 3.3%" value={krw(summary.withheldKrw)} tone="amber" />
          <SummaryCard label="실비변상 (비과세)" value={krw(summary.reimbursementKrw)} />
          <SummaryCard label="실지급 합계" value={krw(summary.payoutKrw)} tone="dark" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-3 py-2 text-left font-medium">가이드</th>
              <th className="px-3 py-2 text-right font-medium">건수</th>
              <th className="px-3 py-2 text-right font-medium">용역대가</th>
              <th className="px-3 py-2 text-right font-medium">소득세</th>
              <th className="px-3 py-2 text-right font-medium">지방소득세</th>
              <th className="px-3 py-2 text-right font-medium">차감 지급액</th>
              <th className="px-3 py-2 text-right font-medium">실비변상</th>
              <th className="px-3 py-2 text-right font-medium">실지급</th>
              <th className="px-3 py-2 text-left font-medium">상태</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                  이 달의 정산 기록이 없습니다. [정산 실행]을 누르세요.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0" data-testid="settlement-row">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.guide_name ?? row.guide_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{row.assignment_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">{krw(row.gross_krw)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">−{krw(row.income_tax_krw)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">−{krw(row.local_tax_krw)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{krw(row.net_krw)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editingId === row.id ? (
                      <input
                        autoFocus
                        inputMode="numeric"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => saveReimbursement(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveReimbursement(row);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-8 w-28 rounded border border-slate-300 px-2 text-right text-sm tabular-nums"
                        data-testid="reimbursement-input"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditingValue(String(row.reimbursement_krw ?? 0));
                        }}
                        disabled={row.status === 'paid' || busyId === row.id}
                        className="rounded px-1.5 py-0.5 text-slate-600 underline decoration-dotted underline-offset-2 hover:bg-slate-100 disabled:no-underline disabled:opacity-60"
                        title="원천징수 대상이 아닌 실비. 손님이 당일 현금으로 갚은 지출은 넣지 마세요."
                      >
                        {krw(row.reimbursement_krw)}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">{krw(row.payout_krw)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {row.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => void patch(row, { status: 'confirmed' }, '확인 처리했습니다.')}
                          disabled={busyId === row.id}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <BadgeCheck className="size-3.5" />
                          확인
                        </button>
                      ) : null}
                      {row.status !== 'paid' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPayNote('');
                            setPayTarget(row);
                          }}
                          disabled={busyId === row.id}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2 text-xs font-semibold text-white disabled:opacity-50"
                          title="시스템이 이체하지 않습니다 — 이미 지급했다는 기록입니다."
                        >
                          <Wallet className="size-3.5" />
                          지급 완료 기록
                        </button>
                      ) : (
                        <span className="text-xs tabular-nums text-slate-400">
                          {row.paid_at?.slice(0, 10) ?? ''}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <FileText className="size-4" />
          세무 서식
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          인쇄(PDF 저장)와 CSV 내려받기까지만 합니다. 홈택스·위택스 제출은 사람이 합니다.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TAX_FORM_KEYS.map((form) => (
            <div
              key={form}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-slate-800">{TAX_FORM_LABELS[form]}</span>
              <div className="flex flex-shrink-0 gap-1.5">
                <Link
                  href={formHref(form)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="size-3.5" />
                  인쇄
                </Link>
                <button
                  type="button"
                  onClick={() => void downloadCsv(form)}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        ※ 실비변상은 원천징수 대상이 아니라 용역대가와 별도 줄로 계산합니다. 투어룸 지출 기록
        (손님이 당일 가이드에게 현금으로 갚는 항목)은 회사 실비변상이 아니므로 자동으로 합산되지
        않습니다 — 회사가 갚아야 하는 실비만 직접 입력하세요.
      </p>

      <ConfirmSheet
        open={payTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null);
        }}
        title="지급 완료로 기록"
        subtitle={
          <span className="block">
            {payTarget?.guide_name ?? '가이드'} · {payTarget?.period}
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="지급 메모 (예: 국민은행 이체 9/5)"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900"
              data-testid="paid-note-input"
            />
          </span>
        }
        amount={payTarget ? krw(payTarget.payout_krw) : undefined}
        note="시스템이 이체하지 않습니다. 이미 지급을 마쳤다는 기록만 남깁니다. 기록 후에는 금액이 잠깁니다."
        noteTone="warning"
        confirmLabel="지급했음을 기록"
        confirming={busyId !== null}
        onConfirm={() => {
          const row = payTarget;
          if (!row) return;
          setPayTarget(null);
          void patch(row, { status: 'paid', paidNote: payNote }, '지급 완료로 기록했습니다.');
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'dark' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'dark'
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
