'use client';

/**
 * 월 정산서 (내부 문서) — Phase 3 §6.1 F-2.
 *
 * 순수 프레젠테이션. 라벨·행·포맷은 전부 `statementDocumentModel()`이 정하고
 * 이 파일은 그리기만 한다 — 같은 모델을 PDF 렌더러(lib/ops/finance/pdf)도 쓰기
 * 때문에, 이 화면과 PDF의 숫자가 갈라지려면 모델을 고쳐야 하고 고치면 둘 다
 * 같이 바뀐다.
 *
 * 🔴 부가세 라인 없음(결정 1). §6.2가 확정되기 전에는 세액 칸 자체를 만들지 않고
 *    하단 고지 문구로 공백을 명시한다.
 */

import type { StatementDoc } from '@/lib/ops/finance/documents';
import { statementDocumentModel, type DocSummaryRow } from '@/lib/ops/finance/documentLayout';
import { DocumentShell, EntityBlock, VatNoticeLine } from './DocumentChrome';

export function SettlementStatementDoc({ doc }: { doc: StatementDoc }) {
  const model = statementDocumentModel(doc);
  return (
    <DocumentShell
      draft={model.draft}
      title={model.screenTitle}
      subtitle={model.screenSubtitle}
      testId="settlement-statement-doc"
    >
      <header className="fdoc-avoid-break border-b border-neutral-300 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          {model.kicker}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{model.title}</h2>
        <p className="mt-1 text-xs text-neutral-500 tabular-nums">{model.metaLine}</p>
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

      <section className="fdoc-avoid-break mt-6">
        <h3 className="text-sm font-bold text-neutral-900">{model.summaryHeading}</h3>
        <table className="mt-2 w-full border-collapse text-sm" data-testid="statement-summary">
          <tbody>
            {model.summary.map((row) => (
              <SumRow key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-bold text-neutral-900">{model.tableHeading}</h3>
        <table className="mt-2 w-full border-collapse text-xs" data-testid="statement-lines">
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

      <VatNoticeLine notice={model.notes[0]} />
      <p className="mt-1 text-[11px] text-neutral-500">※ {model.notes[1]}</p>
    </DocumentShell>
  );
}

function SumRow({ row }: { row: DocSummaryRow }) {
  return (
    <tr className="border-b border-neutral-200 last:border-b-0">
      <th scope="row" className="w-1/2 py-2 text-left align-top text-xs font-medium text-neutral-500">
        {row.label}
      </th>
      <td
        className={`py-2 text-right align-top tabular-nums ${
          row.emphasis === 'strong'
            ? 'text-base font-bold text-neutral-900'
            : row.emphasis === 'muted'
              ? 'text-xs text-neutral-500'
              : 'text-sm text-neutral-900'
        }`}
      >
        {row.value}
      </td>
    </tr>
  );
}
