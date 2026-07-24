'use client';

/**
 * /admin/ops-finance/periods/[period] — 기간 상세 (Phase 3 §6.1 F-2~F-4).
 *
 * 주문별 원장 명세 · [인보이스 발행] · 송금 등록 폼 · [3자 대사].
 * 대사는 하드 게이트다: 정산서 송금분 = 인보이스 금액 = 실제 송금합이 정확히
 * 일치할 때만 status가 'reconciled'로 전진하고, 불일치는 차액을 빨갛게 보여주며
 * 상태를 바꾸지 않는다(설계 결정 6).
 *
 * 🔴 송금 실행 버튼은 없다(D10). "송금 등록"은 이미 은행에서 일어난 일을 받아 적는
 *    입력 폼이다.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileText,
  Receipt,
  RefreshCw,
  Scale,
} from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { formatMinor } from '@/lib/ops/finance/documents';
import type { StatementDoc } from '@/lib/ops/finance/documents';
import type {
  IntercompanyInvoiceRow,
  ReconcileResult,
  RemittanceRow,
  SettlementPeriodRow,
} from '@/lib/ops/finance/settlement';

interface DetailResponse {
  ok: boolean;
  tableMissing: boolean;
  period: SettlementPeriodRow | null;
  invoice: IntercompanyInvoiceRow | null;
  remittances: RemittanceRow[];
  reconcile: ReconcileResult | null;
  statement: StatementDoc | null;
  expertReviewed: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  open: '미마감',
  closed: '마감',
  invoiced: '인보이스 발행',
  remitted: '송금 등록',
  reconciled: '대사 완료',
};

export default function SettlementPeriodDetailPage() {
  const params = useParams<{ period: string }>();
  const period = typeof params?.period === 'string' ? params.period : '';

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<ReconcileResult | null>(null);

  const [wireDate, setWireDate] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [amountKrw, setAmountKrw] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [swiftDocUrl, setSwiftDocUrl] = useState('');

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch(`/api/admin/ops-finance/periods/${encodeURIComponent(period)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '기간 상세를 불러오지 못했습니다.');
      setData(json as DetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getAdminAccessToken();
      const res = await fetch(`/api/admin/ops-finance/periods/${encodeURIComponent(period)}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      return { res, json } as { res: Response; json: Record<string, unknown> };
    },
    [period],
  );

  const issueInvoice = useCallback(async () => {
    setBusy('invoice');
    try {
      const { res, json } = await post('/invoice');
      if (!res.ok) throw new Error(String(json.message ?? '인보이스 발행에 실패했습니다.'));
      toast.success(String(json.message ?? '발행했습니다.'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인보이스 발행에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  /**
   * §6.3 (G2) — 첨부 파일이 필요한 제출처(세무사·은행)용 PDF를 private 버킷에
   * 만들어 두고 단기 서명 URL을 연다. 🔴 만들어 보관할 뿐 어디로도 보내지 않는다(D10).
   */
  const generatePdf = useCallback(
    async (kind: 'statement' | 'invoice') => {
      setBusy(`${kind}-pdf`);
      try {
        const { res, json } = await post('/pdf', { kind });
        if (!res.ok || !json.ok) throw new Error(String(json.message ?? 'PDF 생성에 실패했습니다.'));
        if (json.message) toast.warning(String(json.message));
        else toast.success(json.draft ? 'PDF를 만들었습니다 (DRAFT 워터마크).' : 'PDF를 만들었습니다.');
        if (typeof json.signedUrl === 'string') window.open(json.signedUrl, '_blank', 'noopener');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'PDF 생성에 실패했습니다.');
      } finally {
        setBusy(null);
      }
    },
    [post, load],
  );

  const submitRemittance = useCallback(async () => {
    setBusy('remittance');
    try {
      const { res, json } = await post('/remittances', {
        wireDate,
        amountUsd,
        amountKrw: amountKrw || undefined,
        fxRate: fxRate || undefined,
        bankRef: bankRef || undefined,
        swiftDocUrl: swiftDocUrl || undefined,
      });
      if (!res.ok) throw new Error(String(json.message ?? '송금 등록에 실패했습니다.'));
      toast.success('송금 기록을 등록했습니다.');
      setWireDate('');
      setAmountUsd('');
      setAmountKrw('');
      setFxRate('');
      setBankRef('');
      setSwiftDocUrl('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '송금 등록에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }, [post, load, wireDate, amountUsd, amountKrw, fxRate, bankRef, swiftDocUrl]);

  const runReconcile = useCallback(async () => {
    setBusy('reconcile');
    setMismatch(null);
    try {
      const { res, json } = await post('/reconcile');
      if (!res.ok) {
        // 400 = 불일치. 차액을 화면에 남긴다(상태는 그대로).
        setMismatch((json.reconcile as ReconcileResult) ?? null);
        toast.error(String(json.message ?? '3자 금액이 일치하지 않습니다.'));
        await load();
        return;
      }
      toast.success(String(json.message ?? '3자 대사가 일치합니다.'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '대사에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  const p = data?.period ?? null;
  const currency = p?.currency ?? 'USD';
  const rec = mismatch ?? data?.reconcile ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="settlement-period-detail">
      <div>
        <Link
          href="/admin/ops-finance/periods"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          월 정산 사이클
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tabular-nums text-slate-900">{period} 정산</h1>
          {p ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {!loading && !p ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
          <p>이 기간은 아직 마감되지 않았습니다. 목록에서 [마감]을 먼저 실행하세요.</p>
        </div>
      ) : null}

      {p ? (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card label={`총매출 (${p.order_count}건)`} value={formatMinor(p.gross_minor, currency)} />
            <Card
              label={`LLC 커미션 ${Math.round(p.margin_rate * 1000) / 10}% (마감 시점 스냅샷)`}
              value={formatMinor(p.commission_minor, currency)}
            />
            <Card label="한국법인 송금분" value={formatMinor(p.remit_minor, currency)} strong />
          </div>

          {/* 문서 */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/ops-finance/periods/${period}/statement`}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileText className="size-4" />
              월 정산서 보기 / 인쇄
            </Link>
            <button
              type="button"
              onClick={() => void generatePdf('statement')}
              disabled={busy !== null}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              data-testid="statement-pdf-button"
            >
              <FileDown className="size-4" />
              {busy === 'statement-pdf' ? '생성 중…' : '정산서 PDF'}
            </button>
            {data?.invoice ? (
              <Link
                href={`/admin/ops-finance/periods/${period}/invoice`}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Receipt className="size-4" />
                인보이스 {data.invoice.invoice_no} 보기 / 인쇄
              </Link>
            ) : null}
            {data?.invoice ? (
              <button
                type="button"
                onClick={() => void generatePdf('invoice')}
                disabled={busy !== null}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                data-testid="invoice-pdf-button"
              >
                <FileDown className="size-4" />
                {busy === 'invoice-pdf' ? '생성 중…' : '인보이스 PDF'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void issueInvoice()}
                disabled={busy !== null}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="issue-invoice-button"
              >
                <Receipt className="size-4" />
                {busy === 'invoice' ? '발행 중…' : '인보이스 발행'}
              </button>
            )}
          </div>

          {/* 3자 대사 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Scale className="size-4" />
                3자 대사
              </h2>
              <button
                type="button"
                onClick={() => void runReconcile()}
                disabled={busy !== null}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                data-testid="reconcile-button"
              >
                {busy === 'reconcile' ? '대사 중…' : '대사 실행'}
              </button>
            </div>

            <table className="mt-3 w-full text-sm">
              <tbody>
                <ReconcileRow label="① 정산서 송금분" value={formatMinor(p.remit_minor, currency)} />
                <ReconcileRow
                  label="② 인보이스 금액"
                  value={data?.invoice ? formatMinor(data.invoice.amount_minor, currency) : '미발행'}
                />
                <ReconcileRow
                  label="③ 실제 송금 합계"
                  value={formatMinor(
                    (data?.remittances ?? []).reduce((s, r) => s + r.amount_usd_minor, 0),
                    currency,
                  )}
                />
              </tbody>
            </table>

            {rec ? (
              <p
                className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  rec.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
                }`}
                data-testid="reconcile-result"
              >
                {rec.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
                )}
                <span>
                  {rec.message}
                  {!rec.ok && (rec.diffs.invoiceVsPeriod !== 0 || rec.diffs.remitVsInvoice !== 0) ? (
                    <span className="ml-1 tabular-nums">
                      (인보이스−정산서 {formatMinor(rec.diffs.invoiceVsPeriod, currency)} · 송금−인보이스{' '}
                      {formatMinor(rec.diffs.remitVsInvoice, currency)})
                    </span>
                  ) : null}
                </span>
              </p>
            ) : null}
          </section>

          {/* 송금 기록 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">송금 기록</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              국제송금은 은행에서 직접 실행하고, 여기에는 그 결과를 기록합니다. SWIFT 사본은
              외화입금증명(영세율 첨부서류)으로 보관합니다.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Field label="송금일" type="date" value={wireDate} onChange={setWireDate} testId="wire-date" />
              <Field label={`금액 (${currency})`} value={amountUsd} onChange={setAmountUsd} placeholder="27360.00" testId="wire-amount" />
              <Field label="원화 입금액 (선택)" value={amountKrw} onChange={setAmountKrw} placeholder="37,000,000" />
              <Field label="적용환율 (선택)" value={fxRate} onChange={setFxRate} placeholder="1352.40" />
              <Field label="은행 참조번호 (선택)" value={bankRef} onChange={setBankRef} />
              <Field label="SWIFT 사본 URL (선택)" value={swiftDocUrl} onChange={setSwiftDocUrl} />
            </div>
            <button
              type="button"
              onClick={() => void submitRemittance()}
              disabled={busy !== null || !wireDate || !amountUsd}
              className="mt-3 inline-flex h-[38px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="remittance-submit"
            >
              {busy === 'remittance' ? '등록 중…' : '송금 기록 등록'}
            </button>

            {(data?.remittances ?? []).length > 0 ? (
              <table className="mt-4 w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-2">송금일</th>
                    <th className="py-1.5 pr-2 text-right">금액</th>
                    <th className="py-1.5 pr-2 text-right">원화</th>
                    <th className="py-1.5 pr-2">참조</th>
                    <th className="py-1.5">증빙</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.remittances.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-2 tabular-nums">{r.wire_date}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatMinor(r.amount_usd_minor, currency)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {r.amount_krw !== null ? r.amount_krw.toLocaleString('ko-KR') : '-'}
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-slate-500">{r.bank_ref || '-'}</td>
                      <td className="py-1.5">
                        {r.swift_doc_url ? (
                          <a href={r.swift_doc_url} target="_blank" rel="noopener noreferrer" className="underline">
                            사본
                          </a>
                        ) : (
                          <span className="text-slate-400">없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>

          {/* 주문별 명세 */}
          {data?.statement ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">
                주문별 명세
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">예약번호</th>
                      <th className="px-3 py-2">투어일자</th>
                      <th className="px-3 py-2 text-right">총액</th>
                      <th className="px-3 py-2 text-right">커미션</th>
                      <th className="px-3 py-2 text-right">송금분</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.statement.lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                          이 기간에 확정된 주문이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      data.statement.lines.map((l) => (
                        <tr key={l.bookingId}>
                          <td className="px-3 py-2 font-mono text-xs">{l.bookingReference}</td>
                          <td className="px-3 py-2 tabular-nums">{l.tourDate || '-'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMinor(l.grossMinor, currency)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMinor(l.commissionMinor, currency)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {formatMinor(l.remitMinor, currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Card({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 tabular-nums ${strong ? 'text-2xl font-bold text-slate-900' : 'text-xl font-semibold text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}

function ReconcileRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <th scope="row" className="py-1.5 text-left text-xs font-medium text-slate-500">
        {label}
      </th>
      <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">{value}</td>
    </tr>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        data-testid={testId}
      />
    </label>
  );
}
