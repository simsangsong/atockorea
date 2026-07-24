'use client';

/**
 * 인터컴퍼니 인보이스 — Phase 3 §6.4.
 * 한국법인(용역 제공) → 미국 LLC(용역 수취). 기간당 1장, 고객 인보이스는 없다(D11).
 *
 * §6.4 필수 항목 전부를 싣는다: 연번 · 발행일 · 양사 법적명칭/주소/사업자등록번호/EIN ·
 * 용역 기재 · 대상 주문번호와 투어일자 목록 · 금액(USD, 환율·기준일 명기) ·
 * Intercompany Services Agreement 참조 · 지급조건/수취계좌.
 *
 * 🔴 부가세 라인 없음(결정 1) — §6.2 미해결. 하단 고지로 공백을 명시한다.
 * 🔴 이 화면은 문서를 '보여줄' 뿐 어디로도 보내지 않는다(D10).
 */

import type { InvoiceDoc } from '@/lib/ops/finance/documents';
import { formatMinor } from '@/lib/ops/finance/documents';
import { DocumentShell, EntityBlock, VatNoticeLine } from './DocumentChrome';

export function IntercompanyInvoiceDoc({ doc }: { doc: InvoiceDoc }) {
  const c = doc.currency;
  return (
    <DocumentShell
      draft={doc.draft}
      title="인터컴퍼니 인보이스"
      subtitle={`${doc.invoiceNo} · ${doc.periodLabel}`}
      testId="intercompany-invoice-doc"
    >
      <header className="fdoc-avoid-break flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Intercompany Invoice {doc.draft ? '(DRAFT)' : ''}
          </p>
          <h2 className="mt-1 text-2xl font-bold tabular-nums" data-testid="invoice-no">
            {doc.invoiceNo}
          </h2>
        </div>
        <dl className="text-right text-xs text-neutral-600">
          <div className="flex justify-end gap-2">
            <dt className="text-neutral-400">발행일</dt>
            <dd className="tabular-nums">{doc.issueDate || '-'}</dd>
          </div>
          <div className="mt-0.5 flex justify-end gap-2">
            <dt className="text-neutral-400">대상 기간</dt>
            <dd className="tabular-nums">{doc.periodLabel}</dd>
          </div>
        </dl>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <EntityBlock
          role="From — 용역 제공 (한국 종합여행업)"
          name={doc.from.name}
          address={doc.from.address}
          idLabel="사업자등록번호"
          idValue={doc.from.bizRegNo}
        />
        <EntityBlock
          role="To — 용역 수취 (미국 LLC)"
          name={doc.to.name}
          address={doc.to.address}
          idLabel="EIN"
          idValue={doc.to.ein}
        />
      </section>

      <section className="fdoc-avoid-break mt-6 rounded-lg bg-neutral-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-neutral-900">{doc.serviceDescription}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {doc.periodLabel} 투어 운영 용역 · 총매출에서 LLC 커미션 {doc.marginRateLabel}을 차감한 금액
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="invoice-amount">
            {doc.amountLabel}
          </p>
        </div>
        <p className="mt-2 text-xs text-neutral-600 tabular-nums">
          통화 {c}
          {doc.fxRate !== null
            ? ` · 적용환율 ${doc.fxRate} (기준일 ${doc.fxRateDate || '미기재'})`
            : ' · 적용환율 미기재 (원화 환산은 별도)'}
        </p>
        <p className="mt-1 text-xs text-neutral-600">계약 참조: {doc.agreementReference}</p>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-neutral-900">대상 주문 목록</h3>
        <table className="mt-2 w-full border-collapse text-xs" data-testid="invoice-lines">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-1.5 pr-2">예약번호</th>
              <th className="py-1.5 pr-2">투어일자</th>
              <th className="py-1.5 pr-2 text-right">총액</th>
              <th className="py-1.5 pr-2 text-right">커미션</th>
              <th className="py-1.5 text-right">청구액</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-400">
                  대상 주문이 없습니다.
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

      <section className="fdoc-avoid-break mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">지급조건</p>
          <p className="mt-1 whitespace-pre-line text-xs text-neutral-700">{doc.paymentTerms}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">수취계좌</p>
          <p className="mt-1 whitespace-pre-line text-xs text-neutral-700">{doc.bankAccount}</p>
        </div>
      </section>

      {doc.notes ? (
        <section className="fdoc-avoid-break mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">비고</p>
          <p className="mt-1 whitespace-pre-line text-xs text-neutral-700">{doc.notes}</p>
        </section>
      ) : null}

      <VatNoticeLine notice={doc.vatNotice} />
    </DocumentShell>
  );
}
