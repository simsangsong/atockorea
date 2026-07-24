'use client';

/**
 * 월 정산서 (내부 문서) — Phase 3 §6.1 F-2.
 *
 * 순수 프레젠테이션. 데이터는 buildStatementDoc()이 만든 StatementDoc 하나뿐이라
 * 같은 DB 상태에서 언제 렌더해도 같은 문서가 나온다(결정 3: blob 대신 재현성).
 *
 * 🔴 부가세 라인 없음(결정 1). §6.2가 확정되기 전에는 세액 칸 자체를 만들지 않고
 *    하단 고지 문구로 공백을 명시한다.
 */

import type { StatementDoc } from '@/lib/ops/finance/documents';
import { formatMinor } from '@/lib/ops/finance/documents';
import { DocumentShell, EntityBlock, VatNoticeLine } from './DocumentChrome';

export function SettlementStatementDoc({ doc }: { doc: StatementDoc }) {
  const c = doc.currency;
  return (
    <DocumentShell
      draft={doc.draft}
      title="월 정산서"
      subtitle={`${doc.periodLabel} · 주문 ${doc.totals.orderCount}건`}
      testId="settlement-statement-doc"
    >
      <header className="fdoc-avoid-break border-b border-neutral-300 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Monthly Settlement Statement {doc.draft ? '(DRAFT)' : ''}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{doc.periodLabel} 정산서</h2>
        <p className="mt-1 text-xs text-neutral-500 tabular-nums">
          정산기간 {doc.period} · 마감 {doc.closedAt ? new Date(doc.closedAt).toLocaleString('ko-KR') : '-'}
          {doc.invoiceNo ? ` · 인보이스 ${doc.invoiceNo}` : ''}
        </p>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <EntityBlock
          role="결제 수취 (미국 LLC)"
          name={doc.usEntity.name}
          address={doc.usEntity.address}
          idLabel="EIN"
          idValue={doc.usEntity.ein}
        />
        <EntityBlock
          role="투어 운영 (한국 종합여행업)"
          name={doc.krEntity.name}
          address={doc.krEntity.address}
          idLabel="사업자등록번호"
          idValue={doc.krEntity.bizRegNo}
        />
      </section>

      <section className="fdoc-avoid-break mt-6">
        <h3 className="text-sm font-bold text-neutral-900">요약</h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            <SumRow label={`총매출 (gross · ${doc.totals.orderCount}건)`} value={formatMinor(doc.totals.grossMinor, c)} />
            <SumRow label={`LLC 커미션 (${doc.marginRateLabel})`} value={`− ${formatMinor(doc.totals.commissionMinor, c)}`} />
            <SumRow label="한국법인 송금분" value={formatMinor(doc.totals.remitMinor, c)} strong />
            {doc.totals.stripeFeeMinor !== null ? (
              <SumRow label="Stripe 수수료 (참고)" value={formatMinor(doc.totals.stripeFeeMinor, c)} muted />
            ) : (
              <SumRow label="Stripe 수수료 (참고)" value="미집계" muted />
            )}
            <SumRow label="실제 송금 합계" value={formatMinor(doc.remittedMinor, c)} />
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-neutral-900">주문별 명세</h3>
        <table className="mt-2 w-full border-collapse text-xs" data-testid="statement-lines">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-1.5 pr-2">예약번호</th>
              <th className="py-1.5 pr-2">투어일자</th>
              <th className="py-1.5 pr-2 text-right">총액</th>
              <th className="py-1.5 pr-2 text-right">커미션</th>
              <th className="py-1.5 text-right">송금분</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-400">
                  이 기간에 확정된 주문이 없습니다.
                </td>
              </tr>
            ) : (
              doc.lines.map((l) => (
                <tr key={l.bookingId} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-2 font-mono">{l.bookingReference}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{l.tourDate || '-'}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatMinor(l.grossMinor, c)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatMinor(l.commissionMinor, c)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{formatMinor(l.remitMinor, c)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <VatNoticeLine notice={doc.vatNotice} />
      <p className="mt-1 text-[11px] text-neutral-500">
        ※ 내부 정산 문서입니다. 고객 인보이스는 발행하지 않으며 고객 영수증은 Stripe가 발행합니다.
      </p>
    </DocumentShell>
  );
}

function SumRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-neutral-200 last:border-b-0">
      <th scope="row" className="w-1/2 py-2 text-left align-top text-xs font-medium text-neutral-500">
        {label}
      </th>
      <td
        className={`py-2 text-right align-top tabular-nums ${
          strong ? 'text-base font-bold text-neutral-900' : muted ? 'text-xs text-neutral-500' : 'text-sm text-neutral-900'
        }`}
      >
        {value}
      </td>
    </tr>
  );
}
