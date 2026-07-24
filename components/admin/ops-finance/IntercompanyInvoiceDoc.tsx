'use client';

/**
 * 인터컴퍼니 인보이스 — Phase 3 §6.4.
 * 한국법인(용역 제공) → 미국 LLC(용역 수취). 기간당 1장, 고객 인보이스는 없다(D11).
 *
 * §6.4 필수 항목 전부를 싣는다: 연번 · 발행일 · 양사 법적명칭/주소/사업자등록번호/EIN ·
 * 용역 기재 · 대상 주문번호와 투어일자 목록 · 금액(USD, 환율·기준일 명기) ·
 * Intercompany Services Agreement 참조 · 지급조건/수취계좌.
 *
 * 값·라벨·포맷은 `invoiceDocumentModel()` 하나에서만 나온다 — PDF 렌더러가 같은
 * 모델을 쓰므로 인쇄 뷰와 PDF가 다른 숫자를 낼 수 없다.
 *
 * 🔴 부가세 라인 없음(결정 1) — §6.2 미해결. 하단 고지로 공백을 명시한다.
 * 🔴 이 화면은 문서를 '보여줄' 뿐 어디로도 보내지 않는다(D10).
 */

import type { InvoiceDoc } from '@/lib/ops/finance/documents';
import { invoiceDocumentModel } from '@/lib/ops/finance/documentLayout';
import { DocumentShell, EntityBlock, VatNoticeLine } from './DocumentChrome';

export function IntercompanyInvoiceDoc({ doc }: { doc: InvoiceDoc }) {
  const model = invoiceDocumentModel(doc);
  return (
    <DocumentShell
      draft={model.draft}
      title={model.screenTitle}
      subtitle={model.screenSubtitle}
      testId="intercompany-invoice-doc"
    >
      <header className="fdoc-avoid-break flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            {model.kicker}
          </p>
          <h2 className="mt-1 text-2xl font-bold tabular-nums" data-testid="invoice-no">
            {model.invoiceNo}
          </h2>
        </div>
        <dl className="text-right text-xs text-neutral-600">
          {model.headerMeta.map((line, index) => (
            <div key={line.label} className={`flex justify-end gap-2${index > 0 ? ' mt-0.5' : ''}`}>
              <dt className="text-neutral-400">{line.label}</dt>
              <dd className="tabular-nums">{line.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {model.entities.map((entity) => (
          <EntityBlock
            key={entity.role}
            role={entity.role}
            name={entity.name}
            address={entity.address}
            idLabel={entity.idLabel}
            idValue={entity.idValue}
          />
        ))}
      </section>

      <section className="fdoc-avoid-break mt-6 rounded-lg bg-neutral-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-neutral-900">{model.service.title}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{model.service.subtitle}</p>
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="invoice-amount">
            {model.service.amountLabel}
          </p>
        </div>
        <p className="mt-2 text-xs text-neutral-600 tabular-nums">{model.service.currencyLine}</p>
        <p className="mt-1 text-xs text-neutral-600">{model.service.agreementLine}</p>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-neutral-900">{model.tableHeading}</h3>
        <table className="mt-2 w-full border-collapse text-xs" data-testid="invoice-lines">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              {model.table.columns.map((column, index) => (
                <th
                  key={column}
                  className={`py-1.5 ${index === model.table.columns.length - 1 ? '' : 'pr-2'} ${
                    model.table.align[index] === 'right' ? 'text-right' : ''
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.table.rows.length === 0 ? (
              <tr>
                <td colSpan={model.table.columns.length} className="py-6 text-center text-neutral-400">
                  {model.table.emptyText}
                </td>
              </tr>
            ) : (
              model.table.rows.map((row) => (
                <tr key={row.key} className="border-b border-neutral-100">
                  {row.cells.map((cell, index) => (
                    <td
                      key={model.table.columns[index]}
                      className={`py-1.5 ${index === row.cells.length - 1 ? 'font-semibold' : 'pr-2'} ${
                        model.table.align[index] === 'right' ? 'text-right tabular-nums' : ''
                      } ${index === 0 ? 'font-mono' : ''} ${index === 1 ? 'tabular-nums' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="fdoc-avoid-break mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {model.footer.map((line) => (
          <div key={line.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              {line.label}
            </p>
            <p className="mt-1 whitespace-pre-line text-xs text-neutral-700">{line.value}</p>
          </div>
        ))}
      </section>

      <VatNoticeLine notice={model.notes[0]} />
    </DocumentShell>
  );
}
